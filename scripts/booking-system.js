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
        this.selectedPlan = null;
        this.planPrice = 0;
        this.planName = '';
        
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 2;
        
        this.isLoading = false;
        this.pendingResync = false;
        
        // Bind methods
        this.handleDateClick = this.handleDateClick.bind(this);
        this.handleDateSelect = this.handleDateSelect.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.clearDateSelection = this.clearDateSelection.bind(this);
        this.forceCalendarRefresh = this.forceCalendarRefresh.bind(this);
        this.updateBookingSummary = this.updateBookingSummary.bind(this);
        this.refreshCalendarData = this.refreshCalendarData.bind(this);
        this.resyncFromExcel = this.resyncFromExcel.bind(this);
        
        this.init();
    }

    async init() {
        try {
            this.showCalendarLoading('Loading calendar data...');
            
            await this.loadData();
            this.initCalendar();
            this.setupEventListeners();
            
            const statusEl = document.getElementById('calendarLastUpdated');
            if (statusEl) {
                const now = new Date();
                statusEl.textContent = `Calendar ready: ${now.toLocaleDateString()}`;
            }
            
            console.log('✅ BookingSystem initialized');
        } catch (error) {
            console.error('❌ Failed to initialize BookingSystem:', error);
            this.showCalendarError('Failed to initialize calendar');
        }
    }

    showCalendarLoading(message) {
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            calendarEl.innerHTML = `
                <div class="calendar-loading">
                    <i class="fas fa-spinner fa-spin"></i> ${message}
                </div>
            `;
        }
    }

    showCalendarError(message) {
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            calendarEl.innerHTML = `
                <div class="calendar-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button onclick="window.location.reload()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            `;
        }
    }

    async loadData() {
        try {
            // Pass token to excelHandler
            if (this.githubSync.hasReadToken()) {
                this.excelHandler.setToken(this.githubSync.getTokenForReading());
            }
            
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
            
            const statusEl = document.getElementById('calendarLastUpdated');
            if (statusEl) {
                statusEl.textContent = `Loaded: ${this.availabilityOverrides.length} overrides, ${this.bookings.length} bookings`;
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.loadDemoData();
        }
    }

    loadDemoData() {
        console.log('📊 Loading demo data for testing');
        this.availabilityOverrides = [];
        this.bookings = [];
    }

    initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        calendarEl.innerHTML = '';

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth'
            },
            height: 'auto',
            firstDay: 0,
            selectable: true,
            select: this.handleDateSelect,
            dateClick: this.handleDateClick,
            selectAllow: (info) => this.isDateSelectable(info),
            dayCellDidMount: (info) => this.styleDateCell(info),
            datesSet: () => this.refreshVisibleCells()
        });
        
        this.calendar.render();
    }

    refreshVisibleCells() {
        document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr) this.applyStylesToCell(cell, dateStr);
        });
    }

    applyStylesToCell(cell, dateStr) {
        const today = new Date().toISOString().split('T')[0];
        const isPast = dateStr < today;
        const status = this.getDayStatus(dateStr);
        const bookingCount = this.getBookingCount(dateStr);
        const maxBookings = this.getMaxBookings(dateStr);
        const available = Math.max(0, maxBookings - bookingCount);
        
        cell.classList.remove(
            'fc-day-available', 'fc-day-limited', 'fc-day-booked', 
            'fc-day-past', 'fc-day-closed'
        );
        
        if (isPast) {
            cell.classList.add('fc-day-past');
        } else if (status.class === 'closed' || status.class === 'booked') {
            cell.classList.add('fc-day-booked');
        } else {
            cell.classList.add(`fc-day-${status.class}`);
        }
        
        const existingBadge = cell.querySelector('.day-badge');
        if (existingBadge) existingBadge.remove();
        
        if (!isPast) {
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            
            if (status.class === 'closed') {
                badge.textContent = 'Closed';
            } else if (status.class === 'booked' || available <= 0) {
                badge.textContent = 'Full';
            } else if (status.class === 'limited' || available === 1) {
                badge.textContent = '1 left';
            } else if (status.class === 'available') {
                badge.textContent = `${available} left`;
            }
            
            cell.appendChild(badge);
        }
        
        if (this.selectedDates && this.selectedDates.includes(dateStr)) {
            cell.classList.add('fc-day-selected');
        } else {
            cell.classList.remove('fc-day-selected');
        }
    }

    styleDateCell(info) {
        this.applyStylesToCell(info.el, info.date.toISOString().split('T')[0]);
    }

    getDayStatus(dateStr) {
        if (new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])) {
            return { class: 'past' };
        }
        
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        
        if (override) {
            if (override.Status === 'Closed') return { class: 'closed' };
            if (override.Status === 'Booked') return { class: 'booked' };
            if (override.Status === 'Limited') return { class: 'limited' };
            if (override.Status === 'Available') return { class: 'available' };
        }
        
        const bookingCount = this.getBookingCount(dateStr);
        if (bookingCount >= this.defaultMaxBookings) return { class: 'booked' };
        if (bookingCount >= 1) return { class: 'limited' };
        return { class: 'available' };
    }

    getBookingCount(dateStr) {
        const uniqueBookings = new Set();
        this.bookings
            .filter(b => b.Date === dateStr && b.Status === 'Confirmed')
            .forEach(b => uniqueBookings.add(b['Booking ID']));
        return uniqueBookings.size;
    }

    getMaxBookings(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.MaxBookings || this.defaultMaxBookings;
    }

    isDateSelectable(info) {
        const dateStr = info.startStr.split('T')[0];
        if (dateStr < new Date().toISOString().split('T')[0]) return false;
        const status = this.getDayStatus(dateStr);
        return !['booked', 'closed', 'past'].includes(status.class);
    }

    handleDateClick(info) {
        const dateStr = info.dateStr;
        
        if (!this.isDateSelectable(info)) {
            this.showNotification('This date is not available', 'error');
            return;
        }
        
        const index = this.selectedDates.indexOf(dateStr);
        if (index === -1) {
            this.selectedDates.push(dateStr);
            info.el.classList.add('fc-day-selected');
        } else {
            this.selectedDates.splice(index, 1);
            info.el.classList.remove('fc-day-selected');
        }
        
        this.selectedDates.sort();
        this.updateBookingSummary();
        
        const event = new CustomEvent('datesSelected', { 
            detail: { 
                dates: this.selectedDates,
                checkin: this.selectedDates[0] || null,
                checkout: this.getCheckoutDate()
            } 
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
                if (dayCell) dayCell.classList.add('fc-day-selected');
            }
            current.setDate(current.getDate() + 1);
        }
        
        this.selectedDates.sort();
        this.updateBookingSummary();
        
        const event = new CustomEvent('datesSelected', { 
            detail: { 
                dates: this.selectedDates,
                checkin: this.selectedDates[0] || null,
                checkout: this.getCheckoutDate()
            } 
        });
        document.dispatchEvent(event);
    }

    getCheckoutDate() {
        if (this.selectedDates.length === 0) return null;
        const lastDate = new Date(this.selectedDates[this.selectedDates.length - 1]);
        lastDate.setDate(lastDate.getDate() + 1);
        return lastDate.toISOString().split('T')[0];
    }

    clearDateSelection(showNotification = true) {
        this.selectedDates = [];
        document.querySelectorAll('.fc-day-selected').forEach(el => {
            el.classList.remove('fc-day-selected');
        });
        this.updateBookingSummary();
    }

    updateBookingSummary() {
        const summaryEl = document.getElementById('bookingSummary');
        const selectedDatesText = document.getElementById('selectedDatesText');
        const totalPriceEl = document.getElementById('totalPrice');
        
        if (!summaryEl || !selectedDatesText || !totalPriceEl) return;
        
        if (this.selectedDates.length === 0) {
            summaryEl.classList.remove('visible');
            selectedDatesText.textContent = 'No dates selected';
            totalPriceEl.textContent = '¥0';
            return;
        }
        
        if (this.selectedDates.length === 1) {
            selectedDatesText.textContent = this.formatDate(this.selectedDates[0]);
        } else {
            const first = this.formatDate(this.selectedDates[0]);
            const last = this.formatDate(this.selectedDates[this.selectedDates.length - 1]);
            selectedDatesText.textContent = `${first} - ${last} (${this.selectedDates.length} nights)`;
        }
        
        const nights = this.selectedDates.length;
        const pricePerNight = this.planPrice || this.defaultPrice;
        const roomRate = pricePerNight * nights;
        const tax = Math.round(roomRate * 0.1);
        const serviceCharge = 1000;
        const total = roomRate + tax + serviceCharge;
        
        totalPriceEl.textContent = `¥${total.toLocaleString()}`;
        summaryEl.classList.add('visible');
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    async submitBooking(bookingData) {
        try {
            console.log('📝 Processing booking...', bookingData);
            
            // Validate availability
            for (const date of this.selectedDates) {
                if (this.getBookingCount(date) >= this.getMaxBookings(date)) {
                    this.showNotification(`Date ${date} is no longer available`, 'error');
                    return { success: false };
                }
            }
            
            const bookingId = this.generateBookingId();
            
            // Add to local cache
            for (const date of this.selectedDates) {
                this.bookings.push({
                    'Booking ID': bookingId,
                    'Date': date,
                    'Customer Name': bookingData.name,
                    'Email': bookingData.email,
                    'Phone': bookingData.phone || '',
                    'Guests': bookingData.guests || 1,
                    'Plan': this.planName,
                    'Plan Price': this.planPrice,
                    'Total Price': this.planPrice * this.selectedDates.length,
                    'Status': 'Confirmed',
                    'Booking Date': new Date().toISOString().split('T')[0],
                    'Special Requests': bookingData.requests || ''
                });
            }
            
            // Clear selection and refresh
            this.clearDateSelection(false);
            this.refreshCalendarData();
            
            // Show success
            this.showNotification(`Booking confirmed! Reference: ${bookingId}`, 'success');
            
            // Trigger GitHub sync in background
            if (this.githubSync) {
                this.syncToGitHub().catch(console.warn);
            }
            
            return { success: true, bookingId };
            
        } catch (error) {
            console.error('❌ Error submitting booking:', error);
            this.showNotification('Booking failed', 'error');
            return { success: false };
        }
    }

    async syncToGitHub() {
        return this.githubSync.pushBookings(this.bookings);
    }

    generateBookingId() {
        return 'SNOW-' + Math.floor(100000 + Math.random() * 900000);
    }

    refreshCalendarData() {
        this.refreshVisibleCells();
    }

    forceCalendarRefresh() {
        if (!this.calendar) return;
        const calendarEl = document.getElementById('calendar');
        const currentDate = this.calendar.getDate();
        this.calendar.destroy();
        this.initCalendar();
        this.calendar.gotoDate(currentDate);
    }

    setupEventListeners() {
        // Optional periodic refresh
        setInterval(() => {
            if (!this.isLoading) {
                this.resyncFromExcel(false).catch(console.warn);
            }
        }, 300000); // 5 minutes
    }

    async resyncFromExcel(showNotification = false) {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            await this.loadData();
            this.refreshCalendarData();
        } finally {
            this.isLoading = false;
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
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
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), duration);
    }
}

if (typeof window !== 'undefined') {
    window.BookingSystem = BookingSystem;
}