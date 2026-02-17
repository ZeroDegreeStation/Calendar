/**
 * Excel Handler - Manages reading/writing Excel files
 * UPDATED: Preserves MM/DD/YYYY format
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
            
            // Process and normalize the data - PRESERVE ORIGINAL FORMAT
            const processed = data.map(row => {
                let dateStr = row.Date || row['Date'];
                let formattedDate = null;
                
                if (dateStr) {
                    if (typeof dateStr === 'number') {
                        // Excel serial number - convert to MM/DD/YYYY
                        const excelEpoch = new Date(1899, 11, 30);
                        const msPerDay = 86400000;
                        const date = new Date(excelEpoch.getTime() + (dateStr * msPerDay));
                        const month = String(date.getMonth() + 1);
                        const day = String(date.getDate());
                        const year = date.getFullYear();
                        formattedDate = `${month}/${day}/${year}`;
                    } else if (typeof dateStr === 'string') {
                        // Keep original string format (should be MM/DD/YYYY)
                        formattedDate = dateStr;
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
                        const month = String(date.getMonth() + 1);
                        const day = String(date.getDate());
                        const year = date.getFullYear();
                        formattedDate = `${month}/${day}/${year}`;
                    } else if (typeof dateStr === 'string') {
                        // Keep original string format (should be MM/DD/YYYY)
                        formattedDate = dateStr;
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
                    'Booking Date': row['Booking Date'] || new Date().toLocaleDateString('en-US'),
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
     * Get GitHub raw URL
     */
    getGitHubRawUrl(filePath) {
        return `https://raw.githubusercontent.com/${this.githubConfig.owner}/${this.githubConfig.repo}/${this.githubConfig.branch}/${filePath}`;
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