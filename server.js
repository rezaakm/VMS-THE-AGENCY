const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3780;
const ROOT = __dirname;

let rawData = [];
let categories = [];
let vendorsMap = new Map();   // vendorName -> { id, company_name, category, total_spent, projects_count, items[] }
let pricesForApi = [];
let projectAgg = new Map();  // key: projectKey -> { project_number, client, subject, year, total_cost, total_price, margin, margin_pct }
let clientAgg = new Map();   // clientName -> { client, projects, revenue, cost, margin, avg_margin }
let catStats = [];

function loadData() {
  const jsonPath = path.join(ROOT, 'price_history.json');
  rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Normalize: vendor null -> "Direct / Uncategorized"
  const rows = rawData.map((r, idx) => ({
    ...r,
    vendorName: r.vendor && String(r.vendor).trim() ? String(r.vendor).trim() : 'Direct / Uncategorized',
    year: parseYear(r.date),
    projectNumber: parseProjectNumber(r.source_file),
    projectKey: [r.client, r.subject, r.source_file].filter(Boolean).join('|'),
  }));

  // Categories (unique)
  const catSet = new Set();
  rows.forEach(r => { if (r.category) catSet.add(r.category); });
  categories = Array.from(catSet).sort().map(name => ({ name }));

  // Vendors
  vendorsMap.clear();
  rows.forEach(r => {
    const name = r.vendorName;
    if (!vendorsMap.has(name)) {
      vendorsMap.set(name, {
        id: encodeURIComponent(name),
        company_name: name,
        category: r.category || null,
        contact_name: null,
        phone: null,
        email: null,
        total_spent: 0,
        projects_count: 0,
        items: [],
      });
    }
    const v = vendorsMap.get(name);
    v.total_spent += Number(r.total_cost) || 0;
    v.items.push({
      item_description: r.description,
      category: r.category,
      quantity: r.qty,
      unit_cost: r.unit_cost,
      total_cost: r.total_cost,
    });
    if (r.category && (!v.category || v.category === 'Direct / Uncategorized')) v.category = r.category;
  });
  vendorsMap.forEach(v => { v.projects_count = v.items.length; });

  // Prices list for /api/prices (frontend shape)
  pricesForApi = rows.map(r => ({
    item_description: r.description,
    category: r.category,
    vendor_name: r.vendorName,
    quantity: r.qty,
    unit_cost: r.unit_cost,
    total_cost: r.total_cost,
  }));

  // Category stats for /api/prices/stats
  const byCat = new Map();
  rows.forEach(r => {
    const c = r.category || 'Uncategorized';
    if (!byCat.has(c)) byCat.set(c, { costs: [], units: [] });
    byCat.get(c).costs.push(Number(r.total_cost) || 0);
    byCat.get(c).units.push(Number(r.unit_cost) || 0);
  });
  catStats = Array.from(byCat.entries()).map(([category, data]) => {
    const unitCosts = data.units.filter(u => u > 0);
    const total = data.costs.reduce((a, b) => a + b, 0);
    const minCost = unitCosts.length ? Math.min(...unitCosts) : 0;
    const maxCost = unitCosts.length ? Math.max(...unitCosts) : 0;
    const avgUnitCost = unitCosts.length ? unitCosts.reduce((a, b) => a + b, 0) / unitCosts.length : 0;
    return { category, items: data.costs.length, total_cost: total, avg_unit_cost: avgUnitCost, min_cost: minCost, max_cost: maxCost };
  }).sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

  // Projects (by client + subject + source_file)
  projectAgg.clear();
  rows.forEach(r => {
    const key = r.projectKey;
    if (!projectAgg.has(key)) {
      projectAgg.set(key, {
        project_number: r.projectNumber,
        client: r.client,
        subject: r.subject,
        year: r.year,
        total_cost: 0,
        total_price: 0,
      });
    }
    const p = projectAgg.get(key);
    p.total_cost += Number(r.total_cost) || 0;
    p.total_price += Number(r.total_sell) || 0;
  });
  projectAgg.forEach(p => {
    p.margin = (p.total_price || 0) - (p.total_cost || 0);
    p.margin_pct = p.total_price ? ((p.margin / p.total_price) * 100) : 0;
  });

  // Clients
  clientAgg.clear();
  projectAgg.forEach(proj => {
    const c = proj.client || 'Unknown';
    if (!clientAgg.has(c)) clientAgg.set(c, { client: c, projects: 0, revenue: 0, cost: 0 });
    const agg = clientAgg.get(c);
    agg.projects += 1;
    agg.revenue += proj.total_price || 0;
    agg.cost += proj.total_cost || 0;
  });
  clientAgg.forEach(agg => {
    agg.margin = agg.revenue - agg.cost;
    agg.avg_margin = agg.revenue ? ((agg.margin / agg.revenue) * 100) : 0;
  });
}

