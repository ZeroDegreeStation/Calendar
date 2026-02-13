/**
 * Excel Handler - Manages reading/writing Excel files
 * Dependencies: SheetJS (XLSX)
 */
class ExcelHandler {
    constructor() {
        this.availabilityFile = 'data/calendar-availability.xlsx';
        this.bookingsFile = 'data/calendar-bookings.xlsx';
        this.timeSlotsFile = 'data/calendar-time-slots.xlsx';
        
        // Default configuration
        this.defaultPrice = 12800;
        this.defaultMaxBookings = 10;
        
        // GitHub configuration
        this.githubConfig = {
            owner: 'ZeroDegreeStation',
            repo: 'Calendar',
            branch: 'main'
        };
        
        console.log('✅ ExcelHandler initialized');
    }

    /**
     * Load availability overrides from Excel
     */
    async loadAvailabilityOverrides() {
        try {
            const url = this.getGitHubRawUrl(this.availabilityFile);
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('No availability overrides found, using defaults');
                return [];
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📊 Loaded ${data.length} availability overrides`);
            return data;
        } catch (error) {
            console.log('No availability overrides found, using defaults');
            return [];
        }
    }

    /**
     * Load all bookings from Excel
     */
    async loadBookings() {
        try {
            const url = this.getGitHubRawUrl(this.bookingsFile);
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('No bookings found');
                return [];
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            console.log(`📅 Loaded ${data.length} bookings`);
            return data;
        } catch (error) {
            console.log('No bookings found, starting fresh');
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
            const bookings = await this.loadBookings();
            bookings.push(bookingData);
            
            const worksheet = XLSX.utils.json_to_sheet(bookings);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
            
            console.log('✅ Booking saved:', bookingData['Booking ID']);
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
            const overrides = await this.loadAvailabilityOverrides();
            const existingOverride = overrides.find(o => o.Date === date);
            
            if (existingOverride) {
                existingOverride.Booked = (existingOverride.Booked || 0) + guests;
                existingOverride.Available = (existingOverride.MaxBookings || 10) - existingOverride.Booked;
            }
            
            console.log(`✅ Availability updated for ${date}`);
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
}

// Make globally available
if (typeof window !== 'undefined') {
    window.ExcelHandler = ExcelHandler;
}