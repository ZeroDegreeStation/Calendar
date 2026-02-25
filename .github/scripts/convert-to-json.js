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

// Process availability
const availPath = path.join('..', 'private-data', 'data', 'calendar-availability.xlsx');
if (fs.existsSync(availPath)) {
  console.log('📅 Processing availability...');
  const wb = XLSX.readFile(availPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  const processed = data.map(row => ({
    date: normalizeDate(row.Date || row['Date']),
    status: row.Status || 'Available',
    maxBookings: row.MaxBookings ? parseInt(row.MaxBookings) : 2,
    booked: row.Booked ? parseInt(row.Booked) : 0
  })).filter(item => item.date);
  
  fs.writeFileSync('public-data/availability.json', JSON.stringify(processed));
  console.log(`✅ Saved ${processed.length} availability records`);
}

// Add timestamp
fs.writeFileSync('public-data/timestamp.txt', Date.now().toString());
console.log('✅ Timestamp saved');