function parseYear(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/[.\-/]/);
  const last = parts[parts.length - 1];
  const y = parseInt(last, 10);
  if (y >= 2000 && y <= 2100) return String(y);
  return null;
}

function parseProjectNumber(sourceFile) {
  if (!sourceFile) return null;
  const m = String(sourceFile).match(/^(\d+)/);
  return m ? m[1] : null;
}

function getDashboard() {
  const vendorList = Array.from(vendorsMap.values());
  const topVendors = vendorList.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 10);
  let totalRevenue = 0;
  projectAgg.forEach(p => { totalRevenue += p.total_price || 0; });
  const categorySpend = catStats.map(c => ({ category: c.category, total_cost: c.total_cost }));
  return {
    vendors: { total: vendorsMap.size },
    price_history: { total: rawData.length },
    projects: { total: projectAgg.size, total_revenue: totalRevenue },
    top_vendors: topVendors,
    category_spend: categorySpend,
  };
}

function getVendors(search = '', category = '') {
  let list = Array.from(vendorsMap.values());
  const s = (search || '').toLowerCase().trim();
  if (s) list = list.filter(v => (v.company_name || '').toLowerCase().includes(s));
  if (category) list = list.filter(v => v.category === category);
  return list;
}

function getVendorById(id) {
  const name = decodeURIComponent(id);
  const v = vendorsMap.get(name);
  if (!v) return null;
  return {
    ...v,
    status: 'Active',
    payment_terms: 'NET30',
    rating: null,
  };
}

function getVendorPrices(id) {
  const v = getVendorById(id);
  return v ? v.items : [];
}

function getProjects(client = '', year = '') {
  let list = Array.from(projectAgg.values());
  const c = (client || '').toLowerCase().trim();
  if (c) list = list.filter(p => (p.client || '').toLowerCase().includes(c));
  if (year) list = list.filter(p => p.year === year);
  return list.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
}

function getClients() {
  return Array.from(clientAgg.values()).sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  // API routes
  if (pathname === '/api/categories') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(categories));
    return;
  }
  if (pathname === '/api/analytics/dashboard') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getDashboard()));
    return;
  }
  if (pathname === '/api/prices') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pricesForApi));
    return;
  }
  if (pathname === '/api/prices/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(catStats));
    return;
  }
  if (pathname === '/api/vendors') {
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getVendors(search, category)));
    return;
  }
  const vendorPricesMatch = pathname.match(/^\/api\/vendors\/(.+)\/prices$/);
  if (vendorPricesMatch) {
    const id = vendorPricesMatch[1];
    const prices = getVendorPrices(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(prices));
    return;
  }
  const vendorMatch = pathname.match(/^\/api\/vendors\/([^/]+)$/);
  if (vendorMatch) {
    const v = getVendorById(vendorMatch[1]);
    if (!v) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(v));
    return;
  }
  if (pathname === '/api/projects') {
    const client = url.searchParams.get('client') || '';
    const year = url.searchParams.get('year') || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getProjects(client, year)));
    return;
  }
  if (pathname === '/api/clients') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getClients()));
    return;
  }

  // Static: serve index (the single-page app)
  if (pathname === '/' || pathname === '/index.html') {
    const file = path.join(ROOT, 'vendor_system_complete.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(500); res.end('Error loading app'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

loadData();
server.listen(PORT, () => {
  console.log(`Vendor Management System running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/`);
});
