const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const db = new Database('./vendor_system.db');

// Load price history
const priceHistoryPath = path.join(__dirname, '..', 'price_history.json');
const priceHistory = JSON.parse(fs.readFileSync(priceHistoryPath, 'utf8'));

console.log(`Loading ${priceHistory.length} line items...`);

// Clear existing price history
db.prepare('DELETE FROM price_history').run();

// Insert price history
const insertPrice = db.prepare(`
  INSERT INTO price_history (id, vendor_id, category, item_description, unit_cost, quantity, total_cost, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Get existing vendors
const existingVendors = {};
db.prepare('SELECT id, company_name FROM vendors').all().forEach(v => {
  existingVendors[v.company_name.toLowerCase()] = v.id;
});

// Insert vendor if not exists
const insertVendor = db.prepare(`
  INSERT INTO vendors (id, company_name, category, status) VALUES (?, ?, ?, 'Active')
`);

// Track new vendors
const newVendors = new Set();

// Process each line item
let inserted = 0;
for (const item of priceHistory) {
  let vendorId = null;
  
  if (item.vendor) {
    // Clean vendor name
    let vendorName = item.vendor.trim();
    
    // Skip numeric-only or invalid vendors
    if (/^[\d.]+$/.test(vendorName) || vendorName.length < 2) {
      vendorName = null;
    }
    
    if (vendorName) {
      const vendorKey = vendorName.toLowerCase();
      
      if (existingVendors[vendorKey]) {
        vendorId = existingVendors[vendorKey];
      } else if (!newVendors.has(vendorKey)) {
        // Add new vendor
        vendorId = uuidv4();
        insertVendor.run(vendorId, vendorName, item.category);
        existingVendors[vendorKey] = vendorId;
        newVendors.add(vendorKey);
      } else {
        vendorId = existingVendors[vendorKey];
      }
    }
  }
  
  // Insert price history record
  insertPrice.run(
    uuidv4(),
    vendorId,
    item.category,
    item.description.substring(0, 500),
    item.unit_cost || 0,
    item.qty || 1,
    item.total_cost || 0,
    item.date || new Date().toISOString()
  );
  inserted++;
}

// Update vendor stats from price history
db.exec(`
  UPDATE vendors SET
    total_spent = COALESCE((
      SELECT SUM(total_cost) FROM price_history WHERE vendor_id = vendors.id
    ), 0),
    projects_count = COALESCE((
      SELECT COUNT(DISTINCT item_description) FROM price_history WHERE vendor_id = vendors.id
    ), 0)
`);

console.log(`\nInserted ${inserted} price history records`);
console.log(`Added ${newVendors.size} new vendors`);
console.log(`\nDatabase stats:`);
console.log(`  Vendors: ${db.prepare('SELECT COUNT(*) as c FROM vendors').get().c}`);
console.log(`  Price History: ${db.prepare('SELECT COUNT(*) as c FROM price_history').get().c}`);
console.log(`  Projects: ${db.prepare('SELECT COUNT(*) as c FROM projects').get().c}`);

// Show top vendors by spend
console.log(`\nTop 15 vendors by total spend:`);
db.prepare(`
  SELECT company_name, category, total_spent, projects_count 
  FROM vendors 
  WHERE total_spent > 0 
  ORDER BY total_spent DESC 
  LIMIT 15
`).all().forEach(v => {
  console.log(`  ${v.company_name}: ${v.total_spent.toFixed(0)} OMR (${v.projects_count} items) - ${v.category}`);
});

// Show category breakdown
console.log(`\nPrice history by category:`);
db.prepare(`
  SELECT category, COUNT(*) as items, SUM(total_cost) as total_cost, AVG(unit_cost) as avg_unit_cost
  FROM price_history 
  GROUP BY category 
  ORDER BY total_cost DESC
`).all().forEach(c => {
  console.log(`  ${c.category}: ${c.items} items, ${c.total_cost.toFixed(0)} OMR total, ${c.avg_unit_cost.toFixed(2)} OMR avg`);
});

db.close();
