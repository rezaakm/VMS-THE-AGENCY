import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { generateQuotePDF } from "@/lib/pdf-quote";
import { AGENCY_LOGO_BLACK } from "@/lib/agency-logo";
import {
  computeLineConfidence,
  computeSheetConfidence,
  CONFIDENCE_COLORS,
  CONFIDENCE_DOT_COLORS,
} from "@/lib/confidence";

type Match = {
  item_label: string;
  typical_cost: number | null;
  typical_sell: number | null;
  usual_vendor: string | null;
  times_used: number;
  match_type: string;
  score: number;
};

type Line = {
  id: number;
  description: string;
  qty: number;
  cost: number;
  markup: number;
  vendor: string;
  source: string;
  matchType?: string;
  matchScore?: number;
};

const TIERS = [25, 30, 35, 40];
const VAT = 0.05;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) =>
  (n || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

let nextId = 1;
const blank = (): Line => ({
  id: nextId++, description: "", qty: 1, cost: 0, markup: 30, vendor: "", source: "",
});

export default function QuoteWizard() {
  const [client, setClient] = useState("");
  const [scope, setScope] = useState("");
  const [refNo, setRefNo] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [suggest, setSuggest] = useState<Record<number, Match[]>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const timers = useRef<Record<number, any>>({});

  const update = (id: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const lookup = async (id: number, q: string) => {
    if (!q.trim()) return;
    setBusy(id);
    const { data, error } = await supabase.rpc("match_pricing", { q });
    setBusy(null);
    setSuggest((s) => ({ ...s, [id]: error ? [] : ((data as Match[]) ?? []) }));
  };

  // live recommend while typing (debounced)
  const onDesc = (id: number, val: string) => {
    update(id, { description: val });
    clearTimeout(timers.current[id]);
    if (val.trim().length < 3) { setSuggest((s) => ({ ...s, [id]: [] })); return; }
    timers.current[id] = setTimeout(() => lookup(id, val), 300);
  };

  const pick = (id: number, m: Match) => {
    update(id, {
      description: m.item_label,
      cost: r3(m.typical_cost ?? m.typical_sell ?? 0),
      vendor: m.usual_vendor ?? "",
      source: `${m.match_type} · used ${m.times_used}×`,
      matchType: m.match_type,
      matchScore: m.score,
    });
    setSuggest((s) => ({ ...s, [id]: [] }));
  };

  const applyMarkupAll = (pct: number) => setLines((ls) => ls.map((l) => ({ ...l, markup: pct })));
  const sell = (l: Line) => r3(l.cost * (1 + l.markup / 100));
  const lineTotal = (l: Line) => r3(sell(l) * l.qty);
  const totalCost = r3(lines.reduce((s, l) => s + l.cost * l.qty, 0));
  const subTotal = r3(lines.reduce((s, l) => s + lineTotal(l), 0));
  const vatAmt = r3(subTotal * VAT);
  const grand = r3(subTotal + vatAmt);
  const profit = r3(subTotal - totalCost);

  const generateDoc = (type: "quote" | "invoice" | "cost") => {
    const logo = AGENCY_LOGO_BLACK;
    const dateStr = docDate.split("-").reverse().join("/");
    const accent = "#1c9ad6";
    const css = `
      *{box-sizing:border-box;}
      @page{size:A4;margin:14mm;}
      html,body{margin:0;padding:0;}
      body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:12px;background:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .page{width:100%;max-width:182mm;margin:0 auto;background:#fff;padding:0;}
      .top{display:flex;justify-content:space-between;align-items:flex-start;
        gap:16px;padding-bottom:10px;margin-bottom:14px;border-bottom:2px solid ${accent};}
      img.logo{height:64px;width:auto;display:block;}
      .title-wrap{text-align:right;}
      h1{font-size:24px;line-height:1.1;margin:0;color:#111;font-weight:700;letter-spacing:.5px;}
      table{width:100%;border-collapse:collapse;margin-top:12px;table-layout:fixed;}
      th{background:${accent};color:#fff;padding:7px 6px;font-size:10.5px;text-align:left;
        border:1px solid ${accent};word-wrap:break-word;overflow-wrap:break-word;}
      td{padding:6px;border:1px solid #cfd8dc;vertical-align:top;font-size:10.5px;
        word-wrap:break-word;overflow-wrap:break-word;}
      .meta{margin-top:0;}
      .meta td{border:1px solid #cfd8dc;}
      .meta .k{background:${accent};color:#fff;font-weight:bold;width:120px;white-space:nowrap;}
      .items td:first-child,.items th:first-child{width:34px;text-align:center;}
      .r{text-align:right;} .c{text-align:center;}
      tr,td,th,table{page-break-inside:avoid;}
      .tot{background:${accent};color:#fff;font-weight:bold;}
      .terms{margin-top:16px;font-size:10.5px;line-height:1.5;}
      .terms ul{margin:6px 0 6px 18px;padding:0;}
      .terms li{margin-bottom:3px;}
      .foot{margin-top:26px;border-top:2px solid ${accent};padding-top:8px;
        color:${accent};font-size:9.5px;line-height:1.6;text-align:center;width:100%;}
      .printbtn{margin-top:18px;padding:8px 16px;border:0;border-radius:4px;
        background:${accent};color:#fff;font-size:12px;cursor:pointer;}
      @media print{.printbtn{display:none;}body{padding:0;}}
    `;
    const head = (title: string, metaRows: string) => `
      <div class="top">
        <img class="logo" src="${logo}" alt="The Agency"/>
        <div class="title-wrap"><h1>${title}</h1></div>
      </div>
      <table class="meta">${metaRows}</table>`;
    const foot = `<div class="foot">Web: theagencyoman.com &nbsp;|&nbsp; Email: info@theagencyoman.com &nbsp;|&nbsp; Phone: +968 9317 1717<br/>
      Address: Azaiba, Muscat, P.O. Box 544, Postal Code 114, Kalbu &nbsp;|&nbsp; Modern Lifestyle L.L.C., C.R. No. 1156928</div>`;

    let body = "";
    if (type === "quote") {
      const rows = lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="c">${l.qty}</td><td class="r">${fmt(sell(l))}</td><td class="r">${fmt(lineTotal(l))} OMR</td></tr>`).join("");
      body = head("Quotation", `
        <tr><td class="k">To</td><td>${client}</td></tr>
        <tr><td class="k">Date</td><td>${dateStr}</td></tr>
        <tr><td class="k">S. N</td><td>${refNo}</td></tr>
        <tr><td class="k">Subject</td><td>Quotation</td></tr>
        <tr><td class="k">Scope of Work</td><td>${scope}</td></tr>`) + `
        <table class="items">
        <colgroup><col style="width:34px"/><col/><col style="width:48px"/><col style="width:90px"/><col style="width:110px"/></colgroup>
        <tr><th>No.</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total Amount</th></tr>${rows}
        <tr><td colspan="4" class="r tot">Sub Total</td><td class="r">${fmt(subTotal)} OMR</td></tr>
        <tr><td colspan="4" class="r tot">VAT 5%</td><td class="r">${fmt(vatAmt)} OMR</td></tr>
        <tr><td colspan="4" class="r tot">Total Amount</td><td class="r tot">${fmt(grand)} OMR</td></tr></table>
        <div class="terms"><b>Payment Terms:</b> 50% advance with LPO as confirmation. Remaining 50% payable on day of delivery.<br/><br/>
        <b>Terms &amp; Conditions:</b><ul>
        <li>Pricing is indicative and may be revised based on final design, dimensions, and materials.</li>
        <li>Delivery timeline: 5–7 working days. Delivery within Muscat included; other locations on request.</li>
        <li>Cancellation/rescheduling: notice at least 7 days before production. Cancellation after production starts incurs 100%.</li>
        <li>The Agency is not responsible for damage caused by weather, force majeure, or mishandling by others.</li></ul>
        To approve, please sign &amp; return with a PO. &nbsp; Received by: ______ &nbsp; Date: ______ &nbsp; Signature: ______<br/><br/>
        All cheques payable to <b>Modern Lifestyle</b>. IBAN: OM110270323021625490018 &nbsp; SWIFT: BMUSOMRXXXX<br/>
        Quotation Validity: 7 Working Days<br/><br/><b>Modern Lifestyle L.L.C.</b> — Authorised Signatory</div>`;
    } else if (type === "invoice") {
      const rows = lines.map((l, i) => { const tx = lineTotal(l); const v = r3(tx * VAT);
        return `<tr><td class="c">${String(i + 1).padStart(2, "0")}</td><td>${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="c">${l.qty} Nos</td><td class="r">${fmt(sell(l))}</td><td class="r">${fmt(tx)}</td><td class="c">5%</td>
        <td class="r">${fmt(v)}</td><td class="r">${fmt(r3(tx + v))}</td></tr>`; }).join("");
      body = head("TAX INVOICE", `
        <tr><td class="k">To</td><td>${client}</td><td class="k">Invoice No</td><td>${refNo}</td></tr>
        <tr><td class="k">Invoice Date</td><td>${dateStr}</td><td class="k">Your LPO No</td><td></td></tr>
        <tr><td class="k">Place of Supply</td><td>Sultanate of Oman</td><td class="k">VATIN</td><td>OM1100057497</td></tr>`) + `
        <table class="items">
        <colgroup><col style="width:30px"/><col/><col style="width:54px"/><col style="width:64px"/><col style="width:70px"/><col style="width:42px"/><col style="width:62px"/><col style="width:70px"/></colgroup>
        <tr><th>SL</th><th>Description</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>VAT%</th><th>VAT</th><th>Total</th></tr>${rows}
        <tr><td colspan="4" class="r tot">Totals</td><td class="r tot">${fmt(subTotal)}</td><td></td><td class="r tot">${fmt(vatAmt)}</td><td class="r tot">${fmt(grand)}</td></tr></table>
        <div class="terms"><b>Bank:</b> Modern Lifestyle LLC &nbsp; A/C 0323021625490018 &nbsp; Bank Muscat, Bousher &nbsp; SWIFT BMUSOMRXXXX<br/>
        Invoice Total (OMR): <b>${fmt(grand)}</b></div>`;
    } else {
      const rows = lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="c">${l.qty}</td><td class="r">${fmt(l.cost)}</td><td class="r">${fmt(r3(l.cost * l.qty))}</td>
        <td class="r">${fmt(sell(l))}</td><td class="r">${fmt(lineTotal(l))}</td><td>${l.vendor}</td></tr>`).join("");
      body = head("Quotation Sheet", `
        <tr><td class="k">Company</td><td>${client}</td></tr>
        <tr><td class="k">Date</td><td>${dateStr}</td></tr>
        <tr><td class="k">Subject</td><td>${scope}</td></tr>`) + `
        <table class="items">
        <colgroup><col style="width:30px"/><col/><col style="width:42px"/><col style="width:62px"/><col style="width:66px"/><col style="width:62px"/><col style="width:66px"/><col style="width:90px"/></colgroup>
        <tr><th>No.</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total Cost</th><th>Unit Sell</th><th>Total Sell</th><th>Vendor</th></tr>${rows}
        <tr><td colspan="4" class="r tot">Sub Total</td><td class="r">${fmt(totalCost)}</td><td></td><td class="r">${fmt(subTotal)}</td><td></td></tr>
        <tr><td colspan="6" class="r tot">VAT 5%</td><td class="r">${fmt(vatAmt)}</td><td></td></tr>
        <tr><td colspan="6" class="r tot">TOTAL</td><td class="r tot">${fmt(grand)}</td><td></td></tr></table>`;
    }

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${refNo || type}</title><style>${css}</style></head>
      <body><div class="page">${body}${foot}<button class="printbtn" onclick="window.print()">Print / Save PDF</button></div></body></html>`);
    w.document.close();
  };

  const importCostSheet = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      const findLabel = (label: string) => {
        for (const r of rows) {
          const idx = r.findIndex((c) => String(c ?? "").trim().toLowerCase() === label);
          if (idx >= 0 && r[idx + 1] != null && String(r[idx + 1]).trim()) return String(r[idx + 1]).trim();
        }
        return "";
      };
      const company = findLabel("company") || findLabel("client");
      const subject = findLabel("subject");
      const vendorHdr = findLabel("vendor");
      const hi = rows.findIndex((r) => r.some((c) => String(c ?? "").trim().toLowerCase() === "description"));
      if (hi < 0) { alert("Couldn't find a Description column in that file."); return; }
      const hdr = rows[hi].map((c) => String(c ?? "").trim().toLowerCase());
      const col = (name: string) => hdr.findIndex((h) => h.includes(name));
      const cDesc = col("description"), cQty = col("qty"), cCost = col("unit cost"), cSell = col("unit selling");
      const out: Line[] = [];
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i];
        const desc = String(r[cDesc] ?? "").trim();
        const low = desc.toLowerCase();
        if (!desc || low.startsWith("sub total") || low === "total" || low.startsWith("vat")) continue;
        const cost = Number(r[cCost]) || 0;
        const sellv = cSell >= 0 ? Number(r[cSell]) || 0 : 0;
        const qty = Number(r[cQty]) || 1;
        const base = cost > 0 ? cost : sellv;
        const markup = cost > 0 && sellv > 0 ? Math.round((sellv / cost - 1) * 100) : 0;
        out.push({ id: nextId++, description: desc, qty, cost: r3(base), markup, vendor: vendorHdr, source: "imported" });
      }
      if (!out.length) { alert("No line items found in that cost sheet."); return; }
      if (company) setClient(company);
      if (subject) setScope(subject);
      setLines(out);
    } catch (err: any) {
      alert("Could not read that file: " + (err?.message || err));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-gray-100">
      <h1 className="text-2xl font-bold mb-1">Quote Wizard</h1>
      <p className="text-sm text-gray-400 mb-3">Type an item — it recommends from your history. Add margin. Generate quote, invoice or cost sheet.</p>

      <div className="mb-4 border border-dashed border-gray-600 rounded p-3 text-sm flex items-center gap-3">
        <span className="text-gray-300 font-medium">⚡ Optional — drop a filled cost sheet to auto-build the quote:</span>
        <input type="file" accept=".xlsx,.xls" className="text-gray-400"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importCostSheet(f); }} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Client (To)" value={client} onChange={(e) => setClient(e.target.value)} />
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Scope / Subject" value={scope} onChange={(e) => setScope(e.target.value)} />
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Ref / Invoice No (e.g. 4240 or ML/26/060)" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        <input type="date" className="bg-gray-800 rounded px-3 py-2" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
      </div>

      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-400">Apply margin to all:</span>
        {TIERS.map((t) => (<button key={t} onClick={() => applyMarkupAll(t)} className="px-3 py-1 rounded bg-gray-700 hover:bg-blue-600">{t}%</button>))}
      </div>

      <div className="space-y-3">
        {lines.map((l) => (
          <div key={l.id} className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="flex gap-2">
              <textarea className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm" rows={2}
                placeholder="Start typing (e.g. rebranding totems, flag fabric, car platform)…"
                value={l.description} onChange={(e) => onDesc(l.id, e.target.value)} />
              <button onClick={() => lookup(l.id, l.description)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm whitespace-nowrap">
                {busy === l.id ? "…" : "Find cost"}</button>
            </div>
            {suggest[l.id]?.length > 0 && (
              <div className="mt-2 bg-gray-800 rounded divide-y divide-gray-700 max-h-56 overflow-y-auto">
                {suggest[l.id].map((m, i) => (
                  <button key={i} onClick={() => pick(l.id, m)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700">
                    <span className="text-gray-200">{m.item_label.slice(0, 90)}</span>
                    <span className="text-gray-400"> — cost {fmt(m.typical_cost ?? m.typical_sell ?? 0)} · {m.usual_vendor ?? "?"} · {m.match_type} {Math.round(m.score * 100)}%</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              <label>Qty <input type="number" className="w-16 bg-gray-800 rounded px-2 py-1" value={l.qty} onChange={(e) => update(l.id, { qty: +e.target.value })} /></label>
              <label>Cost <input type="number" className="w-24 bg-gray-800 rounded px-2 py-1" value={l.cost} onChange={(e) => update(l.id, { cost: +e.target.value })} /></label>
              <span className="text-gray-400">Margin:</span>
              {TIERS.map((t) => (<button key={t} onClick={() => update(l.id, { markup: t })} className={"px-2 py-1 rounded " + (l.markup === t ? "bg-blue-600" : "bg-gray-700")}>{t}%</button>))}
              <input type="number" className="w-16 bg-gray-800 rounded px-2 py-1" value={l.markup} onChange={(e) => update(l.id, { markup: +e.target.value })} />
              <span className="ml-auto text-gray-200">Sell {fmt(sell(l))} × {l.qty} = <b>{fmt(lineTotal(l))}</b></span>
              <button onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} className="text-red-400 hover:text-red-300">✕</button>
            </div>
            {(l.source || l.matchType) && (
              <div className="flex items-center gap-2 mt-1">
                {l.source && <span className="text-xs text-gray-500">{l.source}{l.vendor ? ` · ${l.vendor}` : ""}</span>}
                {(() => {
                  const conf = computeLineConfidence(l.matchType, l.matchScore);
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_COLORS[conf.bucket]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT_COLORS[conf.bucket]}`} />
                      {conf.score}% — {conf.label}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => setLines((ls) => [...ls, blank()])} className="mt-3 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm">+ Add line</button>

      <div className="mt-5 bg-gray-900 border border-gray-800 rounded p-4 text-sm">
        {(() => {
          const confLines = lines.map((l) => ({
            total: lineTotal(l),
            confidence: computeLineConfidence(l.matchType, l.matchScore).score,
          }));
          const sheetConf = computeSheetConfidence(confLines);
          const bucket = sheetConf >= 80 ? "high" : sheetConf >= 50 ? "medium" : sheetConf > 0 ? "low" : "none";
          const hasZero = lines.some((l) => computeLineConfidence(l.matchType, l.matchScore).score === 0 && l.cost === 0);
          return (
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-800">
              <span className="text-gray-400">Sheet Confidence</span>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${CONFIDENCE_COLORS[bucket]}`}>
                  <span className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT_COLORS[bucket]}`} />
                  {sheetConf}%
                </span>
                {hasZero && <span className="text-[10px] text-red-400">Lines need pricing</span>}
              </div>
            </div>
          );
        })()}
        <div className="flex justify-between"><span className="text-gray-400">Total cost</span><span>{fmt(totalCost)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Sub total (sell)</span><span>{fmt(subTotal)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">VAT 5%</span><span>{fmt(vatAmt)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-lg font-bold">{fmt(grand)}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">Profit</span><span className="text-green-400">{fmt(profit)}</span></div>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={() => generateDoc("quote")} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 font-semibold">Generate Quote</button>
        <button
          onClick={() =>
            generateQuotePDF({
              client,
              scope,
              refNo,
              date: docDate,
              lines: lines.map((l) => ({
                description: l.description,
                qty: l.qty,
                unitPrice: sell(l),
                totalPrice: lineTotal(l),
              })),
              subtotal: subTotal,
              vat: vatAmt,
              total: grand,
            })
          }
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold"
        >
          Download PDF
        </button>
        <button onClick={() => generateDoc("invoice")} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 font-semibold">Generate Tax Invoice</button>
        <button onClick={() => generateDoc("cost")} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 font-semibold">Generate Cost Sheet</button>
      </div>
    </div>
  );
}
