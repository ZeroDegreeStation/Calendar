/**
 * Excel Handler - Reads from private GitHub repo using API
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
            // Use GitHub API instead of raw CDN (handles CORS better)
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
            
            // GitHub API returns content as base64
            if (data.content) {
                // Decode base64 content
                const content = atob(data.content.replace(/\n/g, ''));
                // Convert string to array buffer
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

    async loadAvailabilityOverrides(forceRefresh = false) {
        console.log('📊 Loading availability from private repo...');
        
        // Check cache
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
            
            const processed = this.processAvailabilityData(data);
            
            // Update cache
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
        
        // Check cache
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
            
            const processed = this.processBookingsData(data);
            
            this.cache.bookings = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading bookings:', error);
            return [];
        }
    }

    // Add this method to ExcelHandler class
    normalizeDate(dateStr) {
        if (!dateStr) return null;
        
        // If it's already YYYY-MM-DD, return as is
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateStr;
        }
        
        // Try to convert from MM/DD/YYYY
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
            const [month, day, year] = dateStr.split('/');
            if (month && day && year) {
                const paddedMonth = month.padStart(2, '0');
                const paddedDay = day.padStart(2, '0');
                const fullYear = year.length === 2 ? '20' + year : year;
                return `${fullYear}-${paddedMonth}-${paddedDay}`;
            }
        }
        
        return dateStr;
    }

    // Use it in processAvailabilityData:
    processAvailabilityData(data) {
        return data.map(row => ({
            Date: this.normalizeDate(row.Date || row['Date']),
            Status: row.Status || 'Available',
            Price: row.Price ? parseInt(row.Price) : null,
            MaxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
            Booked: row.Booked ? parseInt(row.Booked) : 0,
            Notes: row.Notes || ''
        })).filter(item => item.Date);
    }

    // And in processBookingsData:
    processBookingsData(data) {
        return data.map(row => ({
            'Booking ID': row['Booking ID'] || '',
            'Date': this.normalizeDate(row.Date || row['Date']),
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
        })).filter(item => item.Date);
    }

    getDefaultAvailability() {
        // Return default availability so calendar doesn't break
        const today = new Date();
        const defaults = [];
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            defaults.push({
                Date: dateStr,
                Status: 'Available',
                Price: 12800,
                MaxBookings: 2,
                Booked: 0,
                Notes: 'Default availability'
            });
        }
        
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