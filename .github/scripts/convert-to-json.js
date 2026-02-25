const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Converting Excel to JSON...');

// Helper to normalize date
function normalizeDate(dateVal) {
  if (!dateVal && dateVal !== 0) return null;
  
  if (typeof dateVal === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + (dateVal * 86400000));
    return date.toISOString().split('T')[0];
  }
  
  if (typeof dateVal === 'string' && dateVal.includes('/')) {
    const [month, day, year] = dateVal.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return dateVal;
}

// Create public-data directory
fs.mkdirSync('public-data', { recursive: true });

// Load availability (static rules)
let availabilityMap = new Map(); // date -> { status, maxBookings, price, notes }

const availPath = path.join('..', 'private-data', 'data', 'calendar-availability.xlsx');
if (fs.existsSync(availPath)) {
  console.log('📅 Processing availability...');
  const wb = XLSX.readFile(availPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  data.forEach(row => {
    const date = normalizeDate(row.Date || row['Date']);
    if (date) {
      availabilityMap.set(date, {
        status: row.Status || 'Available',
        price: row.Price ? parseInt(row.Price) : null,
        maxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
        booked: 0, // Will be filled from bookings
        notes: row.Notes || ''
      });
    }
  });
  
  console.log(`✅ Loaded ${availabilityMap.size} availability rules`);
}

// Load bookings (dynamic)
let bookingsByDate = new Map(); // date -> count of bookings

const bookingsPath = path.join('..', 'private-data', 'data', 'calendar-bookings.xlsx');
if (fs.existsSync(bookingsPath)) {
  console.log('📋 Processing bookings...');
  const wb = XLSX.readFile(bookingsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  data.forEach(row => {
    const date = normalizeDate(row.Date || row['Date']);
    if (date) {
      const currentCount = bookingsByDate.get(date) || 0;
      bookingsByDate.set(date, currentCount + 1);
    }
  });
  
  console.log(`✅ Loaded ${bookingsByDate.size} dates with bookings`);
}

// Combine both sources
const combined = [];

// Get all unique dates from both sources
const allDates = new Set([
  ...availabilityMap.keys(),
  ...bookingsByDate.keys()
]);

// For next 90 days (to ensure future dates are covered)
const today = new Date();
for (let i = 0; i < 90; i++) {
  const date = new Date(today);
  date.setDate(today.getDate() + i);
  const dateStr = date.toISOString().split('T')[0];
  allDates.add(dateStr);
}

// Process each date
allDates.forEach(date => {
  const availability = availabilityMap.get(date) || {
    status: 'Available',
    maxBookings: 2,
    booked: 0
  };
  
  const bookedCount = bookingsByDate.get(date) || 0;
  
  // Calculate final status based on availability rules + bookings
  let finalStatus = availability.status;
  const availableSpots = availability.maxBookings - bookedCount;
  
  // Override status based on bookings if needed
  if (availability.status === 'Available' || availability.status === 'Limited') {
    if (availableSpots <= 0) {
      finalStatus = 'Booked';
    } else if (availableSpots === 1) {
      finalStatus = 'Limited';
    } else {
      finalStatus = 'Available';
    }
  }
  
  combined.push({
    date: date,
    status: finalStatus,
    maxBookings: availability.maxBookings,
    booked: bookedCount,
    available: Math.max(0, availableSpots),
    price: availability.price,
    notes: availability.notes
  });
});

// Sort by date
combined.sort((a, b) => a.date.localeCompare(b.date));

// Save combined data
fs.writeFileSync('public-data/availability.json', JSON.stringify(combined));
console.log(`✅ Saved ${combined.length} combined availability records`);

// Also save raw bookings for admin (anonymized)
if (fs.existsSync(bookingsPath)) {
  const wb = XLSX.readFile(bookingsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  // Anonymize for public view
  const anonymized = data.map(row => {
    let name = row['Customer Name'] || '';
    if (name) {
      const parts = name.split(' ');
      name = parts.map(p => {
        if (p.length <= 2) return p;
        return p[0] + '*'.repeat(p.length - 2) + p[p.length - 1];
      }).join(' ');
    }
    
    return {
      bookingId: row['Booking ID'] || '',
      date: normalizeDate(row.Date || row['Date']),
      name: name,
      guests: row.Guests ? parseInt(row.Guests) : 1,
      plan: row.Plan || '',
      totalPrice: row['Total Price'] ? parseInt(row['Total Price']) : 0
    };
  }).filter(item => item.date);
  
  // Create summary stats
  const stats = {
    totalBookings: anonymized.length,
    totalRevenue: anonymized.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
    lastUpdated: new Date().toISOString(),
    recentBookings: anonymized.slice(-20).reverse()
  };
  
  fs.writeFileSync('public-data/bookings-summary.json', JSON.stringify(stats));
  console.log(`✅ Saved ${anonymized.length} anonymized bookings`);
}

// Add timestamp
fs.writeFileSync('public-data/timestamp.txt', Date.now().toString());
console.log('✅ Timestamp saved');