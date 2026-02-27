const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const db = new Database('./vendor_system.db');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to generate RFQ number
function generateRfqNumber() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM rfqs WHERE rfq_number LIKE ?').get(`RFQ-${year}-%`).c;
  return `RFQ-${year}-${String(count + 1).padStart(3, '0')}`;
}

// ============ VENDORS API ============

// Get all vendors
app.get('/api/vendors', (req, res) => {
  const { category, status, search } = req.query;
  let query = 'SELECT * FROM vendors WHERE 1=1';
  const params = [];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (company_name LIKE ? OR contact_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY company_name';
  res.json(db.prepare(query).all(...params));
});

// Get single vendor
app.get('/api/vendors/:id', (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  res.json(vendor);
});

// Create vendor
app.post('/api/vendors', (req, res) => {
  const id = uuidv4();
  const { company_name, trade_name, category, subcategory, contact_name, phone, email, whatsapp, 
          address, bank_name, account_number, iban, payment_terms, notes } = req.body;
  
  db.prepare(`
    INSERT INTO vendors (id, company_name, trade_name, category, subcategory, contact_name, phone, email, whatsapp, address, bank_name, account_number, iban, payment_terms, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_name, trade_name, category, subcategory, contact_name, phone, email, whatsapp, address, bank_name, account_number, iban, payment_terms || 'NET30', notes);
  
  res.json({ id, message: 'Vendor created successfully' });
});

// Update vendor
app.put('/api/vendors/:id', (req, res) => {
  const { company_name, trade_name, category, subcategory, contact_name, phone, email, whatsapp, 
          address, bank_name, account_number, iban, payment_terms, status, notes } = req.body;
  
  db.prepare(`
    UPDATE vendors SET 
      company_name = COALESCE(?, company_name),
      trade_name = COALESCE(?, trade_name),
      category = COALESCE(?, category),
      subcategory = COALESCE(?, subcategory),
      contact_name = COALESCE(?, contact_name),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      whatsapp = COALESCE(?, whatsapp),
      address = COALESCE(?, address),
      bank_name = COALESCE(?, bank_name),
      account_number = COALESCE(?, account_number),
      iban = COALESCE(?, iban),
      payment_terms = COALESCE(?, payment_terms),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(company_name, trade_name, category, subcategory, contact_name, phone, email, whatsapp, 
         address, bank_name, account_number, iban, payment_terms, status, notes, req.params.id);
  
  res.json({ message: 'Vendor updated successfully' });
});

// Delete vendor
app.delete('/api/vendors/:id', (req, res) => {
  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  res.json({ message: 'Vendor deleted successfully' });
});

// ============ CATEGORIES API ============

app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

// ============ PROJECTS API ============

app.get('/api/projects', (req, res) => {
  const { client, year, status } = req.query;
  let query = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  
  if (client) {
    query += ' AND client LIKE ?';
    params.push(`%${client}%`);
  }
  if (year) {
    query += ' AND year = ?';
    params.push(year);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY year DESC, project_number DESC LIMIT 100';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const id = uuidv4();
  const { project_number, client, subject, event_date, total_cost, total_price, status } = req.body;
  const year = new Date().getFullYear();
  const margin = (total_price || 0) - (total_cost || 0);
  const margin_pct = total_price > 0 ? (margin / total_price) * 100 : 0;
  
  db.prepare(`
    INSERT INTO projects (id, project_number, client, subject, event_date, total_cost, total_price, margin, margin_pct, year, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, project_number, client, subject, event_date, total_cost || 0, total_price || 0, margin, margin_pct, year, status || 'Active');
  
  res.json({ id, message: 'Project created successfully' });
});

// ============ RFQ API ============

app.get('/api/rfqs', (req, res) => {
  const { status, project_id } = req.query;
  let query = `
    SELECT r.*, p.client, p.subject as project_subject,
           (SELECT COUNT(*) FROM rfq_vendors WHERE rfq_id = r.id) as vendors_count,
           (SELECT COUNT(*) FROM quotes WHERE rfq_id = r.id) as quotes_count
    FROM rfqs r
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }
  if (project_id) {
    query += ' AND r.project_id = ?';
    params.push(project_id);
  }
  
  query += ' ORDER BY r.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/rfqs/:id', (req, res) => {
  const rfq = db.prepare(`
    SELECT r.*, p.client, p.subject as project_subject
    FROM rfqs r
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE r.id = ?
  `).get(req.params.id);
  
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  
  // Get invited vendors
  rfq.vendors = db.prepare(`
    SELECT v.*, rv.sent_at, rv.status as invite_status
    FROM rfq_vendors rv
    JOIN vendors v ON rv.vendor_id = v.id
    WHERE rv.rfq_id = ?
  `).all(req.params.id);
  
  // Get quotes
  rfq.quotes = db.prepare(`
    SELECT q.*, v.company_name as vendor_name
    FROM quotes q
    JOIN vendors v ON q.vendor_id = v.id
    WHERE q.rfq_id = ?
    ORDER BY q.amount ASC
  `).all(req.params.id);
  
  res.json(rfq);
});

app.post('/api/rfqs', (req, res) => {
  const id = uuidv4();
  const rfq_number = generateRfqNumber();
  const { project_id, title, category, specifications, quantity, deadline, delivery_date, estimated_cost, vendor_ids } = req.body;
  
  db.prepare(`
    INSERT INTO rfqs (id, rfq_number, project_id, title, category, specifications, quantity, deadline, delivery_date, estimated_cost, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')
  `).run(id, rfq_number, project_id, title, category, JSON.stringify(specifications), quantity || 1, deadline, delivery_date, estimated_cost);
  
  // Add vendors
  if (vendor_ids && vendor_ids.length > 0) {
    const insertVendor = db.prepare('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)');
    vendor_ids.forEach(vid => insertVendor.run(uuidv4(), id, vid));
  }
  
  res.json({ id, rfq_number, message: 'RFQ created successfully' });
});

app.put('/api/rfqs/:id', (req, res) => {
  const { title, category, specifications, quantity, deadline, delivery_date, estimated_cost, status } = req.body;
  
  db.prepare(`
    UPDATE rfqs SET
      title = COALESCE(?, title),
      category = COALESCE(?, category),
      specifications = COALESCE(?, specifications),
      quantity = COALESCE(?, quantity),
      deadline = COALESCE(?, deadline),
      delivery_date = COALESCE(?, delivery_date),
      estimated_cost = COALESCE(?, estimated_cost),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, category, specifications ? JSON.stringify(specifications) : null, quantity, deadline, delivery_date, estimated_cost, status, req.params.id);
  
  res.json({ message: 'RFQ updated successfully' });
});

// Send RFQ to vendors
app.post('/api/rfqs/:id/send', (req, res) => {
  const rfq = db.prepare('SELECT * FROM rfqs WHERE id = ?').get(req.params.id);
  if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
  
  // Update RFQ status
  db.prepare("UPDATE rfqs SET status = 'Sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  
  // Update vendor invites
  db.prepare("UPDATE rfq_vendors SET sent_at = CURRENT_TIMESTAMP, status = 'Sent' WHERE rfq_id = ?").run(req.params.id);
  
  // Get vendor details for response
  const vendors = db.prepare(`
    SELECT v.company_name, v.email, v.whatsapp, v.phone
    FROM rfq_vendors rv
    JOIN vendors v ON rv.vendor_id = v.id
    WHERE rv.rfq_id = ?
  `).all(req.params.id);
  
  res.json({ 
    message: 'RFQ sent successfully',
    rfq_number: rfq.rfq_number,
    vendors_notified: vendors.length,
    vendors
  });
});

// Add vendor to RFQ
app.post('/api/rfqs/:id/vendors', (req, res) => {
  const { vendor_id } = req.body;
  db.prepare('INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES (?, ?, ?)').run(uuidv4(), req.params.id, vendor_id);
  res.json({ message: 'Vendor added to RFQ' });
});

// ============ QUOTES API ============

app.post('/api/quotes', (req, res) => {
  const id = uuidv4();
  const { rfq_id, vendor_id, amount, breakdown, validity_days, notes } = req.body;
  
  db.prepare(`
    INSERT INTO quotes (id, rfq_id, vendor_id, amount, breakdown, validity_days, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, rfq_id, vendor_id, amount, JSON.stringify(breakdown), validity_days || 30, notes);
  
  // Update rfq_vendors status
  db.prepare("UPDATE rfq_vendors SET status = 'Quoted' WHERE rfq_id = ? AND vendor_id = ?").run(rfq_id, vendor_id);
  
  res.json({ id, message: 'Quote submitted successfully' });
});

app.put('/api/quotes/:id/accept', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  
  // Accept this quote
  db.prepare("UPDATE quotes SET status = 'Accepted' WHERE id = ?").run(req.params.id);
  
  // Reject other quotes for same RFQ
  db.prepare("UPDATE quotes SET status = 'Rejected' WHERE rfq_id = ? AND id != ?").run(quote.rfq_id, req.params.id);
  
  // Update RFQ status
  db.prepare("UPDATE rfqs SET status = 'Awarded', winning_quote_id = ? WHERE id = ?").run(req.params.id, quote.rfq_id);
  
  // Update vendor stats
  db.prepare(`
    UPDATE vendors SET 
      projects_count = projects_count + 1,
      total_spent = total_spent + ?
    WHERE id = ?
  `).run(quote.amount, quote.vendor_id);
  
  res.json({ message: 'Quote accepted successfully' });
});

// ============ ANALYTICS API ============

app.get('/api/analytics/dashboard', (req, res) => {
  const stats = {
    vendors: {
      total: db.prepare('SELECT COUNT(*) as c FROM vendors').get().c,
      active: db.prepare("SELECT COUNT(*) as c FROM vendors WHERE status = 'Active'").get().c,
      by_category: db.prepare('SELECT category, COUNT(*) as count FROM vendors GROUP BY category ORDER BY count DESC').all()
    },
    projects: {
      total: db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
      total_revenue: db.prepare('SELECT SUM(total_price) as sum FROM projects').get().sum || 0,
      total_cost: db.prepare('SELECT SUM(total_cost) as sum FROM projects').get().sum || 0,
      by_year: db.prepare('SELECT year, COUNT(*) as count, SUM(total_price) as revenue, SUM(margin) as margin FROM projects GROUP BY year ORDER BY year DESC').all()
    },
    price_history: {
      total: db.prepare('SELECT COUNT(*) as c FROM price_history').get().c,
      total_cost: db.prepare('SELECT SUM(total_cost) as sum FROM price_history').get().sum || 0
    },
    rfqs: {
      total: db.prepare('SELECT COUNT(*) as c FROM rfqs').get().c,
      draft: db.prepare("SELECT COUNT(*) as c FROM rfqs WHERE status = 'Draft'").get().c,
      sent: db.prepare("SELECT COUNT(*) as c FROM rfqs WHERE status = 'Sent'").get().c,
      awarded: db.prepare("SELECT COUNT(*) as c FROM rfqs WHERE status = 'Awarded'").get().c
    },
    category_spend: db.prepare(`
      SELECT category, COUNT(*) as items, SUM(total_cost) as total_cost
      FROM price_history
      GROUP BY category
      ORDER BY total_cost DESC
    `).all(),
    top_clients: db.prepare(`
      SELECT client, COUNT(*) as projects, SUM(total_price) as revenue, AVG(margin_pct) as avg_margin
      FROM projects
      GROUP BY client
      ORDER BY revenue DESC
      LIMIT 10
    `).all(),
    top_vendors: db.prepare(`
      SELECT company_name, category, projects_count, total_spent, rating
      FROM vendors
      WHERE total_spent > 0
      ORDER BY total_spent DESC
      LIMIT 15
    `).all()
  };
  
  res.json(stats);
});

// Cost estimation endpoint
app.post('/api/estimate', (req, res) => {
  const { category, description, quantity } = req.body;
  
  // Get historical pricing for this category
  const history = db.prepare(`
    SELECT AVG(unit_cost) as avg_cost, MIN(unit_cost) as min_cost, MAX(unit_cost) as max_cost, COUNT(*) as samples
    FROM price_history
    WHERE category = ?
  `).get(category);
  
  if (history && history.samples > 0) {
    const estimated = history.avg_cost * (quantity || 1);
    res.json({
      estimated_cost: estimated,
      confidence: history.samples > 10 ? 'High' : history.samples > 5 ? 'Medium' : 'Low',
      range: {
        low: history.min_cost * (quantity || 1),
        high: history.max_cost * (quantity || 1)
      },
      based_on: `${history.samples} historical records`
    });
  } else {
    res.json({
      estimated_cost: null,
      confidence: 'None',
      message: 'No historical data available for this category'
    });
  }
});

// ============ PRICE HISTORY API ============

// Get all price history
app.get('/api/prices', (req, res) => {
  const { category, vendor, search, limit } = req.query;
  let query = `
    SELECT ph.*, v.company_name as vendor_name
    FROM price_history ph
    LEFT JOIN vendors v ON ph.vendor_id = v.id
    WHERE 1=1
  `;
  const params = [];
  
  if (category) {
    query += ' AND ph.category = ?';
    params.push(category);
  }
  if (vendor) {
    query += ' AND v.company_name = ?';
    params.push(vendor);
  }
  if (search) {
    query += ' AND ph.item_description LIKE ?';
    params.push(`%${search}%`);
  }
  
  query += ' ORDER BY ph.total_cost DESC';
  query += ` LIMIT ${parseInt(limit) || 1000}`;
  
  res.json(db.prepare(query).all(...params));
});

// Get price statistics by category
app.get('/api/prices/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT 
      category,
      COUNT(*) as items,
      SUM(total_cost) as total_cost,
      AVG(unit_cost) as avg_unit_cost,
      MIN(unit_cost) as min_cost,
      MAX(unit_cost) as max_cost,
      AVG(CASE WHEN unit_cost > 0 THEN ((total_cost - unit_cost * quantity) / total_cost * 100) ELSE 0 END) as margin_pct
    FROM price_history
    WHERE total_cost > 0
    GROUP BY category
    ORDER BY total_cost DESC
  `).all();
  
  res.json(stats);
});

// Get vendor's price history
app.get('/api/vendors/:id/prices', (req, res) => {
  const prices = db.prepare(`
    SELECT * FROM price_history
    WHERE vendor_id = ?
    ORDER BY total_cost DESC
    LIMIT 100
  `).all(req.params.id);
  
  res.json(prices);
});

// ============ CLIENTS API ============

app.get('/api/clients', (req, res) => {
  const clients = db.prepare(`
    SELECT 
      client,
      COUNT(*) as projects,
      SUM(total_price) as revenue,
      SUM(total_cost) as cost,
      SUM(margin) as margin,
      AVG(margin_pct) as avg_margin
    FROM projects
    WHERE client IS NOT NULL AND client != ''
    GROUP BY client
    ORDER BY revenue DESC
  `).all();
  
  res.json(clients);
});

// Suggest vendors for category
app.get('/api/suggest-vendors', (req, res) => {
  const { category, limit } = req.query;
  
  const vendors = db.prepare(`
    SELECT *, 
      (rating * 20 + on_time_rate * 0.5 + CASE WHEN projects_count > 10 THEN 30 ELSE projects_count * 3 END) as score
    FROM vendors
    WHERE category = ? AND status = 'Active'
    ORDER BY score DESC
    LIMIT ?
  `).all(category, parseInt(limit) || 5);
  
  res.json(vendors);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Vendor Management System running on http://localhost:${PORT}`);
});
