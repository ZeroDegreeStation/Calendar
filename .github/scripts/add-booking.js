const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the booking data from the temp file
const bookingData = JSON.parse(fs.readFileSync('booking.json', 'utf8'));

// Path to the Excel file in the data repo
const excelFilePath = path.join('data-repo', 'data', 'calendar-bookings.xlsx');

// Initialize workbook and worksheet
let workbook;
let bookings = [];

try {
  // Try to read existing Excel file
  if (fs.existsSync(excelFilePath)) {
    workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    bookings = XLSX.utils.sheet_to_json(worksheet);
  } else {
    // Create new workbook if file doesn't exist
    workbook = XLSX.utils.book_new();
  }
} catch (error) {
  console.error('Error reading Excel file:', error);
  workbook = XLSX.utils.book_new();
}

// Create the new booking record
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

// Add to bookings array
bookings.push(newBooking);

// Convert back to worksheet
const newWorksheet = XLSX.utils.json_to_sheet(bookings);

// Remove the default sheet if it exists
if (workbook.SheetNames.length > 0) {
  workbook.SheetNames.forEach(sheetName => {
    workbook.Sheets[sheetName] = undefined;
  });
  workbook.SheetNames = [];
}

// Add the new worksheet
XLSX.utils.book_append_sheet(workbook, newWorksheet, 'Bookings');

// Ensure the data directory exists
const dataDir = path.join('data-repo', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Write the file
XLSX.writeFile(workbook, excelFilePath);

console.log(`✅ Successfully added booking: ${bookingData.bookingId}`);
console.log(`📊 Total bookings: ${bookings.length}`);