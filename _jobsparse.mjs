import * as XLSX from "xlsx";
import fs from "fs";
const p = "C:/Users/reza/AppData/Roaming/Claude/local-agent-mode-sessions/76f322c4-6593-4144-afd7-fed052d4214c/81536d08-55c9-4b02-987d-c0fc7f788fc5/local_7763de44-e561-44f1-9364-5b225ca11adc/uploads/2026-THE AGENCY  ACCOUNTS-Dinesh.xlsx";
const wb = XLSX.read(fs.readFileSync(p), { type: "buffer" });
const num = (v) => (v == null || v === "" || typeof v === "object" ? 0 : Number(v) || 0);
const jobs = [];
for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false });
  let hi = -1, c = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map((x) => String(x ?? "").trim().toLowerCase());
    if (r.includes("company") && r.includes("job description")) {
      hi = i;
      c.company = r.indexOf("company"); c.desc = r.indexOf("job description");
      c.status = r.indexOf("status"); c.inv = r.indexOf("inv.#");
      c.sales = r.indexOf("sales"); c.vat = r.indexOf("vat");
      c.total = r.indexOf("total amount"); c.profit = r.indexOf("total profit");
      break;
    }
  }
  if (hi < 0) continue;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const company = String(r[c.company] ?? "").trim();
    const first = String(r[0] ?? "").trim().toLowerCase();
    if (!company || ["total cost","paid","balance","account summary","total sales"].includes(first) || ["total cost","paid","balance"].includes(company.toLowerCase())) continue;
    const sales = num(r[c.sales]);
    if (sales <= 0) continue;
    jobs.push({
      sheet, company, desc: String(r[c.desc] ?? "").trim(),
      status: String(r[c.status] ?? "").trim(), inv: String(r[c.inv] ?? "").trim(),
      sales, vat: num(r[c.vat]), total: num(r[c.total]), profit: num(r[c.profit]),
    });
  }
}
console.log("SHEETS:", wb.SheetNames.join(","));
console.log("JOBS:", jobs.length);
console.log("TOTAL SALES:", Math.round(jobs.reduce((s,j)=>s+j.sales,0)));
console.log("STATUSES:", [...new Set(jobs.map(j=>j.status))].join(" | "));
console.log("SAMPLE:", JSON.stringify(jobs.slice(0,3)));
fs.writeFileSync("C:/Users/reza/agency/VMS-THE-AGENCY/_jobs.json", JSON.stringify(jobs));
