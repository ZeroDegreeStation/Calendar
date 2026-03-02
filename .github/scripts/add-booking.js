const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📝 Processing new booking...');
console.log('Current directory:', process.cwd());

// Read booking data from environment
let bookingData;
try {
  bookingData = JSON.parse(process.env.BOOKING_DATA || '{}');
  console.log('✅ Booking data loaded from environment');
  console.log('Booking ID:', bookingData.bookingId);
  console.log('Date:', bookingData.date);
} catch (e) {
  console.error('❌ Error parsing environment data:', e);
  process.exit(1);
}

if (!bookingData || !bookingData.bookingId) {
  console.error('❌ No booking data received');
  process.exit(1);
}

// Path to private repo Excel file
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

// ============= OVERBOOKING PROTECTION =============
const MAX_BOOKINGS_PER_DAY = 2;

// Count how many bookings already exist for this date
const bookingsForThisDate = bookings.filter(b => b.Date === bookingData.date);
const currentCount = bookingsForThisDate.length;

console.log(`📊 Current bookings for ${bookingData.date}: ${currentCount}/${MAX_BOOKINGS_PER_DAY}`);

// Check if adding this booking would exceed the limit
if (currentCount >= MAX_BOOKINGS_PER_DAY) {
  console.error(`❌ OVERBOOKING PREVENTED: Date ${bookingData.date} already has ${currentCount} bookings (max ${MAX_BOOKINGS_PER_DAY})`);
  console.log(`⚠️ Booking ${bookingData.bookingId} REJECTED - no availability`);
  
  // Exit with error code to fail the GitHub Action
  process.exit(1);
}

// Also check if this is a multi-night booking
if (bookingData.nights && bookingData.nights > 1) {
  console.log(`📅 Multi-night booking detected (${bookingData.nights} nights)`);
  
  // Parse the start date
  const [month, day, year] = bookingData.date.split('/').map(Number);
  const startDate = new Date(year, month - 1, day);
  
  // Check each night
  for (let i = 0; i < bookingData.nights; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(startDate.getDate() + i);
    
    const checkMonth = checkDate.getMonth() + 1;
    const checkDay = checkDate.getDate();
    const checkYear = checkDate.getFullYear();
    const dateStr = `${checkMonth}/${checkDay}/${checkYear}`;
    
    // Count bookings for this specific date
    const countForDate = bookings.filter(b => b.Date === dateStr).length;
    
    console.log(`📊 ${dateStr}: ${countForDate}/${MAX_BOOKINGS_PER_DAY} bookings`);
    
    if (countForDate >= MAX_BOOKINGS_PER_DAY) {
      console.error(`❌ OVERBOOKING PREVENTED: Date ${dateStr} is already full (${countForDate}/${MAX_BOOKINGS_PER_DAY})`);
      console.log(`⚠️ Booking ${bookingData.bookingId} REJECTED - no availability on ${dateStr}`);
      process.exit(1);
    }
  }
  
  console.log('✅ All dates in multi-night booking have availability');
}
// ============= END OVERBOOKING PROTECTION =============

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