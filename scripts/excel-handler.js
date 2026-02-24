/**
 * Excel Handler - Reads from private GitHub repo using API
 * FIXED: Properly converts Excel serial numbers to readable dates
 */
class ExcelHandler {
    constructor() {
        this.availabilityFile = 'data/calendar-availability.xlsx';
        this.bookingsFile = 'data/calendar-bookings.xlsx';
        
        // Point to private repo
        this.githubConfig = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar-Data',
            branch: 'main'
        };
        
        this.readToken = null;
        this.cache = {
            availability: null,
            bookings: null,
            timestamp: null
        };
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        
        console.log('✅ ExcelHandler initialized (private repo mode)');
    }

    setToken(token) {
        this.readToken = token;
        console.log('🔑 Read token set in ExcelHandler');
    }

    async fetchFileFromGitHub(filePath) {
        try {
            const url = `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${filePath}?ref=${this.githubConfig.branch}`;
            
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
            };
            
            if (this.readToken) {
                headers['Authorization'] = `token ${this.readToken}`;
            }
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('📁 File not found:', filePath);
                    return null;
                }
                if (response.status === 401 || response.status === 403) {
                    console.error('❌ Authentication failed - token may be invalid');
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.content) {
                const content = atob(data.content.replace(/\n/g, ''));
                const buffer = new Uint8Array(content.length);
                for (let i = 0; i < content.length; i++) {
                    buffer[i] = content.charCodeAt(i);
                }
                return buffer.buffer;
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error fetching from GitHub API:', error);
            throw error;
        }
    }

    /**
     * Convert Excel serial date to JavaScript Date
     * Excel serial date: days since 1899-12-30
     */
    excelSerialToDate(serial) {
        if (!serial && serial !== 0) return null;
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch: 1899-12-30
        const date = new Date(excelEpoch.getTime() + (serial * 86400000));
        return date;
    }

    /**
     * Format date as MM/DD/YYYY without leading zeros
     */
    formatDateMMDDYYYY(date) {
        if (!date) return null;
        const month = date.getMonth() + 1; // getMonth() returns 0-11
        const day = date.getDate();
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    /**
     * Convert any date value to MM/DD/YYYY string
     */
    normalizeDate(dateValue) {
        if (!dateValue && dateValue !== 0) return null;
        
        // If it's already a string in MM/DD/YYYY format
        if (typeof dateValue === 'string' && dateValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
            return dateValue;
        }
        
        // If it's an Excel serial number
        if (typeof dateValue === 'number') {
            const date = this.excelSerialToDate(dateValue);
            return this.formatDateMMDDYYYY(date);
        }
        
        // If it's a string in some other format, try to parse it
        if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            if (!isNaN(parsed)) {
                return this.formatDateMMDDYYYY(parsed);
            }
        }
        
        console.log('⚠️ Could not parse date:', dateValue);
        return null;
    }

    async loadAvailabilityOverrides(forceRefresh = false) {
        console.log('📊 Loading availability from private repo...');
        
        if (!forceRefresh && this.cache.availability && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            console.log('📦 Using cached availability data');
            return this.cache.availability;
        }
        
        try {
            const arrayBuffer = await this.fetchFileFromGitHub(this.availabilityFile);
            
            if (!arrayBuffer) {
                console.log('📁 No availability file found, using defaults');
                return this.getDefaultAvailability();
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                console.log('⚠️ No sheets in workbook');
                return this.getDefaultAvailability();
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Loaded ${data.length} availability records`);
            
            // Process and normalize dates
            const processed = data.map(row => {
                const rawDate = row.Date || row['Date'];
                const normalizedDate = this.normalizeDate(rawDate);
                
                console.log(`📅 Converting date: ${rawDate} (${typeof rawDate}) → ${normalizedDate}`);
                
                return {
                    Date: normalizedDate,
                    Status: row.Status || 'Available',
                    Price: row.Price ? parseInt(row.Price) : null,
                    MaxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
                    Booked: row.Booked ? parseInt(row.Booked) : 0,
                    Notes: row.Notes || ''
                };
            }).filter(item => item.Date);
            
            console.log('✅ Processed availability:', processed);
            
            this.cache.availability = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading availability:', error);
            return this.getDefaultAvailability();
        }
    }

    async loadBookings(forceRefresh = false) {
        console.log('📊 Loading bookings from private repo...');
        
        if (!forceRefresh && this.cache.bookings && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            console.log('📦 Using cached bookings data');
            return this.cache.bookings;
        }
        
        try {
            const arrayBuffer = await this.fetchFileFromGitHub(this.bookingsFile);
            
            if (!arrayBuffer) {
                console.log('📁 No bookings file found');
                return [];
            }
            
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                return [];
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Loaded ${data.length} booking records`);
            
            // Process and normalize dates
            const processed = data.map(row => {
                const rawDate = row.Date || row['Date'];
                const normalizedDate = this.normalizeDate(rawDate);
                
                return {
                    'Booking ID': row['Booking ID'] || '',
                    'Date': normalizedDate,
                    'Customer Name': row['Customer Name'] || '',
                    'Email': row.Email || '',
                    'Phone': row.Phone || '',
                    'Guests': row.Guests ? parseInt(row.Guests) : 1,
                    'Plan': row.Plan || '',
                    'Plan Price': row['Plan Price'] ? parseInt(row['Plan Price']) : 0,
                    'Total Price': row['Total Price'] ? parseInt(row['Total Price']) : 0,
                    'Status': row.Status || 'Confirmed',
                    'Booking Date': row['Booking Date'] || '',
                    'Special Requests': row['Special Requests'] || ''
                };
            }).filter(item => item.Date);
            
            console.log('✅ Processed bookings:', processed);
            
            this.cache.bookings = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading bookings:', error);
            return [];
        }
    }

    getDefaultAvailability() {
        console.log('📅 Generating default availability data');
        const today = new Date();
        const defaults = [];
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = this.formatDateMMDDYYYY(date);
            
            defaults.push({
                Date: dateStr,
                Status: 'Available',
                Price: 12800,
                MaxBookings: 2,
                Booked: 0,
                Notes: 'Default availability'
            });
        }
        
        console.log('✅ Generated', defaults.length, 'default availability records');
        return defaults;
    }

    clearCache() {
        this.cache = {
            availability: null,
            bookings: null,
            timestamp: null
        };
        console.log('🧹 Cache cleared');
    }
}

if (typeof window !== 'undefined') {
    window.ExcelHandler = ExcelHandler;
}