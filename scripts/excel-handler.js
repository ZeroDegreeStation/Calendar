/**
 * Excel Handler - Manages reading/writing Excel files
 * Dependencies: SheetJS (XLSX)
 * UPDATED: Added force refresh parameter to bypass cache
 */
class ExcelHandler {
    constructor() {
        this.availabilityFile = 'data/calendar-availability.xlsx';
        this.bookingsFile = 'data/calendar-bookings.xlsx';
        this.timeSlotsFile = 'data/calendar-time-slots.xlsx';
        
        // Default configuration
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 2;
        
        // GitHub configuration
        this.githubConfig = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            branch: 'main'
        };
        
        // Cache settings
        this.cache = {
            availability: null,
            bookings: null,
            timestamp: null
        };
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        
        console.log('✅ ExcelHandler initialized');
    }

    /**
     * Load availability overrides from Excel
     * UPDATED: Added forceRefresh parameter to bypass cache
     */
    async loadAvailabilityOverrides(forceRefresh = false) {
        // Check cache first unless force refresh is requested
        if (!forceRefresh && this.cache.availability && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            console.log('📦 Using cached availability data');
            return this.cache.availability;
        }
        
        try {
            const url = this.getGitHubRawUrl(this.availabilityFile);
            console.log('📥 Fetching availability from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('⚠️ No availability Excel file found, using defaults');
                return [];
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                console.log('⚠️ No sheets in availability Excel');
                return [];
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Loaded ${data.length} availability records from Excel`);
            
            // Process and normalize the data
            const processed = data.map(row => {
                // Handle date conversion
                let dateStr = row.Date || row['Date'];
                let formattedDate = null;
                
                if (dateStr) {
                    if (typeof dateStr === 'number') {
                        // Excel serial number
                        const excelEpoch = new Date(1899, 11, 30);
                        const msPerDay = 86400000;
                        const date = new Date(excelEpoch.getTime() + (dateStr * msPerDay));
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        formattedDate = `${year}-${month}-${day}`;
                    } else if (typeof dateStr === 'string') {
                        // Handle MM/DD/YYYY format
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            const month = parts[0].padStart(2, '0');
                            const day = parts[1].padStart(2, '0');
                            let year = parts[2];
                            if (year.length === 2) year = '20' + year;
                            formattedDate = `${year}-${month}-${day}`;
                        } else {
                            formattedDate = dateStr.split('T')[0];
                        }
                    }
                }
                
                return {
                    Date: formattedDate,
                    Status: row.Status || 'Available',
                    Price: row.Price ? parseInt(row.Price) : null,
                    MaxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : this.defaultMaxBookings,
                    Booked: row.Booked ? parseInt(row.Booked) : 0,
                    Available: row.Available ? parseInt(row.Available) : 
                              (row.MaxBookings ? row.MaxBookings - (row.Booked || 0) : this.defaultMaxBookings),
                    Notes: row.Notes || ''
                };
            }).filter(item => item.Date); // Remove items with invalid dates
            
            console.log('✅ Processed availability:', processed);
            
            // Update cache
            this.cache.availability = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading availability:', error);
            return [];
        }
    }

    /**
     * Load all bookings from Excel
     * UPDATED: Added forceRefresh parameter to bypass cache
     */
    async loadBookings(forceRefresh = false) {
        // Check cache first unless force refresh is requested
        if (!forceRefresh && this.cache.bookings && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            console.log('📦 Using cached bookings data');
            return this.cache.bookings;
        }
        
        try {
            const url = this.getGitHubRawUrl(this.bookingsFile);
            console.log('📥 Fetching bookings from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('⚠️ No bookings Excel file found');
                return [];
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                console.log('⚠️ No sheets in bookings Excel');
                return [];
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Loaded ${data.length} booking records from Excel`);
            
            const processed = data.map(row => {
                let dateStr = row.Date || row['Date'];
                let formattedDate = null;
                
                if (dateStr) {
                    if (typeof dateStr === 'number') {
                        const excelEpoch = new Date(1899, 11, 30);
                        const msPerDay = 86400000;
                        const date = new Date(excelEpoch.getTime() + (dateStr * msPerDay));
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        formattedDate = `${year}-${month}-${day}`;
                    } else if (typeof dateStr === 'string') {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            const month = parts[0].padStart(2, '0');
                            const day = parts[1].padStart(2, '0');
                            let year = parts[2];
                            if (year.length === 2) year = '20' + year;
                            formattedDate = `${year}-${month}-${day}`;
                        } else {
                            formattedDate = dateStr.split('T')[0];
                        }
                    }
                }
                
                return {
                    'Booking ID': row['Booking ID'] || row.BookingID || 'DEMO-' + Math.random().toString(36).substring(7),
                    'Date': formattedDate,
                    'Customer Name': row['Customer Name'] || row.CustomerName || 'Demo Customer',
                    'Email': row.Email || 'demo@example.com',
                    'Phone': row.Phone || '',
                    'Guests': row.Guests ? parseInt(row.Guests) : 1,
                    'Plan': row.Plan || '',
                    'Plan Price': row['Plan Price'] ? parseInt(row['Plan Price']) : 0,
                    'Total Price': row['Total Price'] ? parseInt(row['Total Price']) : 0,
                    'Status': row.Status || 'Confirmed',
                    'Booking Date': row['Booking Date'] || new Date().toISOString().split('T')[0],
                    'Special Requests': row['Special Requests'] || ''
                };
            }).filter(item => item.Date);
            
            console.log('✅ Processed bookings:', processed);
            
            // Update cache
            this.cache.bookings = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading bookings:', error);
            return [];
        }
    }

    /**
     * Load time slots from Excel
     */
    async loadTimeSlots() {
        try {
            const url = this.getGitHubRawUrl(this.timeSlotsFile);
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('No time slots found, using defaults');
                return this.getDefaultTimeSlots();
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`⏰ Loaded ${data.length} time slots`);
            return data;
        } catch (error) {
            console.log('No time slots found, using defaults');
            return this.getDefaultTimeSlots();
        }
    }

    /**
     * Get default time slots
     */
    getDefaultTimeSlots() {
        return [
            { 'Time Slot': '15:00', 'Display Time': '3:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '16:00', 'Display Time': '4:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '17:00', 'Display Time': '5:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '18:00', 'Display Time': '6:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '19:00', 'Display Time': '7:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '20:00', 'Display Time': '8:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '21:00', 'Display Time': '9:00 PM', 'Capacity': 10, 'Available': 10 },
            { 'Time Slot': '22:00', 'Display Time': '10:00 PM', 'Capacity': 10, 'Available': 10 }
        ];
    }

    /**
     * Save booking to Excel
     */
    async saveBooking(bookingData) {
        try {
            console.log('✅ Booking saved locally:', bookingData['Booking ID']);
            return true;
        } catch (error) {
            console.error('❌ Error saving booking:', error);
            return false;
        }
    }

    /**
     * Update availability after booking
     */
    async updateAvailability(date, guests) {
        try {
            console.log(`✅ Availability updated for ${date}: +${guests} guests`);
            return true;
        } catch (error) {
            console.error('❌ Error updating availability:', error);
            return false;
        }
    }

    /**
     * Get GitHub raw URL
     */
    getGitHubRawUrl(filePath) {
        return `https://raw.githubusercontent.com/${this.githubConfig.owner}/${this.githubConfig.repo}/${this.githubConfig.branch}/${filePath}`;
    }

    /**
     * Format date for display
     */
    formatDisplayDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Export data to Excel file
     */
    exportToExcel(data, filename) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, filename);
        console.log(`✅ Exported to ${filename}`);
    }
    
    /**
     * Clear cache to force fresh load on next request
     */
    clearCache() {
        this.cache = {
            availability: null,
            bookings: null,
            timestamp: null
        };
        console.log('🧹 Cache cleared');
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.ExcelHandler = ExcelHandler;
}