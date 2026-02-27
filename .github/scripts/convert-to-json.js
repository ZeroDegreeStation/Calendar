const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Converting Excel to JSON...');
console.log('Current directory:', process.cwd());

// Helper to normalize date
function normalizeDate(dateVal) {
  if (!dateVal && dateVal !== 0) return null;
  
  if (typeof dateVal === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + (dateVal * 86400000));
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  if (typeof dateVal === 'string') {
    const mdyMatch = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) return dateVal;
    
    const ymdMatch = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const [_, year, month, day] = ymdMatch;
      return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }
  }
  return null;
}

// Create public-data directory
fs.mkdirSync('public-data', { recursive: true });

// IMPORTANT: Go up one level to find private-data
const availPath = path.join('..', 'private-data', 'data', 'calendar-availability.xlsx');
const bookingsPath = path.join('..', 'private-data', 'data', 'calendar-bookings.xlsx');

console.log('Looking for availability at:', path.resolve(availPath));
console.log('Looking for bookings at:', path.resolve(bookingsPath));

// Load availability
let availabilityMap = new Map();

if (fs.existsSync(availPath)) {
  console.log('📅 Processing availability...');
  const wb = XLSX.readFile(availPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  console.log(`Found ${data.length} availability records`);
  
  data.forEach(row => {
    const date = normalizeDate(row.Date || row['Date']);
    if (date) {
      const staticBooked = row.Booked ? parseInt(row.Booked) : 0;
      
      availabilityMap.set(date, {
        status: row.Status || 'Available',
        price: row.Price ? parseInt(row.Price) : null,
        maxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
        staticBooked: staticBooked,
        notes: row.Notes || ''
      });
      
      console.log(`📅 ${date}: Status=${row.Status}, staticBooked=${staticBooked}`);
    }
  });
  
  console.log(`✅ Loaded ${availabilityMap.size} availability rules`);
} else {
  console.log('❌ Availability file not found - will use defaults');
}

// Load bookings
let dynamicBookingsByDate = new Map();

if (fs.existsSync(bookingsPath)) {
  console.log('📋 Processing bookings...');
  const wb = XLSX.readFile(bookingsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  console.log(`Found ${data.length} booking records`);
  
  data.forEach(row => {
    const date = normalizeDate(row.Date || row['Date']);
    if (date) {
      const currentCount = dynamicBookingsByDate.get(date) || 0;
      dynamicBookingsByDate.set(date, currentCount + 1);
    }
  });
  
  console.log(`✅ Loaded ${dynamicBookingsByDate.size} dates with dynamic bookings`);
  console.log('Booking counts:', Object.fromEntries(dynamicBookingsByDate));
} else {
  console.log('❌ Bookings file not found');
}

// Combine both sources
const combined = [];

// Get all unique dates
const allDates = new Set([
  ...availabilityMap.keys(),
  ...dynamicBookingsByDate.keys()
]);

// Add next 90 days
const today = new Date();
for (let i = 0; i < 90; i++) {
  const date = new Date(today);
  date.setDate(today.getDate() + i);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const dateStr = `${month}/${day}/${year}`;
  allDates.add(dateStr);
}

console.log(`Processing ${allDates.size} unique dates`);

allDates.forEach(date => {
  const availability = availabilityMap.get(date) || {
    status: 'Available',
    maxBookings: 2,
    staticBooked: 0,
    price: null,
    notes: ''
  };
  
  const dynamicBooked = dynamicBookingsByDate.get(date) || 0;
  const totalBooked = availability.staticBooked + dynamicBooked;
  const availableSpots = availability.maxBookings - totalBooked;
  
  let finalStatus = availability.status;
  if (availability.status === 'Closed') {
    finalStatus = 'Closed';
  } else {
    if (availableSpots <= 0) finalStatus = 'Booked';
    else if (availableSpots === 1) finalStatus = 'Limited';
    else finalStatus = 'Available';
  }
  
  combined.push({
    date: date,
    status: finalStatus,
    maxBookings: availability.maxBookings,
    booked: totalBooked,
    available: Math.max(0, availableSpots),
    price: availability.price,
    notes: availability.notes
  });
});

// Sort by date
combined.sort((a, b) => {
  const [aM, aD, aY] = a.date.split('/').map(Number);
  const [bM, bD, bY] = b.date.split('/').map(Number);
  return new Date(aY, aM-1, aD) - new Date(bY, bM-1, bD);
});

// Save combined data
fs.writeFileSync('public-data/availability.json', JSON.stringify(combined, null, 2));
console.log(`✅ Saved ${combined.length} combined availability records`);

// Save anonymized bookings
if (fs.existsSync(bookingsPath)) {
  const wb = XLSX.readFile(bookingsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
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
  
  const stats = {
    totalBookings: anonymized.length,
    totalRevenue: anonymized.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
    lastUpdated: new Date().toISOString(),
    recentBookings: anonymized.slice(-20).reverse()
  };
  
  fs.writeFileSync('public-data/bookings-summary.json', JSON.stringify(stats, null, 2));
  console.log(`✅ Saved ${anonymized.length} anonymized bookings`);
}

// Add timestamp
fs.writeFileSync('public-data/timestamp.txt', Date.now().toString());
console.log('✅ Timestamp saved');