/**
 * Booking System - Core calendar and booking logic
 * UPDATED: Combines static availability with dynamic bookings
 * UPDATED: Enforces max 2 bookings per day
 * UPDATED: Auto-refresh after GitHub sync
 * UPDATED: Loads from public JSON first (no token needed)
 */
class BookingSystem {
    constructor() {
        console.log('🚀 Initializing BookingSystem...');
        
        this.excelHandler = new ExcelHandler();
        this.githubSync = new GitHubSync();
        
        this.calendar = null;
        this.availabilityRules = [];      // Static rules from calendar-availability.xlsx
        this.bookings = [];                // Dynamic bookings from calendar-bookings.xlsx
        this.combinedAvailability = [];    // Combined result for display
        this.selectedDates = [];
        this.selectedPlan = null;
        this.planPrice = 0;
        this.planName = '';
        
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 2;       // Max 2 bookings per day
        
        this.isLoading = false;
        this.pendingResync = false;
        this.lastSyncTime = null;           // Track last sync time
        
        // Bind methods
        this.handleDateClick = this.handleDateClick.bind(this);
        this.handleDateSelect = this.handleDateSelect.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.clearDateSelection = this.clearDateSelection.bind(this);
        this.forceCalendarRefresh = this.forceCalendarRefresh.bind(this);
        this.updateBookingSummary = this.updateBookingSummary.bind(this);
        this.refreshCalendarData = this.refreshCalendarData.bind(this);
        this.resyncFromExcel = this.resyncFromExcel.bind(this);
        this.manualRefresh = this.manualRefresh.bind(this);
        this.refreshAfterSync = this.refreshAfterSync.bind(this);
        this.loadPublicData = this.loadPublicData.bind(this);
        
        this.init();
    }

