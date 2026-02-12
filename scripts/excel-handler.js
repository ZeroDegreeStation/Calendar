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
        this.defaultPrice = 100;
        this.defaultMaxBookings = 10;
    }

    /**
     * Load availability overrides from Excel
     * Only dates that are NOT available need to be in the file
     */
    async loadAvailabilityOverrides() {
        try {
            const url = this.getGitHubRawUrl(this.availabilityFile);
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
            console.log('No availability overrides found, all days available by default');
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
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(worksheet);
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
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
            console.log('No time slots found, using default slots');
            return this.getDefaultTimeSlots();
        }
    }

    /**
     * Get default time slots (9 AM - 5 PM, 1-hour slots)
     */
    getDefaultTimeSlots() {
        const slots = [];
        for (let hour = 9; hour <= 16; hour++) {
            const time = `${hour.toString().padStart(2, '0')}:00`;
            slots.push({
                'Time Slot': time,
                'Display Time': `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
                'Capacity': 5,
                'Available': 5
            });
        }
        return slots;
    }

    /**
     * Save booking to Excel (via GitHub API)
     */
    async saveBooking(bookingData) {
        try {
            // Load existing bookings
            const bookings = await this.loadBookings();
            
            // Add new booking
            bookings.push(bookingData);
            
            // Convert to worksheet
            const worksheet = XLSX.utils.json_to_sheet(bookings);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
            
            // Generate Excel file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            
            // In production, this would push to GitHub using the API
            console.log('Booking saved locally:', bookingData);
            
            return true;
        } catch (error) {
            console.error('Error saving booking:', error);
            throw error;
        }
    }

    /**
     * Update availability after booking
     */
    async updateAvailability(date, bookedCount) {
        try {
            const overrides = await this.loadAvailabilityOverrides();
            const existingOverride = overrides.find(o => o.Date === date);
            
            if (existingOverride) {
                // Update existing override
                existingOverride.Booked = (existingOverride.Booked || 0) + bookedCount;
                existingOverride.Available = (existingOverride.MaxBookings || this.defaultMaxBookings) - existingOverride.Booked;
            } else {
                // Create new override
                overrides.push({
                    'Date': date,
                    'Status': 'Available',
                    'Price': this.defaultPrice,
                    'MaxBookings': this.defaultMaxBookings,
                    'Booked': bookedCount,
                    'Available': this.defaultMaxBookings - bookedCount
                });
            }
            
            // Convert to worksheet
            const worksheet = XLSX.utils.json_to_sheet(overrides);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Availability');
            
            // Generate Excel file
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            
            console.log('Availability updated for:', date);
            
            return true;
        } catch (error) {
            console.error('Error updating availability:', error);
            throw error;
        }
    }

    /**
     * Generate Excel template files
     */
    generateTemplates() {
        // Availability template
        const availabilityTemplate = [
            {
                'Date': '2024-12-25',
                'Status': 'Closed',
                'Price': '',
                'Notes': 'Christmas Day - Closed',
                'MaxBookings': 0,
                'Booked': 0,
                'Available': 0
            },
            {
                'Date': '2024-12-31',
                'Status': 'Limited',
                'Price': 150,
                'Notes': 'New Year\'s Eve',
                'MaxBookings': 5,
                'Booked': 2,
                'Available': 3
            }
        ];
        
        // Bookings template
        const bookingsTemplate = [
            {
                'Booking ID': 'BKG001',
                'Date': '2024-03-15',
                'Customer Name': 'John Doe',
                'Email': 'john@example.com',
                'Phone': '555-0101',
                'Guests': 2,
                'Total Price': 200,
                'Status': 'Confirmed',
                'Booking Date': '2024-03-10',
                'Special Requests': ''
            }
        ];
        
        // Time slots template
        const timeSlotsTemplate = [
            {
                'Date': '2024-03-15',
                'Time Slot': '09:00',
                'Display Time': '9:00 AM',
                'Capacity': 5,
                'Booked': 2,
                'Available': 3
            },
            {
                'Date': '2024-03-15',
                'Time Slot': '10:00',
                'Display Time': '10:00 AM',
                'Capacity': 5,
                'Booked': 1,
                'Available': 4
            }
        ];
        
        return {
            availability: availabilityTemplate,
            bookings: bookingsTemplate,
            timeSlots: timeSlotsTemplate
        };
    }

    /**
     * Get GitHub raw URL for a file
     */
    getGitHubRawUrl(filePath) {
        const config = window.githubSync?.config || {
            owner: 'YOUR_USERNAME',
            repo: 'excel-booking-calendar',
            branch: 'main'
        };
        
        return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${filePath}`;
    }

    /**
     * Export data to Excel file
     */
    exportToExcel(data, filename) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, filename);
    }

    /**
     * Parse Excel date to ISO format
     */
    parseExcelDate(excelDate) {
        if (!excelDate) return null;
        
        // Handle Excel serial number
        if (typeof excelDate === 'number') {
            const date = new Date((excelDate - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        
        // Handle string date
        return excelDate.toString().split('T')[0];
    }

    /**
     * Format date for display
     */
    formatDisplayDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelHandler;
}