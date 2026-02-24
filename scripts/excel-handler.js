/**
 * Excel Handler - Reads from private GitHub repo
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
    }

    async loadAvailabilityOverrides(forceRefresh = false) {
        // Check cache
        if (!forceRefresh && this.cache.availability && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            return this.cache.availability;
        }
        
        try {
            const url = this.getGitHubRawUrl(this.availabilityFile);
            
            const headers = {};
            if (this.readToken) {
                headers['Authorization'] = `token ${this.readToken}`;
            }
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                console.log('⚠️ Could not fetch availability, using defaults');
                return this.getDefaultAvailability();
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            const processed = this.processAvailabilityData(data);
            
            this.cache.availability = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading availability:', error);
            return this.getDefaultAvailability();
        }
    }

    async loadBookings(forceRefresh = false) {
        // Check cache
        if (!forceRefresh && this.cache.bookings && 
            this.cache.timestamp && (Date.now() - this.cache.timestamp) < this.cacheDuration) {
            return this.cache.bookings;
        }
        
        try {
            const url = this.getGitHubRawUrl(this.bookingsFile);
            
            const headers = {};
            if (this.readToken) {
                headers['Authorization'] = `token ${this.readToken}`;
            }
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                console.log('⚠️ Could not fetch bookings');
                return [];
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            const processed = this.processBookingsData(data);
            
            this.cache.bookings = processed;
            this.cache.timestamp = Date.now();
            
            return processed;
            
        } catch (error) {
            console.error('❌ Error loading bookings:', error);
            return [];
        }
    }

    processAvailabilityData(data) {
        return data.map(row => ({
            Date: row.Date || row['Date'],
            Status: row.Status || 'Available',
            Price: row.Price ? parseInt(row.Price) : null,
            MaxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
            Booked: row.Booked ? parseInt(row.Booked) : 0,
            Notes: row.Notes || ''
        })).filter(item => item.Date);
    }

    processBookingsData(data) {
        return data.map(row => ({
            'Booking ID': row['Booking ID'] || '',
            'Date': row.Date || '',
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
        return [];
    }

    getGitHubRawUrl(filePath) {
        return `https://raw.githubusercontent.com/${this.githubConfig.owner}/${this.githubConfig.repo}/${this.githubConfig.branch}/${filePath}`;
    }

    clearCache() {
        this.cache = {
            availability: null,
            bookings: null,
            timestamp: null
        };
    }
}

if (typeof window !== 'undefined') {
    window.ExcelHandler = ExcelHandler;
}