    async init() {
        try {
            this.showCalendarLoading('Loading calendar data...');
            
            await this.loadData();
            this.combineAvailabilityData();
            this.initCalendar();
            this.setupEventListeners();
            this.setupRefreshButton();
            
            // Set up periodic refresh every 5 minutes
            setInterval(() => {
                if (!this.isLoading) {
                    this.resyncFromExcel(false).catch(console.warn);
                }
            }, 300000); // 5 minutes
            
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
                    <button onclick="window.bookingSystem?.manualRefresh()" style="display: block; margin: 1rem auto; padding: 0.5rem 1rem; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-sync-alt"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    // NEW: Load from public JSON (no token needed)
    async loadPublicData() {
        try {
            // Add timestamp to force fresh fetch EVERY time
            const timestamp = Date.now();
            const baseUrl = 'https://raw.githubusercontent.com/ZeroDegreeStation/Calendar/main/public-data';
            const response = await fetch(`${baseUrl}/availability.json?t=${timestamp}`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Store in combinedAvailability
                this.combinedAvailability = data.map(item => ({
                    Date: item.date,
                    Status: item.status,
                    Available: item.available,
                    MaxBookings: item.maxBookings,
                    Booked: item.booked,
                    Price: item.price,
                    Notes: item.notes || ''
                }));
                
                console.log('📊 Loaded from public JSON:', {
                    total: this.combinedAvailability.length,
                    nonGreen: this.combinedAvailability.filter(d => d.Status !== 'Available').length,
                    sample: this.combinedAvailability.slice(0, 3)
                });
                
                // Update timestamp display
                const lastUpdatedEl = document.getElementById('lastUpdated');
                if (lastUpdatedEl) {
                    lastUpdatedEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
                }
                
                // Force calendar to refresh with new data
                this.refreshCalendarData();
                
                return true;
            }
        } catch (e) {
            console.log('Public JSON not available, falling back to Excel');
        }
        return false;
    }

    async loadData() {
        try {
            // Try public JSON first (no token needed)
            const publicDataLoaded = await this.loadPublicData();
            
            if (!publicDataLoaded) {
                console.log('📊 Falling back to Excel with token...');
                
                // Fall back to Excel with token
                if (this.githubSync && this.githubSync.hasReadToken()) {
                    this.excelHandler.setToken(this.githubSync.getTokenForReading());
                }
                
                const [availabilityRules, bookings] = await Promise.all([
                    this.excelHandler.loadAvailabilityOverrides(),
                    this.excelHandler.loadBookings()
                ]);
                
                this.availabilityRules = availabilityRules || [];
                this.bookings = bookings || [];
                
                console.log('📊 Data loaded from Excel:', {
                    availabilityRules: this.availabilityRules.length,
                    bookings: this.bookings.length
                });
            }
            
            const statusEl = document.getElementById('calendarLastUpdated');
            if (statusEl) {
                statusEl.textContent = `Loaded: ${this.combinedAvailability?.length || 0} availability records`;
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.loadDemoData();
        }
    }

    // Combine static availability rules with dynamic bookings
    combineAvailabilityData() {
        // If we already have combined data from public JSON, skip
        if (this.combinedAvailability.length > 0 && this.availabilityRules.length === 0) {
            return;
        }
        
        console.log('🔄 Combining availability rules with bookings...');
        
        // Create a map of dates from availability rules
        const availabilityMap = new Map();
        
        // First, add all availability rules
        this.availabilityRules.forEach(rule => {
            if (rule.Date) {
                availabilityMap.set(rule.Date, {
                    status: rule.Status || 'Available',
                    maxBookings: rule.MaxBookings || this.defaultMaxBookings,
                    staticBooked: rule.Booked || 0,
                    price: rule.Price || null,
                    notes: rule.Notes || ''
                });
            }
        });
        
        // Count bookings per date (dynamic bookings)
        const bookingCountMap = new Map();
        this.bookings.forEach(booking => {
            if (booking.Date) {
                const count = bookingCountMap.get(booking.Date) || 0;
                bookingCountMap.set(booking.Date, count + 1);
            }
        });
        
        console.log('📊 Booking counts per date:', Object.fromEntries(bookingCountMap));
        
        // Get all unique dates (from rules + next 90 days)
        const allDates = new Set();
        
        // Add dates from availability rules
        availabilityMap.forEach((_, date) => allDates.add(date));
        
        // Add next 90 days for future availability
        const today = new Date();
        for (let i = 0; i < 90; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const year = date.getFullYear();
            const dateStr = `${month}/${day}/${year}`;
            allDates.add(dateStr);
        }
        
        // Combine the data
        this.combinedAvailability = [];
        
        allDates.forEach(dateStr => {
            const rule = availabilityMap.get(dateStr) || {
                status: 'Available',
                maxBookings: this.defaultMaxBookings,
                staticBooked: 0,
                price: null,
                notes: ''
            };
            
            const dynamicBookings = bookingCountMap.get(dateStr) || 0;
            
            // CRITICAL: Total booked = static (from rules) + dynamic (from bookings)
            const totalBooked = rule.staticBooked + dynamicBookings;
            
            // CRITICAL: Available spots = maxBookings (usually 2) - totalBooked
            const availableSpots = Math.max(0, rule.maxBookings - totalBooked);
            
            // Determine final status based on availability
            let finalStatus = rule.status;
            
            // If status is 'Closed', it overrides everything
            if (rule.status === 'Closed') {
                finalStatus = 'Closed';
            } 
            // Otherwise calculate based on available spots
            else {
                if (availableSpots <= 0) {
                    finalStatus = 'Booked'; // No spots left
                } else if (availableSpots === 1) {
                    finalStatus = 'Limited'; // 1 spot left
                } else {
                    finalStatus = 'Available'; // 2+ spots left
                }
            }
            
            this.combinedAvailability.push({
                Date: dateStr,
                Status: finalStatus,
                Available: availableSpots,
                MaxBookings: rule.maxBookings,
                Booked: totalBooked,
                Price: rule.price,
                Notes: rule.notes
            });
        });
        
        // Sort by date
        this.combinedAvailability.sort((a, b) => {
            const [aMonth, aDay, aYear] = a.Date.split('/').map(Number);
            const [bMonth, bDay, bYear] = b.Date.split('/').map(Number);
            
            const aDate = new Date(aYear, aMonth - 1, aDay);
            const bDate = new Date(bYear, bMonth - 1, bDay);
            
            return aDate - bDate;
        });
        
        console.log('✅ Combined availability calculated with max 2 per day');
    }

    loadDemoData() {
        console.log('📊 Loading demo data for testing');
        const today = new Date();
        
        // Generate demo availability rules
        this.availabilityRules = [];
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
            
            this.availabilityRules.push({
                Date: dateStr,
                Status: status,
                Price: 12800,
                MaxBookings: 2,
                Booked: booked,
                Notes: ''
            });
        }
        
        this.bookings = [];
        this.combineAvailabilityData();
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
     * Convert YYYY-MM-DD (from calendar) to MM/DD/YYYY (Excel format)
     */
    convertToExcelFormat(dateStr) {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        const monthNoZero = parseInt(month, 10).toString();
        const dayNoZero = parseInt(day, 10).toString();
        return `${monthNoZero}/${dayNoZero}/${year}`;
    }

    // Apply styles based on combined availability
    applyStylesToCell(cell, dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cellDate = new Date(dateStr);
        cellDate.setHours(0, 0, 0, 0);
        
        const isPast = cellDate < today;
        
        // Convert to Excel format for lookup
        const excelDateStr = this.convertToExcelFormat(dateStr);
        
        // Find in combined availability
        const availability = this.combinedAvailability.find(a => a.Date === excelDateStr);
        
        let status = 'Available';
        let available = this.defaultMaxBookings;
        
        if (availability) {
            status = availability.Status;
            available = availability.Available;
        }
        
        // Remove all existing classes
        cell.classList.remove(
            'fc-day-available', 'fc-day-limited', 'fc-day-booked', 
            'fc-day-past', 'fc-day-closed'
        );
        
        if (isPast) {
            cell.classList.add('fc-day-past');
        } else {
            const statusLower = (status || '').toLowerCase();
            if (statusLower === 'closed') {
                cell.classList.add('fc-day-closed');
            } else if (statusLower === 'booked' || available <= 0) {
                cell.classList.add('fc-day-booked');
            } else if (statusLower === 'limited' || available === 1) {
                cell.classList.add('fc-day-limited');
            } else {
                cell.classList.add('fc-day-available');
            }
        }
        
        // Update badge
        const existingBadge = cell.querySelector('.day-badge');
        if (existingBadge) existingBadge.remove();
        
        if (!isPast && status !== 'Closed') {
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            
            if (status === 'Booked' || available <= 0) {
                badge.textContent = 'Full';
                badge.style.backgroundColor = '#FF3B30';
                badge.style.color = 'white';
            } else if (status === 'Limited' || available === 1) {
                badge.textContent = '1 left';
                badge.style.backgroundColor = '#FF9F0A';
                badge.style.color = 'white';
            } else if (status === 'Available' && available >= 2) {
                badge.textContent = `${available} left`;
                badge.style.backgroundColor = '#34C759';
                badge.style.color = 'white';
            }
            
            cell.appendChild(badge);
        } else if (!isPast && status === 'Closed') {
            const badge = document.createElement('div');
            badge.className = 'day-badge';
            badge.textContent = 'Closed';
            badge.style.backgroundColor = '#8E8E93';
            badge.style.color = 'white';
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

    // Get day status from combined availability
    getDayStatus(dateStr) {
        const excelDateStr = this.convertToExcelFormat(dateStr);
        const availability = this.combinedAvailability.find(a => a.Date === excelDateStr);
        return availability ? availability.Status : 'Available';
    }

    // Get available spots from combined availability
    getAvailableSpots(dateStr) {
        const excelDateStr = this.convertToExcelFormat(dateStr);
        const availability = this.combinedAvailability.find(a => a.Date === excelDateStr);
        return availability ? availability.Available : this.defaultMaxBookings;
    }

    // Check if date is selectable
    isDateSelectable(dateInput) {
        let dateStr;
        if (typeof dateInput === 'string') {
            dateStr = dateInput;
        } else if (dateInput && dateInput.startStr) {
            dateStr = dateInput.startStr.split('T')[0];
        } else {
            return false;
        }
        
        if (!dateStr) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const checkDate = new Date(dateStr);
        checkDate.setHours(0, 0, 0, 0);
        
        if (checkDate < today) return false;
        
        const status = this.getDayStatus(dateStr);
        const available = this.getAvailableSpots(dateStr);
        
        const statusLower = (status || '').toLowerCase();
        
        // Can select only if status is 'Available' or 'Limited' AND available spots > 0
        const isSelectable = (statusLower === 'available' || statusLower === 'limited') && available > 0;
        
        return isSelectable;
    }

    handleDateClick(info) {
        console.log('Date clicked:', info.dateStr);
        
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
            if (info.el) {
                info.el.classList.add('fc-day-selected');
            }
            this.showNotification(`Date added: ${this.formatDate(dateStr)}`, 'success');
        } else {
            this.selectedDates.splice(index, 1);
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
            
            // Validate each selected date is still available
            for (const date of this.selectedDates) {
                if (!this.isDateSelectable(date)) {
                    this.showNotification(`Date ${date} is no longer available`, 'error');
                    return { success: false };
                }
            }
            
            const bookingId = this.generateBookingId();
            
            // Add to local cache
            for (const date of this.selectedDates) {
                const [year, month, day] = date.split('-');
                const excelDate = `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
                
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
            
            // Recalculate availability with new bookings
            this.combineAvailabilityData();
            
            // Clear selection and refresh display
            this.clearDateSelection(false);
            this.refreshCalendarData();
            
            // Show success
            this.showNotification(`Booking confirmed! Reference: ${bookingId}`, 'success');
            
            // Trigger GitHub sync and refresh after completion
            if (this.githubSync && this.githubSync.hasReadToken()) {
                this.showNotification('Syncing with GitHub...', 'info', 2000);
                
                const syncResult = await this.syncToGitHubWithRetry(3);
                
                if (syncResult) {
                    // Refresh from GitHub after successful sync
                    await this.refreshAfterSync();
                }
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

    // Refresh data from GitHub after sync
    async refreshAfterSync() {
        try {
            console.log('🔄 Refreshing calendar from GitHub after sync...');
            
            // Show loading state on refresh button
            const refreshBtn = document.getElementById('refreshCalendarBtn');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
                refreshBtn.disabled = true;
            }
            
            // Clear cache to force fresh load
            this.excelHandler.clearCache();
            
            // Wait a moment for GitHub to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try to load public data first, then fall back to Excel
            const publicDataLoaded = await this.loadPublicData();
            
            if (!publicDataLoaded) {
                // Reload data from Excel
                await this.loadData();
                this.combineAvailabilityData();
            }
            
            this.refreshCalendarData();
            
            // Update timestamp
            this.lastSyncTime = new Date();
            const lastUpdatedEl = document.getElementById('calendarLastUpdated');
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = `Last sync: ${this.lastSyncTime.toLocaleTimeString()}`;
            }
            
            // Show success
            this.showNotification('Calendar updated with latest data', 'success');
            
        } catch (error) {
            console.error('❌ Error refreshing after sync:', error);
            this.showNotification('Auto-refresh failed', 'error');
        } finally {
            // Reset button
            const refreshBtn = document.getElementById('refreshCalendarBtn');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Calendar';
                refreshBtn.disabled = false;
            }
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
                if (success) {
                    console.log('✅ GitHub sync successful');
                    return true;
                }
                
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
        // Already using setInterval in init()
    }

    setupRefreshButton() {
        const refreshBtn = document.getElementById('refreshCalendarBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.manualRefresh());
        }
    }

    async manualRefresh() {
        if (this.isLoading) return;
        
        const refreshBtn = document.getElementById('refreshCalendarBtn');
        if (!refreshBtn) return;
        
        try {
            this.isLoading = true;
            const originalHtml = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            
            await this.resyncFromExcel(true);
            
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showNotification('Refresh failed', 'error');
        } finally {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Calendar';
            refreshBtn.disabled = false;
            this.isLoading = false;
        }
    }

    async resyncFromExcel(showNotification = false) {
        if (this.isLoading) return;
        this.isLoading = true;
        try {
            console.log('🔄 Resyncing from Excel...');
            
            // Clear cache to force fresh load
            this.excelHandler.clearCache();
            
            await this.loadData();
            this.combineAvailabilityData();
            this.refreshCalendarData();
            
            this.lastSyncTime = new Date();
            const lastUpdatedEl = document.getElementById('calendarLastUpdated');
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = `Last sync: ${this.lastSyncTime.toLocaleTimeString()}`;
            }
            
            if (showNotification) {
                this.showNotification('Calendar refreshed', 'success');
            }
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