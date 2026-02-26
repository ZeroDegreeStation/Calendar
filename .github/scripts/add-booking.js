const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read booking data
const bookingData = JSON.parse(fs.readFileSync('booking.json', 'utf8'));

// Path to Excel file
const excelFilePath = path.join('data-repo', 'data', 'calendar-bookings.xlsx');

// Initialize
let workbook;
let bookings = [];

try {
  // Read existing file if it exists
  if (fs.existsSync(excelFilePath)) {
    workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    bookings = XLSX.utils.sheet_to_json(worksheet);
  } else {
    workbook = XLSX.utils.book_new();
  }
} catch (error) {
  console.error('Error reading Excel:', error);
  workbook = XLSX.utils.book_new();
}

// Create new booking record
const newBooking = {
  'Booking ID': bookingData.bookingId,
  'Date': bookingData.date,
  'Customer Name': bookingData.name,
  'Email': bookingData.email,
  'Phone': bookingData.phone || '',
  'Guests': bookingData.guests,
  'Plan': bookingData.plan,
  'Plan Price': bookingData.planPrice,
  'Total Price': bookingData.totalPrice,
  'Status': 'Confirmed',
  'Booking Date': new Date().toISOString().split('T')[0],
  'Special Requests': bookingData.requests || ''
};

// Add to bookings
bookings.push(newBooking);

// Create worksheet
const worksheet = XLSX.utils.json_to_sheet(bookings);

// Clear existing sheets
if (workbook.SheetNames.length > 0) {
  workbook.SheetNames.forEach(name => delete workbook.Sheets[name]);
  workbook.SheetNames = [];
}

// Add new sheet
XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');

// Ensure directory exists
fs.mkdirSync(path.dirname(excelFilePath), { recursive: true });

// Write file
XLSX.writeFile(workbook, excelFilePath);

console.log(`✅ Added booking: ${bookingData.bookingId}`);
console.log(`📊 Total bookings: ${bookings.length}`);