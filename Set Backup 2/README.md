# Vendor Management System — The Agency

Vendor & Pricing System powered by your cost sheet archive (`price_history.json`).

## Run locally

1. **Requirement:** [Node.js](https://nodejs.org/) (v16 or newer).

2. **Start the server:**
   ```bash
   cd "c:\Users\MYBOOK\Desktop\Vendor Management System"
   node server.js
   ```

3. **Open in browser:**  
   [http://localhost:3780](http://localhost:3780)

## Features

- **Dashboard** — Vendors count, price records, projects, total revenue, top vendors, spend by category
- **Vendor Lookup** — Search and filter by category
- **Vendor Details** — Profile and full price history per vendor
- **Price List** — Search/filter and export CSV
- **Price Analysis** — Category stats, quick lookup, price estimator
- **Projects** — Filter by client and year
- **Clients** — Revenue, cost, margin

Data is loaded from `price_history.json` at startup. Restart the server after changing the JSON.
