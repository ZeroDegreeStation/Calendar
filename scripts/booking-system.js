/**
 * Booking System - Core calendar and booking logic
 * FIXED: Proper date conversion from YYYY-MM-DD to MM/DD/YYYY
 */
class BookingSystem {
    constructor() {
        console.log('🚀 Initializing BookingSystem...');
        
        this.excelHandler = new ExcelHandler();
        this.githubSync = new GitHubSync();
        
        this.calendar = null;
        this.availabilityOverrides = []; // Static from Excel
        this.bookings = []; // Dynamic from Excel
        this.selectedDates = [];
        this.selectedPlan = null;
        this.planPrice = 0;
        this.planName = '';
        
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 2;
        
        // Bind methods
        this.handleDateClick = this.handleDateClick.bind(this);
        this.handleDateSelect = this.handleDateSelect.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.clearDateSelection = this.clearDateSelection.bind(this);
        this.forceCalendarRefresh = this.forceCalendarRefresh.bind(this);
        this.updateBookingSummary = this.updateBookingSummary.bind(this);
        this.refreshCalendarData = this.refreshCalendarData.bind(this);
        this.syncToGitHub = this.syncToGitHub.bind(this);
        this.resyncFromExcel = this.resyncFromExcel.bind(this);
        
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
            
            // Load availability overrides from Excel
            const overrides = await this.excelHandler.loadAvailabilityOverrides();
            this.availabilityOverrides = overrides || [];
            
            // Load bookings from Excel
            const bookings = await this.excelHandler.loadBookings();
            this.bookings = bookings || [];
            
            console.log('📊 Data loaded:', {
                overrides: this.availabilityOverrides.length,
                bookings: this.bookings.length
            });
            
            // Log the actual data for debugging
            console.log('📅 Availability Overrides:', JSON.stringify(this.availabilityOverrides, null, 2));
            console.log('📅 Bookings:', JSON.stringify(this.bookings, null, 2));
            
            // If no data at all, load demo data
            if (this.availabilityOverrides.length === 0 && this.bookings.length === 0) {
                console.log('⚠️ No data found, loading demo data');
                this.loadDemoData();
            }
            
            // Update status
            const statusEl = document.getElementById('calendarLastUpdated');
            if (statusEl) {
                statusEl.textContent = `Loaded: ${this.availabilityOverrides.length} overrides, ${this.bookings.length} bookings`;
                statusEl.style.color = '#27ae60';
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.loadDemoData();
        }
    }

