const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const db = new Database('./vendor_system.db');

// Create tables
db.exec(`
  -- Vendors table
  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    category TEXT,
    subcategory TEXT,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    whatsapp TEXT,
    address TEXT,
    bank_name TEXT,
    account_number TEXT,
    iban TEXT,
    payment_terms TEXT DEFAULT 'NET30',
    rating REAL DEFAULT 0,
    total_spent REAL DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    avg_response_hours INTEGER,
    on_time_rate REAL DEFAULT 100,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Projects table
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_number TEXT,
    client TEXT NOT NULL,
    subject TEXT,
    event_date DATE,
    total_cost REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    margin REAL DEFAULT 0,
    margin_pct REAL DEFAULT 0,
    status TEXT DEFAULT 'Active',
    year INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- RFQs table
  CREATE TABLE IF NOT EXISTS rfqs (
    id TEXT PRIMARY KEY,
    rfq_number TEXT UNIQUE,
    project_id TEXT,
    title TEXT NOT NULL,
    category TEXT,
    specifications TEXT,
    quantity INTEGER DEFAULT 1,
    deadline DATETIME,
    delivery_date DATE,
    estimated_cost REAL,
    status TEXT DEFAULT 'Draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- RFQ Vendors junction table
  CREATE TABLE IF NOT EXISTS rfq_vendors (
    id TEXT PRIMARY KEY,
    rfq_id TEXT,
    vendor_id TEXT,
    sent_at DATETIME,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY (rfq_id) REFERENCES rfqs(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  );

  -- Quotes table
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    rfq_id TEXT,
    vendor_id TEXT,
    amount REAL NOT NULL,
    breakdown TEXT,
    validity_days INTEGER DEFAULT 30,
    notes TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY (rfq_id) REFERENCES rfqs(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  );

  -- Historical pricing table (for AI predictions)
  CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    vendor_id TEXT,
    category TEXT,
    item_description TEXT,
    unit_cost REAL,
    quantity INTEGER,
    total_cost REAL,
    project_id TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Categories reference table
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    typical_services TEXT
  );
`);

// Insert categories
const categories = [
  { name: 'Production & Fabrication', description: 'Event builds, structures, backdrops', typical_services: 'MDF structures, metal frames, stages, monuments, platforms, booths' },
  { name: 'AV & Sound', description: 'Audio visual equipment', typical_services: 'Sound systems, LED screens, lighting, projectors, microphones' },
  { name: 'Printing & Signage', description: 'Print materials and signage', typical_services: 'Banners, flags, totems, brochures, business cards, stickers, rollups' },
  { name: 'Furniture Rental', description: 'Event furniture', typical_services: 'Tables, chairs, sofas, poufs, cocktail tables, lounge furniture' },
  { name: 'Photography & Video', description: 'Visual content creation', typical_services: 'Event photography, videography, drone footage, editing' },
  { name: 'Hospitality Staff', description: 'Event personnel', typical_services: 'Hostesses, promoters, ushers, registration staff' },
  { name: 'Entertainment', description: 'Performers and artists', typical_services: 'DJs, dancers, MCs, musicians, live performers' },
  { name: 'Catering & F&B', description: 'Food and beverage', typical_services: 'Catering, coffee stations, beverages, gala dinners' },
  { name: 'Transportation', description: 'Logistics and transport', typical_services: 'Vehicle transport, delivery, boom loaders, logistics' },
  { name: 'Florals & Decor', description: 'Decorative elements', typical_services: 'Flower arrangements, centerpieces, decorations, plants' },
  { name: 'Technology', description: 'Tech solutions', typical_services: 'Interactive screens, apps, registration systems, digital displays' },
  { name: 'Promotional Items', description: 'Giveaways and merch', typical_services: 'Branded gifts, merchandise, giveaways, trophies' },
];

const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (id, name, description, typical_services) 
  VALUES (?, ?, ?, ?)
