import { useState, useRef, useEffect, useCallback } from "react";
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
import { useSmartPricing, type PricingMatch, type SimilarJob } from "@/hooks/use-smart-pricing";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────────────────── */

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
  // Phase 3: price range from history
  minCost?: number;
  maxCost?: number;
  avgMarkup?: number;
  vendorOptions?: { vendor: string; avg_cost: number }[];
  // For softened confidence (timesUsed + vendor context from v2)
  timesUsed?: number;
  usualVendor?: string;
};

/* ─── Constants ─────────────────────────────────────────────────────────── */

const TIERS = [25, 30, 35, 40];
const VAT = 0.05;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) =>
  (n || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

let nextId = 1;
const blank = (): Line => ({
  id: nextId++, description: "", qty: 1, cost: 0, markup: 30, vendor: "", source: "",
});

/* ─── Component ─────────────────────────────────────────────────────────── */

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
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  // Phase 2: expanded similar job (to preview items)
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  // Phase 3: vendor picker per line
  const [vendorPicker, setVendorPicker] = useState<number | null>(null);

  const similarSearchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Smart pricing hook (Phases 1–3)
  const {
    matches,
    loading: pricingLoading,
    searchPricing,
    searchPricingNow,
    clearMatches,
    similarJobs,
    similarLoading,
    findSimilarJobs,
    loadJobItems,
  } = useSmartPricing();

  // DEBUG: log rich data arrivals
  useEffect(() => {
    console.log('[DEBUG] QuoteWizard matches updated:', matches);
  }, [matches]);

  useEffect(() => {
    console.log('[DEBUG] QuoteWizard similarJobs:', similarJobs, 'loading:', similarLoading);
  }, [similarJobs, similarLoading]);

  const { toast } = useToast();

  // Auto-fill the next sequential quote number
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

  // Phase 2: search for similar jobs when client/scope changes
  useEffect(() => {
    clearTimeout(similarSearchTimer.current);
    if (!client.trim() && !scope.trim()) return;
    console.log('[DEBUG] Triggering findSimilarJobs', { client, scope });
    similarSearchTimer.current = setTimeout(() => {
      findSimilarJobs(client, scope);
    }, 500);
  }, [client, scope, findSimilarJobs]);

  /* ─── Line helpers ──────────────────────────────────────────────────── */

  const update = (id: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const onDesc = (id: number, val: string) => {
    update(id, { description: val });
    searchPricing(id, val);
  };

  const pick = (id: number, m: PricingMatch) => {
    console.log('[DEBUG] Picked rich v2 match data for line', id, ':', m);
    update(id, {
      description: m.item_label,
      cost: r3(m.typical_cost ?? m.typical_sell ?? 0),
      vendor: m.usual_vendor ?? "",
      source: `${m.match_type} · used ${m.times_used}× · last ${m.last_used ?? "?"}`,
      matchType: m.match_type,
      matchScore: m.score,
      minCost: m.min_cost,
      maxCost: m.max_cost,
      avgMarkup: m.avg_markup,
      vendorOptions: m.vendor_options ?? [],
      // Rich context for v2-powered features + softened confidence
      timesUsed: m.times_used,
      usualVendor: m.usual_vendor ?? undefined,
    });
    clearMatches(id);
  };

  const applyMarkupAll = (pct: number) => setLines((ls) => ls.map((l) => ({ ...l, markup: pct })));
  const sell = (l: Line) => r3(l.cost * (1 + l.markup / 100));
  const lineTotal = (l: Line) => r3(sell(l) * l.qty);
  const totalCost = r3(lines.reduce((s, l) => s + l.cost * l.qty, 0));
  const subTotal = r3(lines.reduce((s, l) => s + lineTotal(l), 0));
  const vatAmt = r3(subTotal * VAT);
  const grand = r3(subTotal + vatAmt);
  const profit = r3(subTotal - totalCost);

  /* ─── Phase 2: Load a similar job as template ───────────────────────── */

  const handleExpandJob = useCallback(async (job: SimilarJob) => {
    if (expandedJob === job.id) {
      setExpandedJob(null);
      setExpandedItems([]);
      return;
    }
    setExpandedJob(job.id);
    setLoadingItems(true);
    const items = await loadJobItems(job.id);
    setExpandedItems(items);
    setLoadingItems(false);
  }, [expandedJob, loadJobItems]);

  const loadJobAsTemplate = useCallback(async (job: SimilarJob) => {
    const items = expandedItems.length && expandedJob === job.id
      ? expandedItems
      : await loadJobItems(job.id);
    if (!items.length) return;

    const newLines: Line[] = items.map((item) => {
      const cost = r3(item.unitCost ?? 0);
      const sellP = r3(item.unitSellingPrice ?? 0);
      const markup = cost > 0 && sellP > 0 ? Math.round((sellP / cost - 1) * 100) : 30;
      return {
        id: nextId++,
        description: item.description ?? "",
        qty: item.days ?? 1,
        cost,
        markup,
        vendor: item.vendor ?? "",
        source: `from job ${job.job_number ?? job.id.slice(0, 8)}`,
        matchType: "template",
        matchScore: 0.95,
      };
    });
    setLines(newLines);
    if (job.client && !client.trim()) setClient(job.client);
    if (job.event && !scope.trim()) setScope(job.event);
    setExpandedJob(null);
    setExpandedItems([]);
  }, [expandedItems, expandedJob, loadJobItems, client, scope]);

  /* ─── Phase 3: Price outlier detection ──────────────────────────────── */

  const getPriceStatus = (l: Line): { status: "ok" | "low" | "high" | "none"; pct: number } => {
    if (!l.minCost || !l.maxCost || l.cost === 0) return { status: "none", pct: 0 };
    const range = l.maxCost - l.minCost;
    if (range === 0) return { status: "ok", pct: 0 };
    const avg = (l.minCost + l.maxCost) / 2;
    const deviation = ((l.cost - avg) / avg) * 100;
    if (deviation > 20) return { status: "high", pct: Math.round(deviation) };
    if (deviation < -20) return { status: "low", pct: Math.round(Math.abs(deviation)) };
    return { status: "ok", pct: Math.round(Math.abs(deviation)) };
  };

  /* ─── Document generation (unchanged) ───────────────────────────────── */

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
      .top{display:flex;justify-content:space-between;align-items:flex-start;
        gap:16px;padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid ${accent};}
      img.logo{height:50px;width:auto;display:block;}
      .title-wrap{text-align:right;}
      h1{font-size:22px;line-height:1.1;margin:0;color:#111;font-weight:700;
        letter-spacing:2px;text-transform:uppercase;}
      .qhead{display:flex;justify-content:flex-end;align-items:flex-start;
        padding-bottom:12px;margin-bottom:0;}
      .qrule{border:0;border-top:2px solid ${accent};margin:0 0 16px 0;}
      .meta{width:100%;border-collapse:collapse;margin:0 0 8px 0;table-layout:fixed;}
      .meta td{padding:6px 10px;vertical-align:top;font-size:11px;
        border-bottom:1px solid #eef2f5;word-wrap:break-word;overflow-wrap:break-word;}
      .meta .k{width:130px;white-space:nowrap;color:#fff;font-weight:700;
        font-size:10.5px;letter-spacing:.2px;background:${accent};}
      .meta .v{color:#1f2937;}
      table.qmeta{width:60%;border-collapse:collapse;margin:0 0 4px 0;table-layout:fixed;}
      table.qmeta td{padding:6px 10px;vertical-align:top;font-size:11px;
        border:1px solid #d7e6ef;word-wrap:break-word;overflow-wrap:break-word;}
      table.qmeta col.qk{width:120px;}
      table.qmeta td.qk{white-space:nowrap;color:#fff;font-weight:700;
        font-size:10.5px;letter-spacing:.2px;background:${accent};border-color:${accent};}
      table.qmeta td.qv{color:#1f2937;background:#fff;}
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
      .qterms{clear:both;margin-top:22px;font-size:10.5px;line-height:1.6;color:#374151;}
      .qterms b{color:#111;}
      .qterms .tline{margin-bottom:4px;}
      .qapprove{margin-top:18px;font-size:10.5px;line-height:1.8;color:#374151;}
      .qapprove .acc{color:${accent};}
      table.items{width:100%;border-collapse:collapse;margin-top:18px;table-layout:fixed;}
      .items th{background:${accent};color:#fff;padding:8px 8px;font-size:10px;text-align:left;
        font-weight:600;text-transform:uppercase;letter-spacing:.4px;
        word-wrap:break-word;overflow-wrap:break-word;}
      .items td{padding:7px 8px;border-bottom:1px solid #e7ebee;vertical-align:top;
        font-size:10.5px;word-wrap:break-word;overflow-wrap:break-word;}
      .items tbody tr:nth-child(even) td{background:#fafbfc;}
      .r{text-align:right;white-space:nowrap;} .c{text-align:center;white-space:nowrap;} .l{text-align:left;}
      .items td.num,.items th.r{white-space:nowrap;}
      .tot-wrap{display:flex;justify-content:flex-end;margin-top:14px;}
      table.totals{width:62%;max-width:300px;border-collapse:collapse;table-layout:fixed;}
      .totals td{padding:6px 10px;font-size:11px;border-bottom:1px solid #eef2f5;}
      .totals td.lbl{background:${accent};color:#fff;text-align:left;font-weight:700;}
      .totals td.val{text-align:right;font-variant-numeric:tabular-nums;color:#1f2937;}
      .totals tr.grand td{border-top:2px solid ${accent};border-bottom:none;
        font-weight:700;font-size:12.5px;color:#111;padding-top:8px;}
      .totals tr.grand td.lbl{color:#fff;text-transform:uppercase;letter-spacing:.5px;}
      tr,td,th,table{page-break-inside:avoid;}
      .terms{margin-top:20px;font-size:10px;line-height:1.55;color:#374151;}
      .terms b{color:#111;}
      .terms ul{margin:6px 0 6px 16px;padding:0;}
      .terms li{margin-bottom:3px;}
      .sig{margin-top:14px;padding-top:10px;border-top:1px solid #eef2f5;font-size:10px;color:#374151;}
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
    const row = (k: string, v: string) =>
      v && String(v).trim() ? `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>` : "";
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

  /* ─── Import cost sheet from Excel ──────────────────────────────────── */

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

  /* ─── Save to database ──────────────────────────────────────────────── */

  const saveRecord = async () => {
    // Defensive client handling for cost_sheets (NOT NULL constraint)
    // Use form.client (the "Client (To)" field, equivalent to clientName in other forms/quotations)
    const clientName = client.trim() || "Untitled Client";
    if (!client.trim()) {
      toast({
        title: "Client name is required to save as cost sheet.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    setSavedMsg("");
    try {
      const sheetConf = computeSheetConfidence(
        lines.map((l) => ({
          total: lineTotal(l),
          confidence: computeLineConfidence(l.matchType, l.matchScore, {
            timesUsed: l.timesUsed,
            vendor: l.usualVendor || l.vendor,
          }).score,
        })),
      );
      // Payload for cost_sheets — only columns that exist per schema (client NOT NULL, event for scope/title).
      // client_company, event_name, scope, metadata do not exist in cost_sheets (they are in enquiries/quotations or not used).
      // Always provide non-null client using form or fallback.
      const costSheetPayload = {
        jobNumber: refNo.trim() || `CS-${Date.now()}`,  // jobNumber is NOT NULL — never insert null
        client: clientName,  // form.client (Client (To)) || "Untitled Client" fallback; required non-null
        event: scope.trim() || "Cost Sheet",  // scope/title maps to event column
        date: docDate,
        status: "draft",
        confidence: sheetConf,
        // Add enquiry_id if linking from an enquiry in future
      };

      const { data: sheet, error: e1 } = await supabase
        .from("cost_sheets")
        .insert(costSheetPayload)
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
          confidence: computeLineConfidence(l.matchType, l.matchScore, {
            timesUsed: l.timesUsed,
            vendor: l.usualVendor || l.vendor,
          }).score,
          price_source: l.source || null,
        }));
      if (items.length) {
        const { error: e2 } = await supabase.from("cost_sheet_items").insert(items);
        if (e2) throw e2;
      }

      setSavedMsg(
        `Saved — Cost sheet ${refNo || sheet.id} with ${items.length} item(s). Find it under Cost Sheets.`,
      );
    } catch (err: any) {
      toast({
        title: "Could not save the cost sheet",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Word doc generation ───────────────────────────────────────────── */

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

  /* ═══════════════════════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="p-6 max-w-6xl mx-auto text-gray-100">
      <h1 className="text-2xl font-bold mb-1">Quote Wizard</h1>
      {import.meta.env.DEV && (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-green-900/30 text-green-400 rounded border border-green-800/50 align-middle">
          Smart Pricing v2 Active (006)
        </span>
      )}
      <p className="text-sm text-gray-400 mb-3">
        Smart pricing from your history (match_pricing_v2 + find_similar_jobs via 006_smart_pricing). Type an item — costs, vendors & margins auto-fill from past jobs. Similar jobs appear when you enter Client + Scope.
      </p>

      {/* Excel import */}
      <div className="mb-4 border border-dashed border-gray-600 rounded p-3 text-sm flex items-center gap-3">
        <span className="text-gray-300 font-medium">Import — drop a filled cost sheet to auto-build:</span>
        <input type="file" accept=".xlsx,.xls" className="text-gray-400"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importCostSheet(f); }} />
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Client (To) *" required value={client} onChange={(e) => setClient(e.target.value)} />
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Scope / Subject" value={scope} onChange={(e) => setScope(e.target.value)} />
        <input className="bg-gray-800 rounded px-3 py-2" placeholder="Ref / Invoice No (e.g. 4240 or ML/26/060)" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        <input type="date" className="bg-gray-800 rounded px-3 py-2" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
       * PHASE 2: Similar Jobs Panel - FORCED VISIBLE with better states
       * Always renders (with loading/empty) when client or scope present.
       * Powered by find_similar_jobs from migration 006. Debug logs active.
       * ═══════════════════════════════════════════════════════════════════ */}
      {(client.trim() || scope.trim()) && (
        <div className="mb-4 bg-gray-900 border border-blue-800/50 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-900/30 border-b border-blue-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-sm font-semibold">Similar Past Jobs (v2)</span>
              {similarLoading && <span className="text-xs text-blue-400/60 animate-pulse">Searching...</span>}
            </div>
            <span className="text-[10px] text-gray-500">{similarJobs.length} found</span>
          </div>

          {similarLoading ? (
            <div className="px-4 py-3 text-xs text-gray-400 animate-pulse">Loading similar jobs from history...</div>
          ) : similarJobs.length > 0 ? (
            <div className="divide-y divide-gray-800/60 max-h-80 overflow-y-auto">
              {similarJobs.map((job) => (
                <div key={job.id} className="group">
                  <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => handleExpandJob(job)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-200 font-medium truncate">{job.event || "Untitled"}</span>
                        {job.client_score > 0.5 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-900/50 text-blue-300 border border-blue-800/60">Same client</span>
                        )}
                        {job.scope_score > 0.5 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/50 text-purple-300 border border-purple-800/60">Similar scope</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span>{job.client}</span>
                        <span>{job.item_count} items</span>
                        <span>{job.job_date}</span>
                        {job.avg_markup != null && <span>~{Math.round(job.avg_markup)}% margin</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-gray-200">{fmt(job.total_sell)} <span className="text-xs text-gray-500">sell</span></div>
                      <div className="text-xs text-gray-500">{fmt(job.total_cost)} cost</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); loadJobAsTemplate(job); }}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    >
                      Use as template
                    </button>
                    <span className="text-gray-600 text-xs">{expandedJob === job.id ? "▲" : "▼"}</span>
                  </div>
                  {/* Expanded: show line items preview */}
                  {expandedJob === job.id && (
                    <div className="bg-gray-950/50 px-4 py-2 border-t border-gray-800/40">
                      {loadingItems ? (
                        <div className="text-xs text-gray-500 py-2 animate-pulse">Loading items...</div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="grid grid-cols-[1fr_60px_80px_80px_100px] gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider pb-1">
                            <span>Description</span><span className="text-right">Qty</span><span className="text-right">Cost</span><span className="text-right">Sell</span><span>Vendor</span>
                          </div>
                          {expandedItems.map((item, i) => (
                            <div key={item.id || i} className="grid grid-cols-[1fr_60px_80px_80px_100px] gap-2 text-xs text-gray-400 py-0.5">
                              <span className="truncate">{item.description}</span>
                              <span className="text-right">{item.days ?? 1}</span>
                              <span className="text-right">{fmt(item.unitCost ?? 0)}</span>
                              <span className="text-right">{fmt(item.unitSellingPrice ?? 0)}</span>
                              <span className="truncate text-gray-500">{item.vendor || "—"}</span>
                            </div>
                          ))}
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => loadJobAsTemplate(job)}
                              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium"
                            >
                              Load all {expandedItems.length} items into wizard
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-gray-500">
              No similar past jobs found for this client/scope yet.
              <br />Add more cost sheets or try broader terms. (Feature uses find_similar_jobs from 006_smart_pricing.)
              <br />[DEBUG] similarJobs.length was 0 after v2 call - check console for raw data.
            </div>
          )}
        </div>
      )}

      {/* Terms & Conditions */}
      <details className="mb-3 bg-gray-900 border border-gray-800 rounded">
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

      {/* Margin presets */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-400">Apply margin to all:</span>
        {TIERS.map((t) => (<button key={t} onClick={() => applyMarkupAll(t)} className="px-3 py-1 rounded bg-gray-700 hover:bg-blue-600">{t}%</button>))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
       * LINE ITEMS — Phase 1 (smart suggestions) + Phase 3 (price range)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {lines.map((l) => {
          const lineMatches = matches[l.id] ?? [];
          const priceStatus = getPriceStatus(l);

          return (
            <div key={l.id} className="bg-gray-900 border border-gray-800 rounded p-3">
              {/* Description + find */}
              <div className="flex gap-2">
                <textarea className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm" rows={2}
                  placeholder="Start typing (e.g. rebranding totems, flag fabric, car platform)..."
                  value={l.description} onChange={(e) => onDesc(l.id, e.target.value)} />
                <button onClick={() => searchPricingNow(l.id, l.description)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-sm whitespace-nowrap">
                  {pricingLoading === l.id ? "..." : "Find cost"}</button>
              </div>

              {/* Phase 1: Smart suggestions dropdown */}
              {lineMatches.length > 0 && (
                <div className="mt-2 bg-gray-800 rounded divide-y divide-gray-700 max-h-64 overflow-y-auto">
                  {lineMatches.map((m, i) => (
                    <button key={i} onClick={() => pick(l.id, m)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 group/match">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-200 truncate">{m.item_label}</span>
                        <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          m.match_type === "exact"
                            ? "bg-emerald-900/50 text-emerald-300"
                            : m.score >= 0.6
                              ? "bg-amber-900/50 text-amber-300"
                              : "bg-orange-900/50 text-orange-300"
                        }`}>
                          {m.match_type} {Math.round(m.score * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Cost: <span className="text-gray-300">{fmt(m.typical_cost ?? 0)}</span></span>
                        {m.min_cost !== m.max_cost && (
                          <span>Range: {fmt(m.min_cost ?? 0)} – {fmt(m.max_cost ?? 0)}</span>
                        )}
                        <span>Sell: <span className="text-gray-300">{fmt(m.typical_sell ?? 0)}</span></span>
                        {m.avg_markup > 0 && <span>~{Math.round(m.avg_markup)}% markup</span>}
                        <span>{m.usual_vendor || "?"}</span>
                        <span>used {m.times_used}x</span>
                        {m.last_used && <span>last: {m.last_used}</span>}
                      </div>
                      {m.sample_clients?.length > 0 && (
                        <div className="text-[10px] text-gray-600 mt-0.5">Clients: {m.sample_clients.join(", ")}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Phase 1: Smart suggestions dropdown - forced container */}
              <div className="mt-2">
                {lineMatches.length > 0 ? (
                  <div className="bg-gray-800 rounded divide-y divide-gray-700 max-h-64 overflow-y-auto">
                    {lineMatches.map((m, i) => (
                      <button key={i} onClick={() => pick(l.id, m)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 group/match">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-200 truncate">{m.item_label}</span>
                          <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            m.match_type === "exact"
                              ? "bg-emerald-900/50 text-emerald-300"
                              : m.score >= 0.6
                                ? "bg-amber-900/50 text-amber-300"
                                : "bg-orange-900/50 text-orange-300"
                          }`}>
                            {m.match_type} {Math.round(m.score * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>Cost: <span className="text-gray-300">{fmt(m.typical_cost ?? 0)}</span></span>
                          {m.min_cost !== m.max_cost && (
                            <span>Range: {fmt(m.min_cost ?? 0)} – {fmt(m.max_cost ?? 0)}</span>
                          )}
                          <span>Sell: <span className="text-gray-300">{fmt(m.typical_sell ?? 0)}</span></span>
                          {m.avg_markup > 0 && <span>~{Math.round(m.avg_markup)}% markup</span>}
                          <span>{m.usual_vendor || "?"}</span>
                          <span>used {m.times_used}x</span>
                          {m.last_used && <span>last: {m.last_used}</span>}
                        </div>
                        {m.sample_clients?.length > 0 && (
                          <div className="text-[10px] text-gray-600 mt-0.5">Clients: {m.sample_clients.join(", ")}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : l.description.trim().length >= 3 ? (
                  <div className="text-[10px] text-gray-500 bg-gray-800 rounded px-3 py-2">
                    No historical matches found for this description yet.
                    (Uses match_pricing_v2 from 006_smart_pricing. Try broader terms or add more cost sheet history.)
                    <br />[DEBUG] lineMatches was empty for this line - see console for raw matches data.
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600">Type a description (3+ chars) to see v2 smart pricing matches.</div>
                )}
              </div>

              {/* Qty / Cost / Margin row */}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                <label>Qty <input type="number" className="w-16 bg-gray-800 rounded px-2 py-1" value={l.qty} onChange={(e) => update(l.id, { qty: +e.target.value })} /></label>
                <label>Cost <input type="number" className="w-24 bg-gray-800 rounded px-2 py-1" value={l.cost} onChange={(e) => update(l.id, { cost: +e.target.value })} /></label>
                <span className="text-gray-400">Margin:</span>
                {TIERS.map((t) => (<button key={t} onClick={() => update(l.id, { markup: t })} className={"px-2 py-1 rounded " + (l.markup === t ? "bg-blue-600" : "bg-gray-700")}>{t}%</button>))}
                <input type="number" className="w-16 bg-gray-800 rounded px-2 py-1" value={l.markup} onChange={(e) => update(l.id, { markup: +e.target.value })} />
                <span className="ml-auto text-gray-200">Sell {fmt(sell(l))} x {l.qty} = <b>{fmt(lineTotal(l))}</b></span>
                <button onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} className="text-red-400 hover:text-red-300">x</button>
              </div>

              {/* Phase 3: Rich Match Details - FORCED visible when match exists (even partial data from v2) */}
              {(l.matchType || l.source || l.minCost != null || (l.vendorOptions && l.vendorOptions.length > 0)) && (
                <div className="mt-2 p-2 bg-gray-800/60 rounded border border-gray-700 text-xs">
                  <div className="text-blue-400 font-semibold mb-1">Rich Match Details (from match_pricing_v2)</div>

                  {/* Range bar - always when min/max present, even partial (min==max or low values) */}
                  {l.minCost != null && l.maxCost != null && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-500">History Price Range:</span>
                        <span className="text-gray-300">{fmt(l.minCost)} – {fmt(l.maxCost)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-500 w-16 shrink-0">{fmt(l.minCost)}</span>
                        <div className="flex-1 relative h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="absolute inset-0 bg-gray-600 rounded-full" />
                          {l.cost > 0 && (() => {
                            const min = l.minCost!;
                            const max = l.maxCost!;
                            const range = max - min || 1;
                            const pct = Math.max(0, Math.min(100, ((l.cost - min) / range) * 100));
                            return (
                              <div
                                className={`absolute top-0 w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-[1px] border-2 border-gray-900 ${
                                  priceStatus.status === "high" ? "bg-red-400" :
                                  priceStatus.status === "low" ? "bg-amber-400" :
                                  "bg-emerald-400"
                                }`}
                                style={{ left: `${pct}%` }}
                              />
                            );
                          })()}
                        </div>
                        <span className="text-[10px] text-gray-500 w-16 shrink-0 text-right">{fmt(l.maxCost)}</span>
                        {l.minCost === l.maxCost && <span className="text-[9px] text-gray-500">(single point)</span>}
                        {priceStatus.status === "high" && <span className="text-[9px] text-red-400">{priceStatus.pct}% above</span>}
                        {priceStatus.status === "low" && <span className="text-[9px] text-amber-400">{priceStatus.pct}% below</span>}
                      </div>
                    </div>
                  )}

                  {/* Source + confidence + vendor picker - forced when match data present (even partial) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {l.source && <span className="text-gray-500">{l.source}{l.vendor ? ` | ${l.vendor}` : ""}</span>}
                    {(l.matchType || l.source) && (() => {
                      const conf = computeLineConfidence(l.matchType, l.matchScore, {
                        timesUsed: l.timesUsed,
                        vendor: l.usualVendor || l.vendor,
                      });
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium border ${CONFIDENCE_COLORS[conf.bucket]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT_COLORS[conf.bucket]}`} />
                          {conf.score}% — {conf.label}
                        </span>
                      );
                    })()}

                    {/* Vendor picker / info - show if any vendorOptions (even 1) or usualVendor when match exists */}
                    {(l.vendorOptions && l.vendorOptions.length > 0) || l.usualVendor ? (
                      <div className="relative">
                        {l.vendorOptions && l.vendorOptions.length > 1 ? (
                          <button
                            onClick={() => setVendorPicker(vendorPicker === l.id ? null : l.id)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
                          >
                            {l.vendorOptions.length} vendors (click to pick)
                          </button>
                        ) : l.usualVendor ? (
                          <span className="text-[10px] text-gray-400">Vendor: {l.usualVendor}</span>
                        ) : null}
                        {vendorPicker === l.id && l.vendorOptions && l.vendorOptions.length > 1 && (
                          <div className="absolute z-20 top-5 left-0 bg-gray-800 border border-gray-700 rounded shadow-xl min-w-[180px]">
                            {l.vendorOptions
                              .filter((v) => v.vendor)
                              .map((v, vi) => (
                                <button
                                  key={vi}
                                  onClick={() => {
                                    update(l.id, { vendor: v.vendor, cost: r3(v.avg_cost) });
                                    setVendorPicker(null);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 flex justify-between ${
                                    l.vendor === v.vendor ? "text-blue-300" : "text-gray-300"
                                  }`}
                                >
                                  <span>{v.vendor}</span>
                                  <span className="text-gray-500">{fmt(v.avg_cost)}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {l.avgMarkup != null && l.avgMarkup > 0 && (
                      <span className="text-[10px] text-gray-600">Historical markup: ~{Math.round(l.avgMarkup)}%</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setLines((ls) => [...ls, blank()])} className="mt-3 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm">+ Add line</button>

      {/* ═══════════════════════════════════════════════════════════════════
       * Totals panel
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-5 bg-gray-900 border border-gray-800 rounded p-4 text-sm">
        {(() => {
          const confLines = lines.map((l) => ({
            total: lineTotal(l),
            confidence: computeLineConfidence(l.matchType, l.matchScore, {
              timesUsed: l.timesUsed,
              vendor: l.usualVendor || l.vendor,
            }).score,
          }));
          const sheetConf = computeSheetConfidence(confLines);
          const bucket = sheetConf >= 80 ? "high" : sheetConf >= 50 ? "medium" : sheetConf > 0 ? "low" : "none";
          const hasZero = lines.some((l) => computeLineConfidence(l.matchType, l.matchScore, {
            timesUsed: l.timesUsed,
            vendor: l.usualVendor || l.vendor,
          }).score === 0 && l.cost === 0);
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

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mt-4">
        <button onClick={saveRecord} disabled={saving || !client.trim()} title={!client.trim() ? "Client is required" : undefined} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save Cost Sheet"}</button>
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