    loadDemoData() {
        console.log('📊 Loading demo data for testing');
        
        // Demo data in MM/DD/YYYY format
        this.availabilityOverrides = [
            {
                Date: '2/23/2026',
                Status: 'Limited',
                Price: 18500,
                MaxBookings: 2,
                Booked: 1,
                Notes: 'Peak Season'
            },
            {
                Date: '2/24/2026',
                Status: 'Limited',
                Price: 18500,
                MaxBookings: 2,
                Booked: 1,
                Notes: 'Peak Season'
            },
            {
                Date: '2/25/2026',
                Status: 'Limited',
                Price: 18500,
                MaxBookings: 2,
                Booked: 1,
                Notes: 'Maintenance'
            },
            {
                Date: '2/26/2026',
                Status: 'Limited',
                Price: 18500,
                MaxBookings: 2,
                Booked: 1,
                Notes: 'Maintenance'
            },
            {
                Date: '2/27/2026',
                Status: 'Closed',
                Price: null,
                MaxBookings: 0,
                Booked: 0,
                Notes: 'Peak Season'
            }
        ];
        
        this.bookings = [
            {
                'Booking ID': 'SNOW-001',
                'Date': '3/21/2026',
                'Customer Name': 'John Smith',
                'Email': 'john@email.com',
                'Phone': '555-0101',
                'Guests': 2,
                'Plan': 'Weekend Getaway',
                'Plan Price': 12800,
                'Total Price': 12800,
                'Status': 'Confirmed',
                'Booking Date': '3/1/2026',
                'Special Requests': 'Late check-in requested'
            },
            {
                'Booking ID': 'SNOW-002',
                'Date': '3/21/2026',
                'Customer Name': 'John Smith',
                'Email': 'john@email.com',
                'Phone': '555-0101',
                'Guests': 2,
                'Plan': 'Weekend Getaway',
                'Plan Price': 12800,
                'Total Price': 12800,
                'Status': 'Confirmed',
                'Booking Date': '3/1/2026',
                'Special Requests': 'Late check-in requested'
            },
            {
                'Booking ID': 'SNOW-003',
                'Date': '3/21/2026',
                'Customer Name': 'John Smith2',
                'Email': 'john2@email.com',
                'Phone': '555-0102',
                'Guests': 2,
                'Plan': 'Weekend Getaway',
                'Plan Price': 12800,
                'Total Price': 12800,
                'Status': 'Confirmed',
                'Booking Date': '3/1/2026',
                'Special Requests': 'Late check-in requested'
            },
            {
                'Booking ID': 'SNOW-004',
                'Date': '2/26/2026',
                'Customer Name': 'John Smith2',
                'Email': 'john2@email.com',
                'Phone': '555-0102',
                'Guests': 2,
                'Plan': 'Weekend Getaway',
                'Plan Price': 12800,
                'Total Price': 12800,
                'Status': 'Confirmed',
                'Booking Date': '3/1/2026',
                'Special Requests': 'Late check-in requested'
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

    /**
     * FIXED: Convert YYYY-MM-DD from FullCalendar to MM/DD/YYYY correctly
     */
    convertToMMDDYYYY(dateStr) {
        // Input format: YYYY-MM-DD
        const [year, month, day] = dateStr.split('-');
        // Remove leading zeros from month and day
        const monthNoZero = parseInt(month, 10).toString();
        const dayNoZero = parseInt(day, 10).toString();
        return `${monthNoZero}/${dayNoZero}/${year}`;
    }

    applyStylesToCell(cell, dateStr) {
        // Convert YYYY-MM-DD from FullCalendar to MM/DD/YYYY for internal use
        const mmddyyyy = this.convertToMMDDYYYY(dateStr);
        
        // Parse the date for comparison
        const [month, day, year] = mmddyyyy.split('/').map(num => parseInt(num, 10));
        const checkDate = new Date(year, month-1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = checkDate < today;
        
        // Get status and counts
        const status = this.getDayStatus(mmddyyyy);
        const totalBooked = this.getTotalBookedCount(mmddyyyy);
        const maxBookings = this.getMaxBookings(mmddyyyy);
        const available = Math.max(0, maxBookings - totalBooked);
        
        // Debug log for specific dates we care about
        if (mmddyyyy === '2/23/2026' || mmddyyyy === '2/24/2026' || mmddyyyy === '2/25/2026' || 
            mmddyyyy === '2/26/2026' || mmddyyyy === '2/27/2026' || mmddyyyy === '3/21/2026') {
            console.log(`🎨 ${mmddyyyy}: Status=${status.class}, TotalBooked=${totalBooked}, Available=${available}`);
        }
        
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
            } else if (status.class === 'booked') {
                cell.classList.add('fc-day-booked');
            } else if (status.class === 'limited') {
                cell.classList.add('fc-day-limited');
            } else if (status.class === 'available') {
                cell.classList.add('fc-day-available');
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
                badge.style.backgroundColor = '#8E8E93';
                badge.style.color = 'white';
            } else if (status.class === 'booked' || available <= 0) {
                badge.textContent = 'Full';
                badge.style.backgroundColor = '#FF3B30';
                badge.style.color = 'white';
            } else if (status.class === 'limited' || available === 1) {
                badge.textContent = '1 left';
                badge.style.backgroundColor = '#FF9F0A';
                badge.style.color = 'white';
            } else if (status.class === 'available') {
                badge.textContent = `${available} left`;
                badge.style.backgroundColor = '#34C759';
                badge.style.color = 'white';
            }
            
            cell.appendChild(badge);
        }
        
        // Add selected class if needed
        if (this.selectedDates && this.selectedDates.includes(mmddyyyy)) {
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
     * Get total booked count from both availability Excel and bookings Excel
     */
    getTotalBookedCount(dateStr) {
        // Get booked count from availability Excel
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        const overrideBooked = override && override.Booked ? parseInt(override.Booked) : 0;
        
        // Get booking count from bookings Excel (unique bookings for this date)
        const uniqueBookings = new Set();
        this.bookings
            .filter(b => b.Date === dateStr && b.Status === 'Confirmed')
            .forEach(booking => {
                uniqueBookings.add(booking['Booking ID']);
            });
        const bookingsCount = uniqueBookings.size;
        
        // Total is the sum of both
        const total = overrideBooked + bookingsCount;
        
        // Debug log for specific dates
        if (dateStr === '2/23/2026' || dateStr === '2/24/2026' || dateStr === '2/25/2026' || 
            dateStr === '2/26/2026' || dateStr === '2/27/2026' || dateStr === '3/21/2026') {
            console.log(`📊 ${dateStr}: Override booked=${overrideBooked}, Bookings=${bookingsCount}, Total=${total}`);
        }
        
        return total;
    }

    getDayStatus(dateStr) {
        // Parse date for comparison
        const [month, day, year] = dateStr.split('/').map(num => parseInt(num, 10));
        const checkDate = new Date(year, month-1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (checkDate < today) {
            return { class: 'past', label: 'Past' };
        }
        
        // Find override in availability data
        const override = this.availabilityOverrides.find(o => o.Date === dateStr);
        
        // Get total booked count from both sources
        const totalBooked = this.getTotalBookedCount(dateStr);
        const maxBookings = this.getMaxBookings(dateStr);
        
        // Log for debugging
        if (dateStr === '2/23/2026' || dateStr === '2/24/2026' || dateStr === '2/25/2026' || 
            dateStr === '2/26/2026' || dateStr === '2/27/2026' || dateStr === '3/21/2026') {
            console.log(`📌 ${dateStr}: Override=${override?.Status}, TotalBooked=${totalBooked}, Max=${maxBookings}`);
        }
        
        // If there's a static override
        if (override) {
            // Check if override status is absolute Closed
            if (override.Status === 'Closed') {
                return { class: 'closed', label: 'Closed' };
            }
            
            // For Limited status, combine both booked numbers
            if (override.Status === 'Limited') {
                if (totalBooked >= maxBookings) {
                    return { class: 'booked', label: 'Fully Booked' };
                } else if (totalBooked >= 1) {
                    return { class: 'limited', label: 'Limited' };
                } else {
                    // No bookings yet but static says Limited
                    return { class: 'limited', label: 'Limited' };
                }
            }
            
            // For Booked status
            if (override.Status === 'Booked') {
                if (totalBooked >= maxBookings) {
                    return { class: 'booked', label: 'Fully Booked' };
                } else {
                    // Static says booked but actually has availability
                    return { class: 'limited', label: 'Limited' };
                }
            }
            
            // For Available status
            if (override.Status === 'Available') {
                if (totalBooked >= maxBookings) {
                    return { class: 'booked', label: 'Fully Booked' };
                } else if (totalBooked >= 1) {
                    return { class: 'limited', label: 'Limited' };
                } else {
                    return { class: 'available', label: 'Available' };
                }
            }
        }
        
        // No override - calculate from total booked only
        if (totalBooked >= maxBookings) {
            return { class: 'booked', label: 'Fully Booked' };
        } else if (totalBooked >= 1) {
            return { class: 'limited', label: 'Limited' };
        } else {
            return { class: 'available', label: 'Available' };
        }
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
        const mmddyyyy = this.convertToMMDDYYYY(dateStr);
        
        const [month, day, year] = mmddyyyy.split('/').map(num => parseInt(num, 10));
        const checkDate = new Date(year, month-1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (checkDate < today) return false;
        
        const status = this.getDayStatus(mmddyyyy);
        return !['booked', 'closed', 'past'].includes(status.class);
    }

    handleDateClick(info) {
        const dateStr = info.dateStr;
        const mmddyyyy = this.convertToMMDDYYYY(dateStr);
        
        if (!this.isDateSelectable(info)) {
            this.showNotification('This date is not available for booking', 'error');
            return;
        }
        
        const index = this.selectedDates.indexOf(mmddyyyy);
        
        if (index === -1) {
            this.selectedDates.push(mmddyyyy);
            info.el.classList.add('fc-day-selected');
        } else {
            this.selectedDates.splice(index, 1);
            info.el.classList.remove('fc-day-selected');
        }
        
        this.selectedDates.sort((a, b) => {
            const [aMonth, aDay, aYear] = a.split('/').map(num => parseInt(num, 10));
            const [bMonth, bDay, bYear] = b.split('/').map(num => parseInt(num, 10));
            return new Date(aYear, aMonth-1, aDay) - new Date(bYear, bMonth-1, bDay);
        });
        
        this.updateBookingSummary();
        
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
        const endDate = new Date(end);
        
        while (current < endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1);
            const day = String(current.getDate());
            const mmddyyyy = `${month}/${day}/${year}`;
            const yyyymmdd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            if (this.isDateSelectable({ startStr: yyyymmdd })) {
                this.selectedDates.push(mmddyyyy);
                
                const dayCell = document.querySelector(`[data-date="${yyyymmdd}"]`);
                if (dayCell) {
                    dayCell.classList.add('fc-day-selected');
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        this.selectedDates.sort((a, b) => {
            const [aMonth, aDay, aYear] = a.split('/').map(num => parseInt(num, 10));
            const [bMonth, bDay, bYear] = b.split('/').map(num => parseInt(num, 10));
            return new Date(aYear, aMonth-1, aDay) - new Date(bYear, bMonth-1, bDay);
        });
        
        this.updateBookingSummary();
        
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
        // Input is MM/DD/YYYY
        const [month, day, year] = dateStr.split('/');
        const date = new Date(year, month-1, day);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Resync availability from Excel
     */
    async resyncFromExcel(showNotification = true) {
        try {
            if (showNotification) {
                this.showNotification('🔄 Syncing availability from Excel...', 'info');
            }
            
            console.log('🔄 Resyncing availability from Excel...');
            
            // Reload availability overrides from Excel
            const overrides = await this.excelHandler.loadAvailabilityOverrides(true);
            this.availabilityOverrides = overrides || [];
            
            // Reload bookings from Excel
            const bookings = await this.excelHandler.loadBookings(true);
            this.bookings = bookings || [];
            
            console.log('✅ Data resynced:', {
                overrides: this.availabilityOverrides.length,
                bookings: this.bookings.length
            });
            
            // Refresh calendar with new data
            this.refreshCalendarData();
            
            if (showNotification) {
                this.showNotification('✅ Calendar synced with Excel', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to resync from Excel:', error);
            if (showNotification) {
                this.showNotification('⚠️ Failed to sync with Excel', 'warning');
            }
            return false;
        }
    }

    /**
     * Submit booking - immediately update cache, then resync from Excel
     */
    async submitBooking(bookingData) {
        try {
            console.log('📝 Processing booking...', bookingData);
            
            // Validate availability
            for (const date of this.selectedDates) {
                const totalBooked = this.getTotalBookedCount(date);
                const maxBookings = this.getMaxBookings(date);
                
                if (totalBooked >= maxBookings) {
                    this.showNotification(`Date ${date} is no longer available`, 'error');
                    this.refreshCalendarData();
                    return { success: false, error: 'Date no longer available' };
                }
            }
            
            const bookingId = this.generateBookingId();
            const newBookings = [];
            
            // STEP 1: Add to local cache immediately
            for (const date of this.selectedDates) {
                const booking = {
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
                    'Booking Date': new Date().toLocaleDateString('en-US'),
                    'Special Requests': bookingData.requests || ''
                };
                
                this.bookings.push(booking);
                newBookings.push(booking);
            }
            
            console.log('✅ Bookings added to cache:', newBookings.length);
            
            // STEP 2: Clear selection
            this.clearDateSelection(false);
            
            // STEP 3: Refresh calendar with updated cache
            this.refreshCalendarData();
            
            // STEP 4: Show success notification
            this.showNotification(`Booking confirmed! Reference: ${bookingId}`, 'success');
            
            // STEP 5: Sync to GitHub in background
            this.syncToGitHubWithRetry(3).then(success => {
                if (success) {
                    console.log('✅ Bookings synced to GitHub successfully');
                } else {
                    console.warn('⚠️ Bookings saved locally but GitHub sync failed');
                }
            });
            
            // STEP 6: Resync from Excel to ensure calendar is up-to-date
            setTimeout(() => {
                this.resyncFromExcel(false).then(success => {
                    if (success) {
                        console.log('✅ Data resynced from Excel after booking');
                    }
                });
            }, 1000);
            
            return { success: true, bookingId };
            
        } catch (error) {
            console.error('❌ Error submitting booking:', error);
            this.showNotification('Booking failed. Please try again.', 'error');
            return { success: false, error };
        }
    }

    /**
     * Sync to GitHub with retry mechanism
     */
    async syncToGitHubWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (i > 0) {
                    console.log(`🔄 Retry ${i}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i-1)));
                }
                
                const success = await this.syncToGitHub();
                if (success) return true;
                
            } catch (error) {
                console.warn(`⚠️ Sync attempt ${i + 1} failed:`, error);
            }
        }
        return false;
    }

    /**
     * Sync bookings to GitHub
     */
    async syncToGitHub() {
        try {
            if (!this.githubSync.hasToken()) {
                console.log('⚠️ No GitHub token, skipping sync');
                return false;
            }
            
            console.log('📤 Syncing bookings to GitHub...');
            
            const bookingsResult = await this.githubSync.pushBookings(this.bookings);
            
            if (bookingsResult) {
                console.log('✅ Successfully synced bookings to GitHub');
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
     * Refresh calendar data from local arrays
     */
    refreshCalendarData() {
        console.log('🔄 Refreshing calendar data...');
        
        const statusEl = document.getElementById('calendarLastUpdated');
        if (statusEl) {
            const now = new Date();
            statusEl.textContent = `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
            statusEl.style.color = '#27ae60';
        }
        
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