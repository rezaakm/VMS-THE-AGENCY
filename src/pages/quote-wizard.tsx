import { useState, useRef } from "react";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { generateQuotePDF } from "@/lib/pdf-quote";
import { AGENCY_LOGO_BLACK } from "@/lib/agency-logo";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { QUOTE_TEMPLATE_B64 } from "@/lib/quote-template-b64";
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
  const [paymentTerms, setPaymentTerms] = useState(
    "50% advance payment and balance after job completion, along with LPO as confirmation.",
  );
  const [terms, setTerms] = useState(
    [
      "Timeline: 7 working days from the date of confirmation.",
      "Electrical: The client must provide electrical connections suitable for the signage load.",
      "Permissions: Obtaining approval from the municipality or building management is the client's responsibility.",
      "Site Access: Client to ensure safe and clear access to the installation site.",
      "Damage & Liability: Any damage to the signage due to external factors or during transit (excluding our team) will be subject to charges.",
      "Cancellation & Rescheduling: In the event of cancellation or rescheduling by the Client, notice must be provided at least 5 days before the work begins. Failure to do so may result in a cancellation fee or partial charge based on expenses incurred by The Agency.",
    ].join("\n"),
  );
  const [validity, setValidity] = useState("7 Working Days");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [suggest, setSuggest] = useState<Record<number, Match[]>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const timers = useRef<Record<number, any>>({});

  // Auto-fill the next sequential quote number (S.N) so every quote carries a serial.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("quotations").select("quotationNumber");
      const nums = (data ?? [])
        .map((r: any) => String(r.quotationNumber ?? "").trim())
        .filter((s: string) => /^\d{4}$/.test(s))
        .map(Number);
      if (nums.length) setRefNo((cur) => cur || String(Math.max(...nums) + 1));
    })();
  }, []);

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
      body{font-family:Calibri,'Segoe UI',Arial,Helvetica,sans-serif;color:#1f2937;font-size:12px;background:#fff;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .page{width:100%;max-width:182mm;margin:0 auto;background:#fff;padding:0;}
      .num{font-variant-numeric:tabular-nums;}

      /* Header */
      .top{display:flex;justify-content:space-between;align-items:flex-start;
        gap:16px;padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid ${accent};}
      img.logo{height:50px;width:auto;display:block;}
      .title-wrap{text-align:right;}
      h1{font-size:22px;line-height:1.1;margin:0;color:#111;font-weight:700;
        letter-spacing:2px;text-transform:uppercase;}

      /* Quote header — logo top-right only, no title */
      .qhead{display:flex;justify-content:flex-end;align-items:flex-start;
        padding-bottom:12px;margin-bottom:0;}
      .qrule{border:0;border-top:2px solid ${accent};margin:0 0 16px 0;}

      /* Info block */
      .meta{width:100%;border-collapse:collapse;margin:0 0 8px 0;table-layout:fixed;}
      .meta td{padding:6px 10px;vertical-align:top;font-size:11px;
        border-bottom:1px solid #eef2f5;word-wrap:break-word;overflow-wrap:break-word;}
      .meta .k{width:130px;white-space:nowrap;color:#fff;font-weight:700;
        font-size:10.5px;letter-spacing:.2px;background:${accent};}
      .meta .v{color:#1f2937;}

      /* Quote info table — ~60% width, blue labels, bordered white values */
      table.qmeta{width:60%;border-collapse:collapse;margin:0 0 4px 0;table-layout:fixed;}
      table.qmeta td{padding:6px 10px;vertical-align:top;font-size:11px;
        border:1px solid #d7e6ef;word-wrap:break-word;overflow-wrap:break-word;}
      table.qmeta col.qk{width:120px;}
      table.qmeta td.qk{white-space:nowrap;color:#fff;font-weight:700;
        font-size:10.5px;letter-spacing:.2px;background:${accent};border-color:${accent};}
      table.qmeta td.qv{color:#1f2937;background:#fff;}

      /* Quote below-table two columns */
      .qsplit{margin-top:16px;width:100%;overflow:hidden;}
      .qpay{float:left;width:58%;font-size:11px;line-height:1.5;color:#374151;}
      .qpay b{color:#111;}
      .qtot{float:right;width:38%;}
      table.qtotals{width:100%;border-collapse:collapse;table-layout:fixed;}
      table.qtotals td{padding:6px 10px;font-size:11px;border:1px solid #d7e6ef;}
      table.qtotals td.qlbl{background:${accent};color:#fff;text-align:left;font-weight:700;
        border-color:${accent};white-space:nowrap;}
      table.qtotals td.qval{background:#fff;text-align:right;white-space:nowrap;
        font-variant-numeric:tabular-nums;color:#1f2937;}
      table.qtotals tr.qgrand td{font-weight:700;font-size:12px;}
      table.qtotals tr.qgrand td.qval{color:#111;}

      /* Quote terms & approval */
      .qterms{clear:both;margin-top:22px;font-size:10.5px;line-height:1.6;color:#374151;}
      .qterms b{color:#111;}
      .qterms .tline{margin-bottom:4px;}
      .qapprove{margin-top:18px;font-size:10.5px;line-height:1.8;color:#374151;}
      .qapprove .acc{color:${accent};}

      /* Line-items table */
      table.items{width:100%;border-collapse:collapse;margin-top:18px;table-layout:fixed;}
      .items th{background:${accent};color:#fff;padding:8px 8px;font-size:10px;text-align:left;
        font-weight:600;text-transform:uppercase;letter-spacing:.4px;
        word-wrap:break-word;overflow-wrap:break-word;}
      .items td{padding:7px 8px;border-bottom:1px solid #e7ebee;vertical-align:top;
        font-size:10.5px;word-wrap:break-word;overflow-wrap:break-word;}
      .items tbody tr:nth-child(even) td{background:#fafbfc;}
      .r{text-align:right;white-space:nowrap;} .c{text-align:center;white-space:nowrap;} .l{text-align:left;}
      .items td.num,.items th.r{white-space:nowrap;}

      /* Totals */
      .tot-wrap{display:flex;justify-content:flex-end;margin-top:14px;}
      table.totals{width:62%;max-width:300px;border-collapse:collapse;table-layout:fixed;}
      .totals td{padding:6px 10px;font-size:11px;border-bottom:1px solid #eef2f5;}
      .totals td.lbl{background:${accent};color:#fff;text-align:left;font-weight:700;}
      .totals td.val{text-align:right;font-variant-numeric:tabular-nums;color:#1f2937;}
      .totals tr.grand td{border-top:2px solid ${accent};border-bottom:none;
        font-weight:700;font-size:12.5px;color:#111;padding-top:8px;}
      .totals tr.grand td.lbl{color:#fff;text-transform:uppercase;letter-spacing:.5px;}

      tr,td,th,table{page-break-inside:avoid;}

      /* Terms / notes */
      .terms{margin-top:20px;font-size:10px;line-height:1.55;color:#374151;}
      .terms b{color:#111;}
      .terms ul{margin:6px 0 6px 16px;padding:0;}
      .terms li{margin-bottom:3px;}
      .sig{margin-top:14px;padding-top:10px;border-top:1px solid #eef2f5;font-size:10px;color:#374151;}

      /* Footer */
      .foot{margin-top:30px;border-top:1px solid ${accent};padding-top:10px;
        color:#6b7280;font-size:9px;line-height:1.7;text-align:left;width:100%;}
      .foot b{color:#374151;}

      .printbtn{margin-top:22px;padding:8px 16px;border:0;border-radius:4px;
        background:${accent};color:#fff;font-size:12px;cursor:pointer;}
      @media print{.printbtn{display:none;}body{padding:0;}}
    `;
    const head = (title: string, metaRows: string) => `
      <div class="top">
        <img class="logo" src="${logo}" alt="The Agency"/>
        <div class="title-wrap"><h1>${title}</h1></div>
      </div>
      <table class="meta">${metaRows}</table>`;
    // info-block row helper — omits the row entirely when the value is empty
    const row = (k: string, v: string) =>
      v && String(v).trim() ? `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>` : "";
    // quote info-table row helper — blue label cell + bordered white value cell
    const qrow = (k: string, v: string) =>
      v && String(v).trim()
        ? `<tr><td class="qk">${k}</td><td class="qv">${v}</td></tr>`
        : "";
    const foot = `<div class="foot" style="text-align:center;color:${accent};">
      Web: theagencyoman.com &nbsp;|&nbsp; Email: info@theagencyoman.com &nbsp;|&nbsp; Phone: +968 9317 1717 &nbsp;|&nbsp; Direct Line: +968 9617 5866<br/>
      Address: Bausher, Muscat &nbsp;|&nbsp; P.O. Box 544, Postal Code 114, Kalbu &nbsp;|&nbsp; Modern Lifestyle L.L.C.  C.R. No. 1156928</div>`;

    let body = "";
    if (type === "quote") {
      const rows = lines.map((l, i) => `<tr><td class="c num">${i + 1}</td><td class="l">${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="r num">${l.qty}</td><td class="r num">${fmt(sell(l))}</td><td class="r num">${fmt(lineTotal(l))} OMR</td></tr>`).join("");
      const termLines = terms
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => {
          const ci = t.indexOf(":");
          const html =
            ci > 0
              ? `<b>${t.slice(0, ci)}:</b>${t.slice(ci + 1)}`
              : t;
          return `<div class="tline">${html}</div>`;
        })
        .join("");
      body = `
        <div class="qhead"><img class="logo" src="${logo}" alt="The Agency"/></div>
        <hr class="qrule"/>
        <table class="qmeta"><colgroup><col class="qk"/><col/></colgroup>
        ${qrow("To", client)}
        ${qrow("Date", dateStr)}
        ${qrow("S. N", refNo)}
        ${qrow("Subject", "Quotation")}
        ${qrow("Scope of Work", scope)}</table>
        <table class="items">
        <colgroup><col style="width:34px"/><col/><col style="width:48px"/><col style="width:70px"/><col style="width:84px"/></colgroup>
        <thead><tr><th class="c">No.</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Total Cost</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="qsplit">
          <div class="qpay"><b>Payment Terms:</b> ${paymentTerms}</div>
          <div class="qtot"><table class="qtotals">
          <tr><td class="qlbl">Sub Total</td><td class="qval">${fmt(subTotal)} OMR</td></tr>
          <tr><td class="qlbl">Vat 5%</td><td class="qval">${fmt(vatAmt)} OMR</td></tr>
          <tr class="qgrand"><td class="qlbl">Total Amount</td><td class="qval">${fmt(grand)} OMR</td></tr></table></div>
        </div>
        <div class="qterms"><b>Terms &amp; Conditions:</b>${termLines}</div>
        <div class="qapprove">
        To approve the quotation, please sign &amp; return with a PO.<br/>
        Received by: ____________<br/>
        Date: ____________<br/>
        Signature: ____________<br/><br/>
        <span class="acc"><b>Please Note:</b> All Cheques must be made payable to <b>Modern Lifestyle</b></span><br/>
        <span class="acc">Quotation Validity: ${validity}</span>
        </div>`;
    } else if (type === "invoice") {
      const rows = lines.map((l, i) => { const tx = lineTotal(l); const v = r3(tx * VAT);
        return `<tr><td class="c num">${String(i + 1).padStart(2, "0")}</td><td class="l">${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="r num">${l.qty}</td><td class="r num">${fmt(sell(l))}</td><td class="r num">${fmt(tx)}</td>
        <td class="r num">${fmt(v)}</td><td class="r num">${fmt(r3(tx + v))}</td></tr>`; }).join("");
      body = head("Tax Invoice", `
        ${row("To", client)}
        ${row("Invoice No", refNo)}
        ${row("Invoice Date", dateStr)}
        ${row("Place of Supply", "Sultanate of Oman")}
        ${row("VATIN", "OM1100057497")}`) + `
        <table class="items">
        <colgroup><col style="width:30px"/><col/><col style="width:50px"/><col style="width:74px"/><col style="width:80px"/><col style="width:74px"/><col style="width:82px"/></colgroup>
        <thead><tr><th class="c">SL</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">VAT (5%)</th><th class="r">Total</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="tot-wrap"><table class="totals">
        <tr><td class="lbl">Total Taxable</td><td class="val">${fmt(subTotal)}</td></tr>
        <tr><td class="lbl">Total VAT (5%)</td><td class="val">${fmt(vatAmt)}</td></tr>
        <tr class="grand"><td class="lbl">Grand Total (OMR)</td><td class="val">${fmt(grand)}</td></tr></table></div>
        <div class="terms"><b>Bank Details:</b> Modern Lifestyle LLC &nbsp;|&nbsp; A/C 0323021625490018 &nbsp;|&nbsp; Bank Muscat, Bousher<br/>
        IBAN: OM110270323021625490018 &nbsp;|&nbsp; SWIFT: BMUSOMRXXXX</div>`;
    } else {
      const rows = lines.map((l, i) => `<tr><td class="c num">${i + 1}</td><td class="l">${l.description.replace(/\n/g, "<br/>")}</td>
        <td class="r num">${l.qty}</td><td class="r num">${fmt(l.cost)}</td><td class="r num">${fmt(r3(l.cost * l.qty))}</td>
        <td class="r num">${fmt(sell(l))}</td><td class="r num">${fmt(lineTotal(l))}</td><td class="l">${l.vendor}</td></tr>`).join("");
      body = head("Cost Sheet", `
        ${row("Company", client)}
        ${row("Date", dateStr)}
        ${row("Subject", scope)}`) + `
        <table class="items">
        <colgroup><col style="width:28px"/><col/><col style="width:38px"/><col style="width:58px"/><col style="width:62px"/><col style="width:58px"/><col style="width:62px"/><col style="width:78px"/></colgroup>
        <thead><tr><th class="c">No.</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Total Cost</th><th class="r">Unit Sell</th><th class="r">Total Sell</th><th>Vendor</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="tot-wrap"><table class="totals">
        <tr><td class="lbl">Total Cost</td><td class="val">${fmt(totalCost)}</td></tr>
        <tr><td class="lbl">Sub Total (Sell)</td><td class="val">${fmt(subTotal)}</td></tr>
        <tr><td class="lbl">VAT (5%)</td><td class="val">${fmt(vatAmt)}</td></tr>
        <tr class="grand"><td class="lbl">Total (OMR)</td><td class="val">${fmt(grand)}</td></tr></table></div>`;
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

  // Persist this sheet to the database so it appears under Cost Sheets and
  // isn't lost when the page closes. Saves the header + every line item.
  const saveRecord = async () => {
    if (!client.trim() && !scope.trim() && !refNo.trim()) {
      alert("Add a client, scope or ref number before saving.");
      return;
    }
    setSaving(true);
    setSavedMsg("");
    try {
      const sheetConf = computeSheetConfidence(
        lines.map((l) => ({
          total: lineTotal(l),
          confidence: computeLineConfidence(l.matchType, l.matchScore).score,
        })),
      );
      const { data: sheet, error: e1 } = await supabase
        .from("cost_sheets")
        .insert({
          jobNumber: refNo || null,
          client: client || null,
          event: scope || "Cost Sheet",
          date: docDate,
          status: "draft",
          confidence: sheetConf,
        })
        .select()
        .single();
      if (e1) throw e1;

      const items = lines
        .filter((l) => l.description.trim())
        .map((l, i) => ({
          costSheetId: sheet.id,
          itemNumber: i + 1,
          description: l.description,
          vendor: l.vendor || null,
          days: l.qty,
          unitCost: r3(l.cost),
          totalCost: r3(l.cost * l.qty),
          unitSellingPrice: sell(l),
          totalSellingPrice: lineTotal(l),
          match_type: l.matchType || null,
          confidence: computeLineConfidence(l.matchType, l.matchScore).score,
          price_source: l.source || null,
        }));
      if (items.length) {
        const { error: e2 } = await supabase.from("cost_sheet_items").insert(items);
        if (e2) throw e2;
      }

      setSavedMsg(
        `Saved ✓  Cost sheet ${refNo || sheet.id} with ${items.length} item(s). Find it under Cost Sheets.`,
      );
    } catch (err: any) {
      alert("Could not save the cost sheet: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Fill the agency's real .docx template (via docxtemplater) and download it.
  const generateWordDoc = () => {
    try {
      const dateStr = docDate.split("-").reverse().join("/");
      const bin = Uint8Array.from(atob(QUOTE_TEMPLATE_B64), (c) => c.charCodeAt(0));
      const zip = new PizZip(bin);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const data = {
        client,
        date: dateStr,
        sn: refNo,
        scope,
        items: lines.map((l, i) => ({
          no: String(i + 1),
          desc: l.description,
          qty: String(l.qty),
          unit: fmt(sell(l)),
          total: fmt(lineTotal(l)) + " OMR",
        })),
        subtotal: fmt(subTotal) + " OMR",
        vat: fmt(vatAmt) + " OMR",
        grandtotal: fmt(grand) + " OMR",
        paymentTerms,
        terms,
        validity,
      };
      doc.render(data);
      const out = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      saveAs(out, `Quote ${refNo || "Agency"}.docx`);
    } catch (err: any) {
      alert("Could not generate the Word document: " + (err?.message || err));
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

      <details open className="mb-3 bg-gray-900 border border-gray-800 rounded">
        <summary className="cursor-pointer px-3 py-2 text-sm text-gray-300 select-none font-semibold">Terms &amp; Conditions (editable — used on the generated quote)</summary>
        <div className="p-3 pt-0 space-y-2">
          <div>
            <label className="text-xs text-gray-400">Payment Terms</label>
            <input className="w-full bg-gray-800 rounded px-3 py-2 text-sm" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Terms &amp; Conditions (one bullet per line)</label>
            <textarea className="w-full bg-gray-800 rounded px-3 py-2 text-sm" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Quotation Validity</label>
            <input className="w-full bg-gray-800 rounded px-3 py-2 text-sm" value={validity} onChange={(e) => setValidity(e.target.value)} />
          </div>
        </div>
      </details>

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

      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={saveRecord} disabled={saving} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-50">{saving ? "Saving…" : "💾 Save Cost Sheet"}</button>
        <button onClick={() => generateDoc("quote")} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 font-semibold">Generate Quote</button>
        <button onClick={generateWordDoc} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold">Download Word (.docx)</button>
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

      {savedMsg && (
        <div className="mt-3 px-4 py-3 rounded bg-green-900/40 border border-green-700 text-green-300 text-sm">{savedMsg}</div>
      )}
    </div>
  );
}
