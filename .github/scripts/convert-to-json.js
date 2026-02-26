const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Converting Excel to JSON...');

function normalizeDate(dateVal) {
  if (!dateVal && dateVal !== 0) {
    console.log('⚠️ Null or undefined date');
    return null;
  }
  
  console.log(`🔄 Processing date:`, dateVal, `(type: ${typeof dateVal})`);
  
  // Handle Excel serial number
  if (typeof dateVal === 'number') {
    try {
      // Excel serial date conversion
      // Excel dates start from 1900-01-00 (day 1 = 1900-01-01)
      const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
      const date = new Date(excelEpoch.getTime() + (dateVal * 86400000));
      
      console.log(`  Excel serial ${dateVal} →`, date.toDateString());
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const result = `${month}/${day}/${year}`;
      console.log(`  → ${result}`);
      return result;
    } catch (e) {
      console.log(`❌ Error converting Excel serial:`, e);
      return null;
    }
  }
  
  // Handle string dates
  if (typeof dateVal === 'string') {
    // Try MM/DD/YYYY
    const mdyMatch = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      console.log(`  String MM/DD/YYYY: ${dateVal}`);
      return dateVal;
    }
    
    // Try YYYY-MM-DD
    const ymdMatch = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const [_, year, month, day] = ymdMatch;
      const result = `${parseInt(month)}/${parseInt(day)}/${year}`;
      console.log(`  Converted YYYY-MM-DD to: ${result}`);
      return result;
    }
    
    // Try Excel string format that might have time
    const excelStringMatch = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (excelStringMatch) {
      const [_, month, day, year] = excelStringMatch;
      const result = `${parseInt(month)}/${parseInt(day)}/${year}`;
      console.log(`  Extracted from Excel string: ${result}`);
      return result;
    }
  }
  
  console.log(`❌ Could not parse date:`, dateVal);
  return null;
}


// Create public-data directory
fs.mkdirSync('public-data', { recursive: true });

// Load availability (static rules)
let availabilityMap = new Map(); // date -> { status, maxBookings, price, notes, staticBooked }

const availPath = path.join('private-data', 'data', 'calendar-availability.xlsx');
if (fs.existsSync(availPath)) {
  console.log('📅 Processing availability...');
  const wb = XLSX.readFile(availPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
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
      
      console.log(`📅 ${date}: Static status=${row.Status}, staticBooked=${staticBooked}`);
    }
  });
  
  console.log(`✅ Loaded ${availabilityMap.size} availability rules`);
}

// Load bookings (dynamic)
let dynamicBookingsByDate = new Map(); // date -> count of bookings

const bookingsPath = path.join('private-data', 'data', 'calendar-bookings.xlsx');
if (fs.existsSync(bookingsPath)) {
  console.log('📋 Processing bookings...');
  const wb = XLSX.readFile(bookingsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  data.forEach(row => {
    const date = normalizeDate(row.Date || row['Date']);
    if (date) {
      const currentCount = dynamicBookingsByDate.get(date) || 0;
      dynamicBookingsByDate.set(date, currentCount + 1);
    }
  });
  
  console.log(`✅ Loaded ${dynamicBookingsByDate.size} dates with dynamic bookings`);
}

// Combine both sources
const combined = [];

// Get all unique dates from both sources
const allDates = new Set([
  ...availabilityMap.keys(),
  ...dynamicBookingsByDate.keys()
]);

// For next 90 days (to ensure future dates are covered)
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

// Process each date
allDates.forEach(date => {
  const availability = availabilityMap.get(date) || {
    status: 'Available',
    maxBookings: 2,
    staticBooked: 0,
    price: null,
    notes: ''
  };
  
  const dynamicBooked = dynamicBookingsByDate.get(date) || 0;
  
  // CRITICAL: Add staticBooked from availability + dynamicBooked from bookings
  const totalBooked = availability.staticBooked + dynamicBooked;
  const availableSpots = availability.maxBookings - totalBooked;
  
  // Determine final status
  let finalStatus = availability.status;
  
  // If status is Closed, it overrides everything
  if (availability.status === 'Closed') {
    finalStatus = 'Closed';
  } 
  // Otherwise calculate based on availability
  else {
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
    booked: totalBooked,
    available: Math.max(0, availableSpots),
    price: availability.price,
    notes: availability.notes
  });
});

// Sort by date
combined.sort((a, b) => {
  const [aMonth, aDay, aYear] = a.date.split('/').map(Number);
  const [bMonth, bDay, bYear] = b.date.split('/').map(Number);
  const aDate = new Date(aYear, aMonth - 1, aDay);
  const bDate = new Date(bYear, bMonth - 1, bDay);
  return aDate - bDate;
});

// Save combined data
fs.writeFileSync('public-data/availability.json', JSON.stringify(combined, null, 2));
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
  
  fs.writeFileSync('public-data/bookings-summary.json', JSON.stringify(stats, null, 2));
  console.log(`✅ Saved ${anonymized.length} anonymized bookings`);
}

// Add timestamp
fs.writeFileSync('public-data/timestamp.txt', Date.now().toString());
console.log('✅ Timestamp saved');