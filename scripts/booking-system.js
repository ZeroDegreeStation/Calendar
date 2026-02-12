/**
 * Booking System - Main calendar and booking logic
 * Dependencies: ExcelHandler, FullCalendar
 */
class BookingSystem {
    constructor() {
        // Initialize handlers
        this.excelHandler = new ExcelHandler();
        this.githubSync = new GitHubSync();
        
        // State
        this.calendar = null;
        this.availabilityOverrides = [];
        this.bookings = [];
        this.timeSlots = [];
        this.selectedDates = [];
        this.currentBookingId = null;
        
        // Configuration
        this.defaultPrice = 100;
        this.defaultMaxBookings = 10;
        
        // Initialize
        this.init();
    }

    /**
     * Initialize the booking system
     */
    async init() {
        await this.loadData();
        this.initCalendar();
        this.updateStats();
        this.setupEventListeners();
        this.checkGitHubStatus();
    }

    /**
     * Load all data from Excel files
     */
    async loadData() {
        try {
            // Load data in parallel
            const [overrides, bookings, timeSlots] = await Promise.all([
                this.excelHandler.loadAvailabilityOverrides(),
                this.excelHandler.loadBookings(),
                this.excelHandler.loadTimeSlots()
            ]);
            
            this.availabilityOverrides = overrides || [];
            this.bookings = bookings || [];
            this.timeSlots = timeSlots || this.excelHandler.getDefaultTimeSlots();
            
            console.log('Data loaded:', {
                overrides: this.availabilityOverrides.length,
                bookings: this.bookings.length,
                timeSlots: this.timeSlots.length
            });
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data', 'error');
        }
    }

