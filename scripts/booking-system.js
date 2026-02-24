/**
 * Booking System - Core calendar and booking logic
 * FIXED: Proper Excel file path and handleDateClick error
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
            if (this.githubSync && this.githubSync.hasReadToken()) {
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
            
            // Log the actual data for debugging
            console.log('📅 Availability from Excel:', this.availabilityOverrides);
            console.log('📅 Bookings from Excel:', this.bookings);
            
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
        const today = new Date();
        
        // Generate demo availability
        this.availabilityOverrides = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const year = date.getFullYear();
            const dateStr = `${month}/${day}/${year}`;
            
            let status = 'Available';
            let booked = 0;
            
            if (i % 5 === 0) {
                status = 'Limited';
                booked = 1;
            }
            if (i % 7 === 0) {
                status = 'Booked';
                booked = 2;
            }
            
            this.availabilityOverrides.push({
                Date: dateStr,
                Status: status,
                Price: 12800,
                MaxBookings: 2,
                Booked: booked
            });
        }
        
        this.bookings = [];
        console.log('✅ Demo data loaded');
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
            select: this.handleDateSelect.bind(this),
            dateClick: this.handleDateClick.bind(this),
            selectAllow: (info) => true,
            dayCellDidMount: (info) => this.styleDateCell(info),
            datesSet: () => this.refreshVisibleCells(),
            longPressDelay: 100,
            eventLongPressDelay: 100,
            selectLongPressDelay: 100,
            unselectAuto: false
        });
        
        this.calendar.render();
        console.log('✅ Calendar rendered');
    }

    refreshVisibleCells() {
        document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr) this.applyStylesToCell(cell, dateStr);
        });
    }

    /**
     * Convert YYYY-MM-DD (from calendar) to MM/DD/YYYY (from Excel)
     */
    convertToExcelFormat(dateStr) {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        // Remove leading zeros from month and day
        const monthNoZero = parseInt(month, 10).toString();
        const dayNoZero = parseInt(day, 10).toString();
        return `${monthNoZero}/${dayNoZero}/${year}`;
    }

    applyStylesToCell(cell, dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cellDate = new Date(dateStr);
        cellDate.setHours(0, 0, 0, 0);
        
        const isPast = cellDate < today;
        
        // Convert calendar date to Excel format for lookup
        const excelDateStr = this.convertToExcelFormat(dateStr);
        const status = this.getDayStatus(excelDateStr);
        const available = this.getAvailableSpots(excelDateStr);
        
        // Remove all existing classes
        cell.classList.remove(
            'fc-day-available', 'fc-day-limited', 'fc-day-booked', 
            'fc-day-past', 'fc-day-closed'
        );
        
        if (isPast) {
            cell.classList.add('fc-day-past');
        } else {
            const statusLower = (status || '').toLowerCase();
            if (statusLower === 'closed' || statusLower === 'booked') {
                cell.classList.add('fc-day-booked');
            } else if (statusLower === 'limited') {
                cell.classList.add('fc-day-limited');
            } else {
                cell.classList.add('fc-day-available');
            }
        }
        
        // Update badge
        const existingBadge = cell.querySelector('.day-badge');
        if (existingBadge) existingBadge.remove();
        
        if (!isPast) {
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            
            const statusLower = (status || '').toLowerCase();
            
            if (statusLower === 'closed') {
                badge.textContent = 'Closed';
                badge.style.backgroundColor = '#8E8E93';
                badge.style.color = 'white';
            } else if (statusLower === 'booked' || available <= 0) {
                badge.textContent = 'Full';
                badge.style.backgroundColor = '#FF3B30';
                badge.style.color = 'white';
            } else if (statusLower === 'limited' || available === 1) {
                badge.textContent = '1 left';
                badge.style.backgroundColor = '#FF9F0A';
                badge.style.color = 'white';
            } else {
                badge.textContent = `${available} left`;
                badge.style.backgroundColor = '#34C759';
                badge.style.color = 'white';
            }
            
            cell.appendChild(badge);
        }
        
        // Add selected class if needed
        if (this.selectedDates && this.selectedDates.includes(dateStr)) {
            cell.classList.add('fc-day-selected');
        } else {
            cell.classList.remove('fc-day-selected');
        }
    }

    styleDateCell(info) {
        this.applyStylesToCell(info.el, info.date.toISOString().split('T')[0]);
    }

    getDayStatus(excelDateStr) {
        if (!excelDateStr) return 'unknown';
        
        // Find matching override in Excel data (already in MM/DD/YYYY format)
        const override = this.availabilityOverrides.find(o => o.Date === excelDateStr);
        
        if (override) {
            console.log(`📅 Date ${excelDateStr} found in Excel: ${override.Status}`);
            return override.Status || 'Available';
        }
        
        console.log(`📅 Date ${excelDateStr} not found in Excel, defaulting to Available`);
        return 'Available';
    }

    getAvailableSpots(excelDateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === excelDateStr);
        if (override) {
            const maxBookings = override.MaxBookings || this.defaultMaxBookings;
            const booked = override.Booked || 0;
            return Math.max(0, maxBookings - booked);
        }
        return this.defaultMaxBookings;
    }

    isDateSelectable(dateInput) {
        // Handle both string dates and info objects
        let dateStr;
        if (typeof dateInput === 'string') {
            dateStr = dateInput;
        } else if (dateInput && dateInput.startStr) {
            dateStr = dateInput.startStr.split('T')[0];
        } else {
            console.log('Invalid date input:', dateInput);
            return false;
        }
        
        if (!dateStr) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const checkDate = new Date(dateStr);
        checkDate.setHours(0, 0, 0, 0);
        
        // Past dates are not selectable
        if (checkDate < today) return false;
        
        // Convert to Excel format for lookup
        const excelDateStr = this.convertToExcelFormat(dateStr);
        const status = this.getDayStatus(excelDateStr);
        const available = this.getAvailableSpots(excelDateStr);
        
        const statusLower = (status || '').toLowerCase();
        const isSelectable = statusLower === 'available' || 
                            statusLower === 'limited' || 
                            available > 0;
        
        console.log(`📅 ${dateStr} (Excel: ${excelDateStr}): status=${status}, available=${available}, selectable=${isSelectable}`);
        
        return isSelectable;
    }

    // FIXED: Added null check for info.el
    handleDateClick(info) {
        console.log('Date clicked:', info.dateStr);
        
        // Check if info.el exists
        if (!info || !info.el) {
            console.error('Invalid click info:', info);
            return;
        }
        
        if (!this.isDateSelectable(info.dateStr)) {
            this.showNotification('This date is not available for booking', 'error');
            return;
        }
        
        const dateStr = info.dateStr;
        const index = this.selectedDates.indexOf(dateStr);
        
        if (index === -1) {
            this.selectedDates.push(dateStr);
            // FIXED: Only try to add class if el exists
            if (info.el) {
                info.el.classList.add('fc-day-selected');
            }
            this.showNotification(`Date added: ${this.formatDate(dateStr)}`, 'success');
        } else {
            this.selectedDates.splice(index, 1);
            // FIXED: Only try to remove class if el exists
            if (info.el) {
                info.el.classList.remove('fc-day-selected');
            }
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
        console.log('Date range selected:', info.startStr, 'to', info.endStr);
        
        const start = info.startStr.split('T')[0];
        const end = info.endStr.split('T')[0];
        
        this.clearDateSelection(false);
        
        let current = new Date(start);
        const endDate = new Date(end);
        let addedCount = 0;
        
        while (current < endDate) {
            const dateStr = current.toISOString().split('T')[0];
            if (this.isDateSelectable(dateStr)) {
                this.selectedDates.push(dateStr);
                addedCount++;
            }
            current.setDate(current.getDate() + 1);
        }
        
        this.selectedDates.sort();
        this.updateSelectedCells();
        this.updateBookingSummary();
        
        if (addedCount > 0) {
            this.showNotification(`Selected ${addedCount} nights`, 'success');
        }
        
        const event = new CustomEvent('datesSelected', { 
            detail: { 
                dates: this.selectedDates,
                checkin: this.selectedDates[0] || null,
                checkout: this.getCheckoutDate()
            } 
        });
        document.dispatchEvent(event);
    }

    updateSelectedCells() {
        document.querySelectorAll('.fc-day-selected').forEach(el => {
            el.classList.remove('fc-day-selected');
        });
        
        this.selectedDates.forEach(dateStr => {
            const cell = document.querySelector(`[data-date="${dateStr}"]`);
            if (cell) cell.classList.add('fc-day-selected');
        });
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
        
        const event = new CustomEvent('datesSelected', { 
            detail: { 
                dates: [],
                checkin: null,
                checkout: null
            } 
        });
        document.dispatchEvent(event);
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
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    async submitBooking(bookingData) {
        try {
            console.log('📝 Processing booking...', bookingData);
            
            // Validate availability
            for (const date of this.selectedDates) {
                if (!this.isDateSelectable(date)) {
                    this.showNotification(`Date ${date} is no longer available`, 'error');
                    return { success: false };
                }
            }
            
            const bookingId = this.generateBookingId();
            
            // Add to local cache
            for (const date of this.selectedDates) {
                const excelDate = this.convertToExcelFormat(date);
                this.bookings.push({
                    'Booking ID': bookingId,
                    'Date': excelDate,
                    'Customer Name': bookingData.name,
                    'Email': bookingData.email,
                    'Phone': bookingData.phone || '',
                    'Guests': bookingData.guests || 1,
                    'Plan': this.planName,
                    'Plan Price': this.planPrice,
                    'Total Price': this.planPrice * this.selectedDates.length,
                    'Status': 'Confirmed',
                    'Booking Date': new Date().toLocaleDateString('en-US'),
                    'Special Requests': bookingData.requests || ''
                });
            }
            
            // Clear selection and refresh
            this.clearDateSelection(false);
            this.refreshCalendarData();
            
            // Show success
            this.showNotification(`Booking confirmed! Reference: ${bookingId}`, 'success');
            
            // Trigger GitHub sync
            if (this.githubSync && this.githubSync.hasReadToken()) {
                this.syncToGitHubWithRetry(3).catch(console.warn);
            } else {
                console.log('ℹ️ No GitHub token - booking saved locally only');
            }
            
            return { success: true, bookingId };
            
        } catch (error) {
            console.error('❌ Error submitting booking:', error);
            this.showNotification('Booking failed', 'error');
            return { success: false };
        }
    }

    async syncToGitHubWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (i > 0) {
                    console.log(`🔄 Retry ${i + 1}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 1000 * i));
                }
                
                const success = await this.githubSync.pushBookings(this.bookings);
                if (success) return true;
                
            } catch (error) {
                console.warn(`⚠️ Sync attempt ${i + 1} failed:`, error);
            }
        }
        return false;
    }

    generateBookingId() {
        const prefix = 'SNOW';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${prefix}-${timestamp}${random}`;
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
        if (currentDate) this.calendar.gotoDate(currentDate);
    }

    setupEventListeners() {
        setInterval(() => {
            if (!this.isLoading) {
                this.resyncFromExcel(false).catch(console.warn);
            }
        }, 300000);
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
        console.log(`[${type}] ${message}`);
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            max-width: 90%;
            word-break: break-word;
        `;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), duration);
    }
}

if (typeof window !== 'undefined') {
    window.BookingSystem = BookingSystem;
}