const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📝 Processing new booking...');
console.log('Current directory:', process.cwd());

// Read directly from environment variable (NO booking.json needed!)
let bookingData;
try {
  bookingData = JSON.parse(process.env.BOOKING_DATA || '{}');
  console.log('✅ Booking data loaded from environment');
  console.log('Booking ID:', bookingData.bookingId);
} catch (e) {
  console.error('❌ Error parsing environment data:', e);
  process.exit(1);
}

if (!bookingData || !bookingData.bookingId) {
  console.error('❌ No booking data received');
  process.exit(1);
}

// Path to private repo Excel file (going up one level from public-repo)
const excelFilePath = path.join('..', 'private-data', 'data', 'calendar-bookings.xlsx');
console.log('📁 Excel file path:', excelFilePath);

let workbook;
let bookings = [];

try {
  // Read existing file if it exists
  if (fs.existsSync(excelFilePath)) {
    console.log('📖 Reading existing Excel file...');
    workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    bookings = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📊 Found ${bookings.length} existing bookings`);
  } else {
    console.log('📁 Creating new Excel file...');
    workbook = XLSX.utils.book_new();
  }
} catch (error) {
  console.error('❌ Error reading Excel:', error);
  workbook = XLSX.utils.book_new();
}

// Create new booking record
const newBooking = {
  'Booking ID': bookingData.bookingId || 'UNKNOWN',
  'Date': bookingData.date || '',
  'Customer Name': bookingData.name || '',
  'Email': bookingData.email || '',
  'Phone': bookingData.phone || '',
  'Guests': bookingData.guests || 1,
  'Plan': bookingData.plan || '',
  'Plan Price': bookingData.planPrice || 0,
  'Total Price': bookingData.totalPrice || 0,
  'Status': 'Confirmed',
  'Booking Date': new Date().toLocaleDateString('en-US'),
  'Special Requests': bookingData.requests || ''
};

console.log('➕ Adding new booking:', newBooking['Booking ID']);
console.log('Booking details:', JSON.stringify(newBooking, null, 2));

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
const dataDir = path.dirname(excelFilePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Write file
XLSX.writeFile(workbook, excelFilePath);

console.log(`✅ Successfully added booking: ${newBooking['Booking ID']}`);
console.log(`📊 Total bookings: ${bookings.length}`);