    /**
     * Initialize FullCalendar
     */
    initCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            dateCellDidMount: (info) => this.styleDateCell(info),
            dateClick: (info) => this.handleDateClick(info),
            selectable: true,
            select: (info) => this.handleDateSelect(info),
            selectAllow: (info) => this.isDateSelectable(info),
            unselectAuto: false,
            dayMaxEvents: true,
            height: 'auto',
            aspectRatio: 1.8,
            firstDay: 0,
            buttonText: {
                today: 'Today',
                month: 'Month',
                week: 'Week'
            }
        });
        
        this.calendar.render();
    }

    /**
     * Style individual date cells
     */
    styleDateCell(info) {
        const dateStr = info.date.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const isPast = info.date < new Date(today);
        
        // Get day status
        const status = this.getDayStatus(dateStr);
        
        // Add status class
        if (isPast) {
            info.el.classList.add('fc-day-past');
        } else {
            info.el.classList.add(`fc-day-${status.class}`);
        }
        
        // Add booking count badge
        if (!isPast && status.class !== 'closed' && status.class !== 'booked') {
            const bookingCount = this.getBookingCount(dateStr);
            const maxBookings = this.getMaxBookings(dateStr);
            const available = maxBookings - bookingCount;
            
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            badge.innerHTML = `<span style="color: ${this.getStatusColor(status.class)}">${available}/${maxBookings}</span>`;
            info.el.appendChild(badge);
        }
        
        // Add price if available
        if (!isPast && status.class !== 'closed' && status.class !== 'booked') {
            const price = this.getPrice(dateStr);
            const priceEl = document.createElement('div');
            priceEl.className = 'text-xs text-gray-500 mt-1';
            priceEl.textContent = `$${price}`;
            info.el.querySelector('.fc-daygrid-day-frame')?.appendChild(priceEl);
        }
        
        // Highlight if selected
        if (this.selectedDates.includes(dateStr)) {
            info.el.classList.add('fc-day-selected');
        }
    }

    /**
     * Get day status based on overrides and bookings
     */
    getDayStatus(dateStr) {
        // Check if date is in the past
        if (new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])) {
            return { class: 'past', label: 'Past' };
        }
        
        // Check for override
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        if (override) {
            if (override.Status === 'Closed') return { class: 'closed', label: 'Closed' };
            if (override.Status === 'Booked') return { class: 'booked', label: 'Fully Booked' };
            if (override.Status === 'Limited') return { class: 'limited', label: 'Limited' };
        }
        
        // Calculate booking percentage
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

    /**
     * Get booking count for a specific date
     */
    getBookingCount(dateStr) {
        return this.bookings
            .filter(b => b.Date === dateStr && b.Status === 'Confirmed')
            .reduce((total, booking) => total + (parseInt(booking.Guests) || 1), 0);
    }

    /**
     * Get maximum bookings for a date
     */
    getMaxBookings(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.MaxBookings || this.defaultMaxBookings;
    }

    /**
     * Get price for a date
     */
    getPrice(dateStr) {
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        return override?.Price || this.defaultPrice;
    }

    /**
     * Get status color for CSS
     */
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

    /**
     * Check if date is selectable
     */
    isDateSelectable(info) {
        const dateStr = info.startStr.split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Can't select past dates
        if (dateStr < today) return false;
        
        // Check availability
        const status = this.getDayStatus(dateStr);
        return !['booked', 'closed', 'past'].includes(status.class);
    }

    /**
     * Handle date click
     */
    handleDateClick(info) {
        if (!this.isDateSelectable(info)) {
            this.showNotification('This date is not available for booking', 'error');
            return;
        }
        
        const dateStr = info.dateStr;
        const index = this.selectedDates.indexOf(dateStr);
        
        if (index === -1) {
            // Add date
            this.selectedDates.push(dateStr);
            info.el.classList.add('fc-day-selected');
        } else {
            // Remove date
            this.selectedDates.splice(index, 1);
            info.el.classList.remove('fc-day-selected');
        }
        
        this.selectedDates.sort();
        this.updateBookingSummary();
    }

    /**
     * Handle date range selection
     */
    handleDateSelect(info) {
        const start = info.startStr.split('T')[0];
        const end = info.endStr.split('T')[0];
        
        // Clear existing selection
        this.clearDateSelection();
        
        // Add all dates in range
        let current = new Date(start);
        while (current.toISOString().split('T')[0] < end) {
            const dateStr = current.toISOString().split('T')[0];
            
            if (this.isDateSelectable({ startStr: dateStr })) {
                this.selectedDates.push(dateStr);
                
                // Highlight the cell
                const dayCell = document.querySelector(`[data-date="${dateStr}"]`);
                if (dayCell) {
                    dayCell.classList.add('fc-day-selected');
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        this.selectedDates.sort();
        this.updateBookingSummary();
    }

    /**
     * Clear all selected dates
     */
    clearDateSelection() {
        this.selectedDates = [];
        document.querySelectorAll('.fc-day-selected').forEach(el => {
            el.classList.remove('fc-day-selected');
        });
        this.updateBookingSummary();
    }

    /**
     * Update booking summary bar
     */
    updateBookingSummary() {
        const summaryEl = document.getElementById('bookingSummary');
        const selectedDatesText = document.getElementById('selectedDatesText');
        const totalPriceEl = document.getElementById('totalPrice');
        const bookNowBtn = document.getElementById('bookNowBtn');
        
        if (this.selectedDates.length === 0) {
            summaryEl.classList.remove('visible');
            summaryEl.classList.add('hidden');
            return;
        }
        
        // Update text
        const dateRange = this.getDateRangeText();
        selectedDatesText.textContent = dateRange;
        
        // Update price
        const totalPrice = this.selectedDates.reduce((sum, date) => sum + this.getPrice(date), 0);
        totalPriceEl.textContent = `$${totalPrice}`;
        
        // FIXED: Ensure booking button is enabled and visible
        if (bookNowBtn) {
            bookNowBtn.disabled = false;
            bookNowBtn.style.opacity = '1';
            bookNowBtn.style.cursor = 'pointer';
        }
        // Show summary
        summaryEl.classList.remove('hidden');
        summaryEl.classList.add('visible');
    }

    /**
     * Clear all selected dates - FIXED to properly update UI
     */
    clearDateSelection() {
        this.selectedDates = [];
        
        // Remove highlight from all calendar cells
        document.querySelectorAll('.fc-day-selected').forEach(el => {
            el.classList.remove('fc-day-selected');
        });
        
        // Hide booking summary
        const summaryEl = document.getElementById('bookingSummary');
        if (summaryEl) {
            summaryEl.classList.remove('visible');
            summaryEl.classList.add('hidden');
        }
        
        // Update selected dates text
        const selectedDatesText = document.getElementById('selectedDatesText');
        if (selectedDatesText) {
            selectedDatesText.textContent = 'No dates selected';
        }
        
        console.log('Date selection cleared');
    }

    /**
     * Get formatted date range text
     */
    getDateRangeText() {
        if (this.selectedDates.length === 1) {
            return this.excelHandler.formatDisplayDate(this.selectedDates[0]);
        }
        
        const first = new Date(this.selectedDates[0]);
        const last = new Date(this.selectedDates[this.selectedDates.length - 1]);
        
        return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${this.selectedDates.length} days)`;
    }

    /**
     * Open booking modal
     */
    openBookingModal() {
        if (this.selectedDates.length === 0) {
            this.showNotification('Please select at least one date', 'error');
            return;
        }
        
        // Check if selected dates are still available
        const unavailableDates = this.selectedDates.filter(date => {
            const status = this.getDayStatus(date);
            return !['available', 'limited'].includes(status.class);
        });
    
        if (unavailableDates.length > 0) {
            this.showNotification(`Some dates are no longer available: ${unavailableDates.join(', ')}`, 'error');
            // Remove unavailable dates from selection
            this.selectedDates = this.selectedDates.filter(date => !unavailableDates.includes(date));
            this.updateBookingSummary();
            return;
        }
    
        const modal = document.getElementById('bookingModal');
        if (!modal) {
            console.error('Booking modal not found');
            return;
        }
    
        const selectedDatesEl = document.getElementById('modalSelectedDates');
        const priceBreakdownEl = document.getElementById('priceBreakdown');
    
        if (!selectedDatesEl || !priceBreakdownEl) {
            console.error('Modal elements not found');
            return;
        }
        // Populate selected dates
        const totalNights = this.selectedDates.length;
        const totalPrice = this.selectedDates.reduce((sum, date) => sum + this.getPrice(date), 0);
        
        selectedDatesEl.innerHTML = `
            <div class="selected-dates-header">
                <i class="fas fa-calendar-alt"></i>
                <div>
                    <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Selected Dates</h3>
                    <p style="opacity: 0.9;">${totalNights} ${totalNights === 1 ? 'day' : 'days'}</p>
                </div>
            </div>
            <div class="dates-list">
                ${this.selectedDates.map(date => `
                    <span class="date-badge">
                        ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                `).join('')}
            </div>
        `;
        
        // Populate price breakdown
        priceBreakdownEl.innerHTML = `
            <h4 style="font-weight: 600; margin-bottom: 12px;">Price Breakdown</h4>
            ${this.selectedDates.map(date => `
                <div class="price-item">
                    <span>${this.excelHandler.formatDisplayDate(date)}</span>
                    <span style="font-weight: 500;">$${this.getPrice(date)}</span>
                </div>
            `).join('')}
            <div class="price-total">
                <span>Total</span>
                <span>$${totalPrice}</span>
            </div>
        `;
        
        modal.classList.add('visible');
    }

    /**
     * Close booking modal
     */
    closeModal() {
        document.getElementById('bookingModal').classList.remove('visible');
        document.getElementById('bookingForm').reset();
    }

    /**
     * Submit booking
     */
    async submitBooking() {
        // Get form data
        const customerName = document.getElementById('customerName').value;
        const customerEmail = document.getElementById('customerEmail').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const guests = document.getElementById('guests').value;
        const specialRequests = document.getElementById('specialRequests').value;
        
        // Validate
        if (!customerName || !customerEmail) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Generate booking ID
        const bookingId = this.generateBookingId();
        
        // Create booking for each selected date
        const newBookings = [];
        for (const date of this.selectedDates) {
            const booking = {
                'Booking ID': bookingId,
                'Date': date,
                'Customer Name': customerName,
                'Email': customerEmail,
                'Phone': customerPhone || '',
                'Guests': parseInt(guests) || 1,
                'Total Price': this.getPrice(date),
                'Status': 'Confirmed',
                'Booking Date': new Date().toISOString().split('T')[0],
                'Special Requests': specialRequests || ''
            };
            
            this.bookings.push(booking);
            newBookings.push(booking);
            
            // Update availability
            await this.excelHandler.updateAvailability(date, parseInt(guests) || 1);
        }
        
        // Save to GitHub
        try {
            await this.githubSync.pushBookings(this.bookings);
        } catch (error) {
            console.error('GitHub sync failed:', error);
        }
        
        // Clear selection
        this.clearDateSelection();
        
        // Close modal
        this.closeModal();
        
        // Show confirmation
        this.showConfirmation({
            bookingId,
            customerName,
            customerEmail,
            dates: this.selectedDates,
            totalNights: this.selectedDates.length,
            totalPrice: this.selectedDates.reduce((sum, date) => sum + this.getPrice(date), 0)
        });
        
        // Refresh calendar
        this.calendar.refetchEvents();
        
        // Update stats
        this.updateStats();
        
        this.showNotification('Booking confirmed successfully!', 'success');
    }

    /**
     * Generate unique booking ID
     */
    generateBookingId() {
        const prefix = 'BKG';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * Show confirmation modal
     */
    showConfirmation(data) {
        const modal = document.getElementById('confirmationModal');
        const details = document.getElementById('confirmationDetails');
        const bookingIdEl = document.getElementById('confirmationBookingId');
        
        this.currentBookingId = data.bookingId;
        
        details.innerHTML = `
            <p style="margin-bottom: 8px;">Thank you, <strong>${data.customerName}</strong>!</p>
            <p>Your booking for <strong>${data.totalNights} ${data.totalNights === 1 ? 'day' : 'days'}</strong> is confirmed.</p>
            <p style="margin-top: 12px; font-size: 24px; font-weight: 700; color: #34C759;">$${data.totalPrice}</p>
        `;
        
        bookingIdEl.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Booking Reference</div>
                <div style="font-size: 18px; font-weight: 700; letter-spacing: 1px;">${data.bookingId}</div>
                <div style="font-size: 12px; color: #666; margin-top: 8px;">Confirmation sent to ${data.customerEmail}</div>
            </div>
        `;
        
        modal.classList.add('visible');
    }

    /**
     * Close confirmation modal
     */
    closeConfirmation() {
        document.getElementById('confirmationModal').classList.remove('visible');
        this.currentBookingId = null;
    }

    /**
     * View my bookings
     */
    viewBookings() {
        this.closeConfirmation();
        this.showMyBookings();
    }

    /**
     * Show my bookings modal
     */
    showMyBookings() {
        const modal = document.getElementById('myBookingsModal');
        const bookingsList = document.getElementById('bookingsList');
        
        // Group bookings by ID
        const groupedBookings = {};
        this.bookings.forEach(booking => {
            if (!groupedBookings[booking['Booking ID']]) {
                groupedBookings[booking['Booking ID']] = {
                    ...booking,
                    dates: []
                };
            }
            groupedBookings[booking['Booking ID']].dates.push(booking.Date);
        });
        
        // Sort by date (newest first)
        const sortedBookings = Object.values(groupedBookings).sort((a, b) => 
            new Date(b['Booking Date']) - new Date(a['Booking Date'])
        );
        
        if (sortedBookings.length === 0) {
            bookingsList.innerHTML = `
                <div style="text-align: center; padding: 48px 0;">
                    <i class="fas fa-calendar-times" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></i>
                    <p style="color: #666;">No bookings yet</p>
                </div>
            `;
        } else {
            bookingsList.innerHTML = `
                <div class="bookings-list">
                    ${sortedBookings.map(booking => `
                        <div class="booking-card">
                            <div class="booking-header">
                                <span class="booking-id-badge">${booking['Booking ID']}</span>
                                <span class="booking-status">${booking.Status}</span>
                            </div>
                            <div class="booking-details">
                                <div class="booking-detail-item">
                                    <span class="booking-detail-label">Customer</span>
                                    <span class="booking-detail-value">${booking['Customer Name']}</span>
                                </div>
                                <div class="booking-detail-item">
                                    <span class="booking-detail-label">Email</span>
                                    <span class="booking-detail-value">${booking.Email}</span>
                                </div>
                                <div class="booking-detail-item">
                                    <span class="booking-detail-label">Dates</span>
                                    <span class="booking-detail-value">${booking.dates.length} days</span>
                                </div>
                                <div class="booking-detail-item">
                                    <span class="booking-detail-label">Guests</span>
                                    <span class="booking-detail-value">${booking.Guests}</span>
                                </div>
                            </div>
                            <div class="booking-footer">
                                <span style="color: #666; font-size: 14px;">${booking['Booking Date']}</span>
                                <span class="booking-price">$${booking['Total Price']}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        modal.classList.add('visible');
    }

    /**
     * Close my bookings modal
     */
    closeMyBookings() {
        document.getElementById('myBookingsModal').classList.remove('visible');
    }

    /**
     * Update statistics dashboard
     */
    updateStats() {
        const statsContainer = document.getElementById('statsDashboard');
        const today = new Date().toISOString().split('T')[0];
        
        // Calculate stats
        const totalBookings = this.bookings.length;
        const totalRevenue = this.bookings.reduce((sum, b) => sum + (parseInt(b['Total Price']) || 0), 0);
        const uniqueCustomers = [...new Set(this.bookings.map(b => b.Email))].length;
        
        // Count available days in next 30 days
        let availableDays = 0;
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const status = this.getDayStatus(dateStr);
            if (['available', 'limited'].includes(status.class)) {
                availableDays++;
            }
        }
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(66, 133, 244, 0.1); color: #4285F4;">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Bookings</h3>
                    <p>${totalBookings}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(52, 199, 89, 0.1); color: #34C759;">
                    <i class="fas fa-dollar-sign"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Revenue</h3>
                    <p>$${totalRevenue}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(175, 82, 222, 0.1); color: #AF52DE;">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-info">
                    <h3>Customers</h3>
                    <p>${uniqueCustomers}</p>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(255, 159, 10, 0.1); color: #FF9F0A;">
                    <i class="fas fa-sun"></i>
                </div>
                <div class="stat-info">
                    <h3>Available Days</h3>
                    <p>${availableDays}</p>
                </div>
            </div>
        `;
    }

    /**
     * Check GitHub connection status
     */
    async checkGitHubStatus() {
        const statusEl = document.querySelector('.github-status .status-dot');
        const statusText = document.querySelector('.github-status span:last-child');
        
        try {
            const isConnected = await this.githubSync.checkConnection();
            
            if (isConnected) {
                statusEl.style.background = '#34C759';
                statusText.textContent = 'Connected to GitHub';
            } else {
                statusEl.style.background = '#FF3B30';
                statusText.textContent = 'GitHub Disconnected';
            }
        } catch (error) {
            statusEl.style.background = '#FF9F0A';
            statusText.textContent = 'GitHub Sync Paused';
        }
    }

    /**
     * Refresh all data from GitHub
     */
    async refreshData() {
        this.showNotification('Syncing with GitHub...', 'info');
        
        try {
            await this.loadData();
            this.calendar.refetchEvents();
            this.updateStats();
            this.clearDateSelection();
            this.showNotification('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showNotification('Sync failed', 'error');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
        
        // Book now button
        document.getElementById('bookNowBtn')?.addEventListener('click', () => this.openBookingModal());
        
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeConfirmation();
                this.closeMyBookings();
            }
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('visible');
                }
            });
        });
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.BookingSystem = BookingSystem;
}