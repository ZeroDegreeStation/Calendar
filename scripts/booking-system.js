/**
 * Booking System - Core calendar and booking logic with GitHub sync
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
        this.defaultMaxBookings = 2; // Maximum number of BOOKINGS per day, not guests
        
        // Bind methods
        this.handleDateClick = this.handleDateClick.bind(this);
        this.handleDateSelect = this.handleDateSelect.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.clearDateSelection = this.clearDateSelection.bind(this);
        this.forceCalendarRefresh = this.forceCalendarRefresh.bind(this);
        this.updateBookingSummary = this.updateBookingSummary.bind(this);
        this.refreshCalendarData = this.refreshCalendarData.bind(this);
        this.syncToGitHub = this.syncToGitHub.bind(this);
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.initCalendar();
            this.setupEventListeners();
            
            // Update status
            const statusEl = document.getElementById('calendarLastUpdated');
            if (statusEl) {
                const now = new Date();
                statusEl.textContent = `Calendar ready: ${now.toLocaleDateString()}`;
            }
            
            // Check GitHub connection
            this.checkGitHubStatus();
            
            console.log('✅ BookingSystem initialized');
        } catch (error) {
            console.error('❌ Failed to initialize BookingSystem:', error);
            this.showNotification('Failed to initialize calendar', 'error');
        }
    }

    async loadData() {
        try {
            console.log('📊 Loading data from Excel...');
            
            // Load availability overrides
            const overrides = await this.excelHandler.loadAvailabilityOverrides();
            this.availabilityOverrides = overrides || [];
            
            // Load bookings
            const bookings = await this.excelHandler.loadBookings();
            this.bookings = bookings || [];
            
            console.log('📊 Data loaded:', {
                overrides: this.availabilityOverrides.length,
                bookings: this.bookings.length
            });
            
            // If no data at all, load demo data
            if (this.availabilityOverrides.length === 0 && this.bookings.length === 0) {
                console.log('⚠️ No data found, loading demo data');
                this.loadDemoData();
            }
            
            // Update status
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
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        // Create demo dates for multiple months
        const demoDates = [
            // Current month
            new Date(currentYear, currentMonth, 15),
            new Date(currentYear, currentMonth, 16),
            new Date(currentYear, currentMonth, 20),
            new Date(currentYear, currentMonth, 21),
            new Date(currentYear, currentMonth, 25),
            // Next month
            new Date(currentYear, currentMonth + 1, 5),
            new Date(currentYear, currentMonth + 1, 6),
            new Date(currentYear, currentMonth + 1, 10),
            new Date(currentYear, currentMonth + 1, 11),
            new Date(currentYear, currentMonth + 1, 15),
            new Date(currentYear, currentMonth + 1, 16),
            // Two months ahead
            new Date(currentYear, currentMonth + 2, 1),
            new Date(currentYear, currentMonth + 2, 2),
            new Date(currentYear, currentMonth + 2, 8),
            new Date(currentYear, currentMonth + 2, 9)
        ];
        
        this.availabilityOverrides = [
            // Current month - various statuses
            {
                Date: demoDates[0].toISOString().split('T')[0],
                Status: 'Limited',
                Price: 18500,
                MaxBookings: 2,
                Booked: 1,
                Available: 1,
                Notes: 'Limited availability - 1 booking taken'
            },
            {
                Date: demoDates[1].toISOString().split('T')[0],
                Status: 'Closed',
                Price: null,
                MaxBookings: 0,
                Booked: 0,
                Available: 0,
                Notes: 'Closed for maintenance'
            },
            {
                Date: demoDates[2].toISOString().split('T')[0],
                Status: 'Limited',
                Price: 22000,
                MaxBookings: 2,
                Booked: 1,
                Available: 1,
                Notes: 'Limited availability - 1 booking taken'
            },
            {
                Date: demoDates[3].toISOString().split('T')[0],
                Status: 'Booked',
                Price: 18500,
                MaxBookings: 2,
                Booked: 2,
                Available: 0,
                Notes: 'Fully booked - 2 bookings taken'
            },
            {
                Date: demoDates[4].toISOString().split('T')[0],
                Status: 'Available',
                Price: 12800,
                MaxBookings: 2,
                Booked: 0,
                Available: 2,
                Notes: 'Available - 0 bookings'
            }
        ];
        
        this.bookings = [
            {
                'Booking ID': 'DEMO-001',
                'Date': demoDates[0].toISOString().split('T')[0],
                'Customer Name': 'John Demo',
                'Email': 'john@demo.com',
                'Guests': 5, // 5 guests, but counts as 1 booking
                'Status': 'Confirmed'
            },
            {
                'Booking ID': 'DEMO-002',
                'Date': demoDates[2].toISOString().split('T')[0],
                'Customer Name': 'Jane Demo',
                'Email': 'jane@demo.com',
                'Guests': 3, // 3 guests, but counts as 1 booking
                'Status': 'Confirmed'
            },
            {
                'Booking ID': 'DEMO-003',
                'Date': demoDates[3].toISOString().split('T')[0],
                'Customer Name': 'Bob Demo',
                'Email': 'bob@demo.com',
                'Guests': 2,
                'Status': 'Confirmed'
            },
            {
                'Booking ID': 'DEMO-004',
                'Date': demoDates[3].toISOString().split('T')[0],
                'Customer Name': 'Alice Demo',
                'Email': 'alice@demo.com',
                'Guests': 4, // 4 guests, but counts as 1 booking (making total 2 bookings)
                'Status': 'Confirmed'
            }
        ];
        
        console.log('✅ Demo data loaded:', this.availabilityOverrides);
    }

    initCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        if (!calendarEl) {
            console.error('❌ Calendar element not found!');
            return;
        }

        // Clear loading indicator
        calendarEl.innerHTML = '';

        console.log('📅 Rendering calendar...');

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth'
            },
            height: 'auto',
            aspectRatio: 1.6,
            firstDay: 0,
            selectable: true,
            select: this.handleDateSelect,
            dateClick: this.handleDateClick,
            selectAllow: (info) => this.isDateSelectable(info),
            unselectAuto: false,
            dayCellDidMount: (info) => this.styleDateCell(info),
            fixedWeekCount: false,
            showNonCurrentDates: true,
            expandRows: true,
            dayMaxEvents: true,
            buttonText: {
                today: 'Today',
                month: 'Month'
            },
            datesSet: (info) => {
                // When month changes, re-style all visible cells
                console.log('📅 Month changed to:', info.view.currentStart);
                this.refreshVisibleCells();
            }
        });
        
        this.calendar.render();
        console.log('✅ Calendar rendered');
    }

    refreshVisibleCells() {
        document.querySelectorAll('.fc-daygrid-day').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr) {
                this.applyStylesToCell(cell, dateStr);
            }
        });
    }

    applyStylesToCell(cell, dateStr) {
        const today = new Date().toISOString().split('T')[0];
        const isPast = dateStr < today;
        const status = this.getDayStatus(dateStr);
        const bookingCount = this.getBookingCount(dateStr);
        const maxBookings = this.getMaxBookings(dateStr);
        const available = Math.max(0, maxBookings - bookingCount);
        
        // Remove all existing classes
        cell.classList.remove(
            'fc-day-available', 'fc-day-limited', 'fc-day-booked', 
            'fc-day-past', 'fc-day-closed'
        );
        
        if (isPast) {
            cell.classList.add('fc-day-past');
        } else {
            if (status.class === 'closed') {
                cell.classList.add('fc-day-booked');
            } else {
                cell.classList.add(`fc-day-${status.class}`);
            }
        }
        
        // Update badge
        const existingBadge = cell.querySelector('.day-badge');
        if (existingBadge) existingBadge.remove();
        
        if (!isPast) {
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            
            if (status.class === 'closed') {
                badge.textContent = 'Closed';
                badge.style.color = '#8E8E93';
            } else if (status.class === 'booked' || available <= 0) {
                badge.textContent = 'Full';
                badge.style.color = '#FF3B30';
            } else if (status.class === 'limited' || available === 1) {
                badge.textContent = '1 left';
                badge.style.color = '#FF9F0A';
            } else if (status.class === 'available') {
                badge.textContent = `${available} left`;
                badge.style.color = '#34C759';
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
        const dateStr = info.date.toISOString().split('T')[0];
        this.applyStylesToCell(info.el, dateStr);
    }

    /**
     * FIXED: Get day status based on BOOKING COUNT, not guest count
     */
    getDayStatus(dateStr) {
        // Check if date is in the past
        if (new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])) {
            return { class: 'past', label: 'Past' };
        }
        
        // Check for override in availability data
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        
        // Get booking count (number of bookings, not guests)
        const bookingCount = this.getBookingCount(dateStr);
        
        if (override) {
            // If explicitly closed, respect that
            if (override.Status === 'Closed') {
                return { class: 'closed', label: 'Closed' };
            }
            
            // Use max bookings from override or default
            const maxBookings = override.MaxBookings || this.defaultMaxBookings;
            
            // Determine status based on booking count
            if (bookingCount >= maxBookings) {
                return { class: 'booked', label: 'Fully Booked' };
            } else if (bookingCount >= 1) {
                return { class: 'limited', label: 'Limited' };
            } else {
                return { class: 'available', label: 'Available' };
            }
        }
        
        // No override - calculate from bookings only
        const maxBookings = this.defaultMaxBookings;
        
        if (bookingCount >= maxBookings) {
            return { class: 'booked', label: 'Fully Booked' };
        } else if (bookingCount >= 1) {
            return { class: 'limited', label: 'Limited' };
        } else {
            return { class: 'available', label: 'Available' };
        }
    }

    /**
     * FIXED: Get booking count - counts NUMBER OF BOOKINGS, not total guests
     */
    getBookingCount(dateStr) {
        // Count unique booking IDs for this date
        const uniqueBookings = new Set();
        
        this.bookings
            .filter(b => b.Date === dateStr && b.Status === 'Confirmed')
            .forEach(booking => {
                uniqueBookings.add(booking['Booking ID']);
            });
        
        return uniqueBookings.size;
    }

    getMaxBookings(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.MaxBookings || this.defaultMaxBookings;
    }

    getPrice(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.Price || this.defaultPrice;
    }

    isDateSelectable(info) {
        const dateStr = info.startStr.split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Can't select past dates
        if (dateStr < today) return false;
        
        const status = this.getDayStatus(dateStr);
        return !['booked', 'closed', 'past'].includes(status.class);
    }

    handleDateClick(info) {
        const dateStr = info.dateStr;
        
        if (!this.isDateSelectable(info)) {
            this.showNotification('This date is not available for booking', 'error');
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
        
        // Update booking summary
        this.updateBookingSummary();
        
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
        
        // Update booking summary
        this.updateBookingSummary();
        
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
        
        this.updateBookingSummary();
        
        // Dispatch custom event
        const event = new CustomEvent('datesSelected', { 
            detail: { dates: [] } 
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
        
        // Format selected dates text
        if (this.selectedDates.length === 1) {
            selectedDatesText.textContent = this.formatDate(this.selectedDates[0]);
        } else {
            const first = this.formatDate(this.selectedDates[0]);
            const last = this.formatDate(this.selectedDates[this.selectedDates.length - 1]);
            selectedDatesText.textContent = `${first} - ${last} (${this.selectedDates.length} nights)`;
        }
        
        // Calculate total price
        const nights = this.selectedDates.length;
        const pricePerNight = this.planPrice || this.defaultPrice;
        const roomRate = pricePerNight * nights;
        const tax = Math.round(roomRate * 0.1);
        const serviceCharge = 1000;
        const total = roomRate + tax + serviceCharge;
        
        totalPriceEl.textContent = `¥${total.toLocaleString()}`;
        
        // Show summary
        summaryEl.classList.add('visible');
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * FIXED: Update availability after booking - counts bookings, not guests
     */
    async updateAvailabilityAfterBooking(date, guests) {
        // Get current booking count (number of unique bookings for this date)
        const bookingCount = this.getBookingCount(date);
        
        // Find if date exists in availability overrides
        const existingIndex = this.availabilityOverrides.findIndex(a => a.Date === date);
        
        if (existingIndex >= 0) {
            // Update existing record with actual booking count
            this.availabilityOverrides[existingIndex].Booked = bookingCount;
            this.availabilityOverrides[existingIndex].Available = 
                Math.max(0, this.availabilityOverrides[existingIndex].MaxBookings - bookingCount);
            
            // Update status based on actual booking count
            const available = this.availabilityOverrides[existingIndex].Available;
            
            // Don't change if it was Closed
            if (this.availabilityOverrides[existingIndex].Status !== 'Closed') {
                if (available <= 0) {
                    this.availabilityOverrides[existingIndex].Status = 'Booked';
                } else if (available === 1) {
                    this.availabilityOverrides[existingIndex].Status = 'Limited';
                } else {
                    this.availabilityOverrides[existingIndex].Status = 'Available';
                }
            }
        } else {
            // Create new availability record based on actual booking count
            const maxBookings = this.defaultMaxBookings;
            const available = Math.max(0, maxBookings - bookingCount);
            
            this.availabilityOverrides.push({
                Date: date,
                Status: available <= 0 ? 'Booked' : (available === 1 ? 'Limited' : 'Available'),
                Price: this.defaultPrice,
                MaxBookings: maxBookings,
                Booked: bookingCount,
                Available: available,
                Notes: 'Auto-generated from bookings'
            });
        }
        
        console.log(`✅ Availability updated for ${date}: ${bookingCount}/${this.getMaxBookings(date)} bookings taken`);
    }

    /**
     * Submit booking and sync to GitHub
     */
    async submitBooking(bookingData) {
        try {
            console.log('📝 Processing booking...', bookingData);
            
            // Validate that selected dates are still available
            for (const date of this.selectedDates) {
                const bookingCount = this.getBookingCount(date);
                const maxBookings = this.getMaxBookings(date);
                
                if (bookingCount >= maxBookings) {
                    this.showNotification(`Date ${date} is no longer available`, 'error');
                    this.refreshCalendarData();
                    return { success: false, error: 'Date no longer available' };
                }
            }
            
            const bookingId = this.generateBookingId();
            const newBookings = [];
            
            for (const date of this.selectedDates) {
                const booking = {
                    'Booking ID': bookingId, // Same ID for all dates in this booking
                    'Date': date,
                    'Customer Name': bookingData.name,
                    'Email': bookingData.email,
                    'Phone': bookingData.phone || '',
                    'Guests': bookingData.guests || 1, // Store guest count for reference
                    'Plan': this.planName,
                    'Plan Price': this.planPrice,
                    'Total Price': this.planPrice,
                    'Status': 'Confirmed',
                    'Booking Date': new Date().toISOString().split('T')[0],
                    'Special Requests': bookingData.requests || ''
                };
                
                this.bookings.push(booking);
                newBookings.push(booking);
            }
            
            console.log('✅ Bookings saved locally:', newBookings.length);
            
            // Update availability for each date based on booking COUNT (not guests)
            for (const date of this.selectedDates) {
                await this.updateAvailabilityAfterBooking(date, bookingData.guests || 1);
            }
            
            // Clear selection
            this.clearDateSelection(false);
            
            // Refresh calendar to show updated availability
            this.refreshCalendarData();
            
            // Show success message
            this.showNotification(`Booking confirmed! Reference: ${bookingId}`, 'success');
            
            // Sync to GitHub (don't await - let it happen in background)
            this.syncToGitHub().then(success => {
                if (success) {
                    console.log('📤 GitHub sync completed');
                } else {
                    console.log('⚠️ GitHub sync failed - data saved locally');
                }
            });
            
            return { success: true, bookingId };
            
        } catch (error) {
            console.error('❌ Error submitting booking:', error);
            this.showNotification('Booking failed. Please try again.', 'error');
            return { success: false, error };
        }
    }

    /**
     * Sync all data to GitHub
     */
    async syncToGitHub() {
        try {
            // Check if token exists
            if (!this.githubSync.hasToken()) {
                console.log('⚠️ No GitHub token, skipping sync');
                return false;
            }
            
            // Show syncing notification
            this.showNotification('Syncing to GitHub...', 'info');
            
            // Push both files
            const bookingsResult = await this.githubSync.pushBookings(this.bookings);
            const availabilityResult = await this.githubSync.pushAvailability(this.availabilityOverrides);
            
            if (bookingsResult && availabilityResult) {
                console.log('✅ Successfully synced all data to GitHub');
                this.showNotification('Booking synced to GitHub successfully!', 'success');
                return true;
            } else {
                console.warn('⚠️ GitHub sync failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to sync to GitHub:', error);
            return false;
        }
    }

    /**
     * Check GitHub connection status
     */
    async checkGitHubStatus() {
        try {
            const connected = await this.githubSync.checkConnection();
            const statusEl = document.querySelector('.github-status .status-dot');
            const textEl = document.querySelector('.github-status span:last-child');
            
            if (statusEl && textEl) {
                if (connected) {
                    statusEl.style.background = '#34C759';
                    textEl.textContent = 'GitHub Connected';
                } else {
                    statusEl.style.background = '#FF9F0A';
                    textEl.textContent = 'GitHub Disconnected';
                }
            }
        } catch (error) {
            console.error('Failed to check GitHub status:', error);
        }
    }

    /**
     * Refresh calendar data
     */
    refreshCalendarData() {
        console.log('🔄 Refreshing calendar data...');
        
        // Update status display
        const statusEl = document.getElementById('calendarLastUpdated');
        if (statusEl) {
            const now = new Date();
            statusEl.textContent = `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
            statusEl.style.color = '#27ae60';
        }
        
        // Refresh all visible cells
        this.refreshVisibleCells();
        
        console.log('✅ Calendar data refreshed');
    }

    generateBookingId() {
        return 'SNOW-' + Math.floor(100000 + Math.random() * 900000);
    }

    forceCalendarRefresh() {
        console.log('🔄 Force refreshing calendar...');
        
        if (!this.calendar) return;
        
        try {
            const calendarEl = document.getElementById('calendar');
            
            this.calendar.destroy();
            
            this.calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth'
                },
                height: 'auto',
                aspectRatio: 1.6,
                firstDay: 0,
                selectable: true,
                select: this.handleDateSelect,
                dateClick: this.handleDateClick,
                selectAllow: (info) => this.isDateSelectable(info),
                unselectAuto: false,
                dayCellDidMount: (info) => this.styleDateCell(info),
                fixedWeekCount: false,
                showNonCurrentDates: true,
                expandRows: true,
                dayMaxEvents: true,
                buttonText: {
                    today: 'Today',
                    month: 'Month'
                },
                datesSet: (info) => {
                    this.refreshVisibleCells();
                }
            });
            
            this.calendar.render();
            console.log('✅ Calendar re-rendered successfully');
            
        } catch (error) {
            console.error('❌ Failed to refresh calendar:', error);
        }
    }

    setupEventListeners() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Handle modal closing
            }
        });
    }

    showNotification(message, type = 'info') {
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
        `;
        
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
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