`);

categories.forEach(cat => {
  insertCategory.run(uuidv4(), cat.name, cat.description, cat.typical_services);
});

// Seed vendors from extracted data
const vendorData = [
  { name: 'High Mark', category: 'Production & Fabrication', phone: '', notes: 'Primary fabrication vendor' },
  { name: 'Al Tanfith', category: 'Production & Fabrication', phone: '', notes: 'Haithem/Waleed contact' },
  { name: 'Smart Modern Business', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Manual', category: 'AV & Sound', phone: '', notes: 'AV equipment rental' },
  { name: 'Intelligent', category: 'AV & Sound', phone: '', notes: 'Screen rentals' },
  { name: 'Smart Print', category: 'Printing & Signage', phone: '', notes: '' },
  { name: 'Ahmed Al Marikhi', category: 'Printing & Signage', phone: '', notes: 'Smart print contact' },
  { name: 'Bestline', category: 'Printing & Signage', phone: '', notes: 'Suresh contact' },
  { name: 'Mosaic', category: 'Furniture Rental', phone: '', notes: 'Furniture rental' },
  { name: 'Al Khaleej Tents', category: 'Furniture Rental', phone: '', notes: 'Mahoon contact' },
  { name: 'Al Areesh', category: 'Furniture Rental', phone: '', notes: 'Suresh contact' },
  { name: 'Anoop', category: 'Photography & Video', phone: '', notes: 'Primary photographer/videographer' },
  { name: 'The Agency', category: 'Hospitality Staff', phone: '', notes: 'Internal - hostess coordination' },
  { name: 'Behrang', category: 'Florals & Decor', phone: '', notes: 'Cash payments' },
  { name: 'AGS Logistics', category: 'Transportation', phone: '', notes: '' },
  { name: 'NIJIL Dubai', category: 'Production & Fabrication', phone: '', notes: 'Car covers, specialty items' },
  { name: 'Charmz', category: 'Promotional Items', phone: '', notes: '' },
  { name: 'Adwa AL Amerat', category: 'AV & Sound', phone: '', notes: '' },
  { name: 'Rehan', category: 'Production & Fabrication', phone: '', notes: 'Cash vendor' },
  { name: 'GLM', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Khalid', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Rashid', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Mohammad bin Sulaiman', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Ali', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Ammar', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Amir Erfan', category: 'Production & Fabrication', phone: '', notes: 'Teymur' },
  { name: 'Al Saed Global', category: 'Production & Fabrication', phone: '', notes: '' },
  { name: 'Alzeera', category: 'Printing & Signage', phone: '', notes: '' },
  { name: 'Eagles', category: 'Production & Fabrication', phone: '', notes: '' },
];

const insertVendor = db.prepare(`
  INSERT OR IGNORE INTO vendors (id, company_name, category, phone, notes, status) 
  VALUES (?, ?, ?, ?, ?, 'Active')
`);

vendorData.forEach(v => {
  insertVendor.run(uuidv4(), v.name, v.category, v.phone, v.notes);
});

// Load and import project data
try {
  const projectData = JSON.parse(fs.readFileSync('/home/claude/cost_data_v2.json', 'utf8'));
  
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (id, project_number, client, subject, year, total_cost, total_price, margin, margin_pct, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
  `);
  
  projectData.forEach(p => {
    if (p.project_number) {
      insertProject.run(
        uuidv4(),
        p.project_number,
        p.client || 'Unknown',
        p.subject || '',
        p.year || 2024,
        p.total_cost || 0,
        p.total_selling_price || 0,
        p.margin || 0,
        p.margin_pct || 0
      );
    }
  });
  
  console.log(`Imported ${projectData.length} projects`);
} catch (e) {
  console.log('Project data import skipped:', e.message);
}

console.log('Database initialized successfully!');
console.log(`- Categories: ${db.prepare('SELECT COUNT(*) as c FROM categories').get().c}`);
console.log(`- Vendors: ${db.prepare('SELECT COUNT(*) as c FROM vendors').get().c}`);
console.log(`- Projects: ${db.prepare('SELECT COUNT(*) as c FROM projects').get().c}`);

db.close();
