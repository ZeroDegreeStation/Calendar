/**
 * Booking System - Core calendar and booking logic
 */
class BookingSystem {
    constructor() {
        console.log('🚀 Initializing BookingSystem...');
        
        this.excelHandler = new ExcelHandler();
        this.githubSync = new GitHubSync();
        
        this.calendar = null;
        this.availabilityOverrides = [];
        this.bookings = [];
        this.selectedDates = [];
        
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 10;
        
        // Bind methods
        this.handleDateClick = this.handleDateClick.bind(this);
        this.handleDateSelect = this.handleDateSelect.bind(this);
        this.openBookingModal = this.openBookingModal.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.clearDateSelection = this.clearDateSelection.bind(this);
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.initCalendar();
            this.setupEventListeners();
            console.log('✅ BookingSystem initialized');
        } catch (error) {
            console.error('❌ Failed to initialize BookingSystem:', error);
        }
    }

    async loadData() {
        try {
            const [overrides, bookings] = await Promise.all([
                this.excelHandler.loadAvailabilityOverrides(),
                this.excelHandler.loadBookings()
            ]);
            
            this.availabilityOverrides = overrides || [];
            this.bookings = bookings || [];
            
            console.log('📊 Data loaded:', {
                overrides: this.availabilityOverrides.length,
                bookings: this.bookings.length
            });
        } catch (error) {
            console.error('Error loading data:', error);
            this.availabilityOverrides = [];
            this.bookings = [];
        }
    }

    initCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        if (!calendarEl) {
            console.error('❌ Calendar element not found!');
            return;
        }

        console.log('📅 Rendering calendar...');

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth'
            },
            dateCellDidMount: (info) => this.styleDateCell(info),
            dateClick: this.handleDateClick,
            selectable: true,
            select: this.handleDateSelect,
            selectAllow: (info) => this.isDateSelectable(info),
            unselectAuto: false,
            dayMaxEvents: true,
            height: 'auto',
            aspectRatio: 1.6,
            firstDay: 0,
            buttonText: {
                today: 'Today',
                month: 'Month'
            }
        });
        
        this.calendar.render();
        console.log('✅ Calendar rendered');
    }

    styleDateCell(info) {
        const dateStr = info.date.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const isPast = info.date < new Date(today);
        
        const status = this.getDayStatus(dateStr);
        
        if (isPast) {
            info.el.classList.add('fc-day-past');
        } else {
            info.el.classList.add(`fc-day-${status.class}`);
        }
        
        if (!isPast && status.class !== 'closed' && status.class !== 'booked') {
            const bookingCount = this.getBookingCount(dateStr);
            const maxBookings = this.getMaxBookings(dateStr);
            const available = maxBookings - bookingCount;
            
            const badge = document.createElement('div');
            badge.className = 'fc-daygrid-day-badge';
            badge.style.cssText = `
                position: absolute;
                bottom: 2px;
                right: 2px;
                background: white;
                border-radius: 12px;
                padding: 2px 8px;
                font-size: 11px;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                color: ${this.getStatusColor(status.class)};
            `;
            badge.textContent = `${available}/${maxBookings}`;
            info.el.appendChild(badge);
        }
        
        if (this.selectedDates.includes(dateStr)) {
            info.el.classList.add('fc-day-selected');
        }
    }

    getDayStatus(dateStr) {
        if (new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])) {
            return { class: 'past', label: 'Past' };
        }
        
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        if (override) {
            if (override.Status === 'Closed') return { class: 'closed', label: 'Closed' };
            if (override.Status === 'Booked') return { class: 'booked', label: 'Fully Booked' };
            if (override.Status === 'Limited') return { class: 'limited', label: 'Limited' };
        }
        
        const bookingCount = this.getBookingCount(dateStr);
        const maxBookings = this.getMaxBookings(dateStr);
        const percentage = bookingCount / maxBookings;
        
        if (bookingCount >= maxBookings) {
            return { class: 'booked', label: 'Fully Booked' };
        } else if (percentage >= 0.7) {
            return { class: 'limited', label: 'Limited' };
        } else {
            return { class: 'available', label: 'Available' };
        }
    }

    getBookingCount(dateStr) {
        return this.bookings
            .filter(b => b.Date === dateStr && b.Status === 'Confirmed')
            .reduce((total, booking) => total + (parseInt(booking.Guests) || 1), 0);
    }

    getMaxBookings(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.MaxBookings || this.defaultMaxBookings;
    }

    getPrice(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.Price || this.defaultPrice;
    }

    getStatusColor(statusClass) {
        const colors = {
            'available': '#34C759',
            'limited': '#FF9F0A',
            'booked': '#FF3B30',
            'closed': '#8E8E93',
            'past': '#8E8E93'
        };
        return colors[statusClass] || '#4285F4';
    }

    isDateSelectable(info) {
        const dateStr = info.startStr.split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        if (dateStr < today) return false;
        
        const status = this.getDayStatus(dateStr);
        return !['booked', 'closed', 'past'].includes(status.class);
    }

    handleDateClick(info) {
        if (!this.isDateSelectable(info)) {
            this.showNotification('This date is not available', 'error');
            return;
        }
        
        const dateStr = info.dateStr;
        const index = this.selectedDates.indexOf(dateStr);
        
        if (index === -1) {
            this.selectedDates.push(dateStr);
            info.el.classList.add('fc-day-selected');
        } else {
            this.selectedDates.splice(index, 1);
            info.el.classList.remove('fc-day-selected');
        }
        
        this.selectedDates.sort();
        
        // Dispatch custom event for SnowStation integration
        const event = new CustomEvent('datesSelected', { 
            detail: { dates: this.selectedDates } 
        });
        document.dispatchEvent(event);
    }

    handleDateSelect(info) {
        const start = info.startStr.split('T')[0];
        const end = info.endStr.split('T')[0];
        
        this.clearDateSelection(false);
        
        let current = new Date(start);
        while (current.toISOString().split('T')[0] < end) {
            const dateStr = current.toISOString().split('T')[0];
            
            if (this.isDateSelectable({ startStr: dateStr })) {
                this.selectedDates.push(dateStr);
                
                const dayCell = document.querySelector(`[data-date="${dateStr}"]`);
                if (dayCell) {
                    dayCell.classList.add('fc-day-selected');
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        this.selectedDates.sort();
        
        // Dispatch custom event
        const event = new CustomEvent('datesSelected', { 
            detail: { dates: this.selectedDates } 
        });
        document.dispatchEvent(event);
    }

    clearDateSelection(showNotification = true) {
        this.selectedDates = [];
        
        document.querySelectorAll('.fc-day-selected').forEach(el => {
            el.classList.remove('fc-day-selected');
        });
        
        // Dispatch custom event
        const event = new CustomEvent('datesSelected', { 
            detail: { dates: [] } 
        });
        document.dispatchEvent(event);
    }

    async submitBooking(event) {
        if (event) event.preventDefault();
        
        const name = document.getElementById('customerName')?.value;
        const email = document.getElementById('customerEmail')?.value;
        const phone = document.getElementById('customerPhone')?.value;
        const guests = document.getElementById('guests')?.value || '2';
        
        if (!name || !email) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const bookingId = 'SNOW-' + Math.floor(100000 + Math.random() * 900000);
        
        for (const date of this.selectedDates) {
            const booking = {
                'Booking ID': bookingId,
                'Date': date,
                'Customer Name': name,
                'Email': email,
                'Phone': phone || '',
                'Guests': parseInt(guests) || 1,
                'Total Price': this.getPrice(date),
                'Status': 'Confirmed',
                'Booking Date': new Date().toISOString().split('T')[0]
            };
            
            this.bookings.push(booking);
            await this.excelHandler.saveBooking(booking);
            await this.excelHandler.updateAvailability(date, parseInt(guests) || 1);
        }
        
        this.clearDateSelection(false);
        this.showNotification('Booking confirmed!', 'success');
    }

    setupEventListeners() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    openBookingModal() {
        console.log('Opening booking modal...');
    }

    closeModal() {
        const modal = document.getElementById('bookingModal');
        if (modal) {
            modal.classList.remove('visible');
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.8rem;
        `;
        
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.BookingSystem = BookingSystem;
}