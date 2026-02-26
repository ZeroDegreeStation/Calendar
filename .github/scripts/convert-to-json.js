const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Converting Excel to JSON...');
console.log('=' .repeat(60));

// Step 1: Show current directory structure
console.log('📁 CURRENT DIRECTORY:', process.cwd());

// Step 2: List ALL files and folders recursively
function listFiles(dir, depth = 0) {
  const indent = '  '.repeat(depth);
  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        console.log(`${indent}📂 ${item}/`);
        if (depth < 3) listFiles(itemPath, depth + 1);
      } else {
        const size = (stats.size / 1024).toFixed(2) + ' KB';
        console.log(`${indent}📄 ${item} (${size})`);
      }
    });
  } catch (err) {
    console.log(`${indent}❌ Cannot read directory: ${dir}`);
  }
}

console.log('\n🔍 SCANNING ALL FILES:');
listFiles('.', 0);

// Step 3: Check specific paths
console.log('\n🔍 CHECKING SPECIFIC PATHS:');
const pathsToCheck = [
  'private-data',
  'private-data/data',
  'public-repo',
  'public-repo/private-data',
  'public-repo/private-data/data',
  path.join(process.cwd(), 'private-data'),
  path.join(process.cwd(), 'private-data', 'data')
];

pathsToCheck.forEach(p => {
  const exists = fs.existsSync(p);
  console.log(`  ${exists ? '✅' : '❌'} ${p}`);
  if (exists) {
    try {
      const files = fs.readdirSync(p);
      files.forEach(f => console.log(`      📄 ${f}`));
    } catch (e) {
      console.log(`      ❌ Cannot read directory`);
    }
  }
});

// Helper to normalize date with detailed logging
function normalizeDate(dateVal, rowIndex) {
  console.log(`\n  📅 Row ${rowIndex} - Raw date:`, dateVal, `(type: ${typeof dateVal})`);
  
  if (!dateVal && dateVal !== 0) {
    console.log('  ⚠️ Null or undefined date');
    return null;
  }
  
  // Handle Excel serial number
  if (typeof dateVal === 'number') {
    try {
      // Excel serial date conversion
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + (dateVal * 86400000));
      
      console.log(`  🔢 Excel serial ${dateVal} → ${date.toISOString()}`);
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const result = `${month}/${day}/${year}`;
      console.log(`  ✅ Converted to: ${result}`);
      return result;
    } catch (e) {
      console.log(`  ❌ Error converting: ${e.message}`);
      return null;
    }
  }
  
  // Handle string dates
  if (typeof dateVal === 'string') {
    console.log(`  📝 String value: "${dateVal}"`);
    
    // Try MM/DD/YYYY
    const mdyMatch = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      console.log(`  ✅ Valid MM/DD/YYYY format`);
      return dateVal;
    }
    
    // Try to parse with Date object
    const parsedDate = new Date(dateVal);
    if (!isNaN(parsedDate)) {
      const month = parsedDate.getMonth() + 1;
      const day = parsedDate.getDate();
      const year = parsedDate.getFullYear();
      const result = `${month}/${day}/${year}`;
      console.log(`  ✅ Parsed via Date object: ${result}`);
      return result;
    }
  }
  
  console.log(`  ❌ Could not parse date`);
  return null;
}

// Create public-data directory
fs.mkdirSync('public-data', { recursive: true });
console.log('\n✅ public-data directory ready');

// Try to find the Excel files
let availabilityPath = null;
let bookingsPath = null;

const possibleLocations = [
  'private-data/data/calendar-availability.xlsx',
  'private-data/calendar-availability.xlsx',
  'data/calendar-availability.xlsx',
  'calendar-availability.xlsx',
  path.join('public-repo', 'private-data', 'data', 'calendar-availability.xlsx'),
  path.join('public-repo', 'private-data', 'calendar-availability.xlsx')
];

for (const loc of possibleLocations) {
  const fullPath = path.resolve(loc);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ Found availability at: ${fullPath}`);
    availabilityPath = fullPath;
    break;
  }
}

for (const loc of possibleLocations) {
  const bookingsLoc = loc.replace('availability', 'bookings');
  const fullPath = path.resolve(bookingsLoc);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ Found bookings at: ${fullPath}`);
    bookingsPath = fullPath;
    break;
  }
}

if (!availabilityPath) {
  console.log('❌ Could not find availability.xlsx - will use defaults');
}

if (!bookingsPath) {
  console.log('❌ Could not find bookings.xlsx');
}

// Load availability
let availabilityMap = new Map();

if (availabilityPath) {
  console.log('\n📅 Reading availability file...');
  try {
    const wb = XLSX.readFile(availabilityPath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws);
    
    console.log(`Found ${data.length} rows in availability sheet`);
    
    data.forEach((row, index) => {
      console.log(`\n--- Availability Row ${index + 1} ---`);
      console.log('Full row data:', JSON.stringify(row, null, 2));
      
      const rawDate = row.Date || row['Date'];
      const date = normalizeDate(rawDate, index + 1);
      
      if (date) {
        const staticBooked = row.Booked ? parseInt(row.Booked) : 0;
        const maxBookings = row.MaxBookings ? parseInt(row.MaxBookings) : 2;
        const status = row.Status || 'Available';
        const price = row.Price ? parseInt(row.Price) : null;
        
        console.log(`  ✅ Adding to map: ${date} -> Status=${status}, Booked=${staticBooked}, Max=${maxBookings}`);
        
        availabilityMap.set(date, {
          status: status,
          price: price,
          maxBookings: maxBookings,
          staticBooked: staticBooked,
          notes: row.Notes || ''
        });
      }
    });
    
    console.log(`\n✅ Loaded ${availabilityMap.size} availability rules`);
    console.log('📊 Availability dates:', Array.from(availabilityMap.keys()).join(', '));
    
  } catch (err) {
    console.log('❌ Error reading availability file:', err.message);
  }
}

// Load bookings
let dynamicBookingsByDate = new Map();

if (bookingsPath) {
  console.log('\n📋 Reading bookings file...');
  try {
    const wb = XLSX.readFile(bookingsPath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws);
    
    console.log(`Found ${data.length} rows in bookings sheet`);
    
    data.forEach((row, index) => {
      console.log(`\n--- Booking Row ${index + 1} ---`);
      console.log('Full row data:', JSON.stringify(row, null, 2));
      
      const rawDate = row.Date || row['Date'];
      const date = normalizeDate(rawDate, index + 1);
      
      if (date) {
        const currentCount = dynamicBookingsByDate.get(date) || 0;
        dynamicBookingsByDate.set(date, currentCount + 1);
        console.log(`  ✅ Booking for ${date} (total now: ${currentCount + 1})`);
      }
    });
    
    console.log(`\n✅ Loaded ${dynamicBookingsByDate.size} dates with bookings`);
    console.log('📊 Booking counts:', Object.fromEntries(dynamicBookingsByDate));
    
  } catch (err) {
    console.log('❌ Error reading bookings file:', err.message);
  }
}

// Combine data
console.log('\n🔄 Combining data...');

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

const combined = [];

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
  
  if (availability.status !== 'Available' || dynamicBooked > 0) {
    console.log(`📅 ${date}: ${finalStatus} (booked=${totalBooked}, avail=${availableSpots})`);
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

// Sort and save
combined.sort((a, b) => {
  const [aM, aD, aY] = a.date.split('/').map(Number);
  const [bM, bD, bY] = b.date.split('/').map(Number);
  return new Date(aY, aM-1, aD) - new Date(bY, bM-1, bD);
});

fs.writeFileSync('public-data/availability.json', JSON.stringify(combined, null, 2));
console.log(`\n✅ Saved ${combined.length} records to availability.json`);

// Save timestamp
fs.writeFileSync('public-data/timestamp.txt', Date.now().toString());
console.log('✅ Timestamp saved');
console.log('=' .repeat(60));
console.log('🎉 Conversion complete!');