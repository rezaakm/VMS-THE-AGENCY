import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotePDFParams {
  client: string;
  scope: string;
  refNo: string;
  date: string; // YYYY-MM-DD or DD/MM/YYYY
  lines: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
}

const BLUE = "#1c9ad6";
const DARK = "#222222";
const fmt = (n: number) =>
  (n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

function formatDate(d: string): string {
  if (d.includes("-")) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  return d;
}

/**
 * Generates and downloads a PDF quotation matching the agency format.
 * Tries to load /logo.png; falls back to text if unavailable.
 */
export async function generateQuotePDF(params: QuotePDFParams): Promise<void> {
  const { client, scope, refNo, date, lines, subtotal, vat, total } = params;
  const dateStr = formatDate(date);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // ── Logo (top-right) ──
  try {
    const img = await loadImage("/logo.png");
    const logoH = 18;
    const logoW = (img.width / img.height) * logoH;
    doc.addImage(img.src, "PNG", pageW - margin - logoW, y - 4, logoW, logoH);
  } catch {
    doc.setFontSize(10);
    doc.setTextColor(BLUE);
    doc.text("THE AGENCY", pageW - margin, y + 4, { align: "right" });
  }

  // ── Title ──
  doc.setFontSize(24);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Quotation", margin, y + 8);
  y += 22;

  // ── Meta table ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    tableWidth: "auto",
    columnStyles: {
      0: {
        cellWidth: 32,
        fillColor: BLUE,
        textColor: "#ffffff",
        fontStyle: "bold",
        fontSize: 9,
      },
      1: { cellWidth: pageW - margin * 2 - 32, fontSize: 9 },
    },
    body: [
      ["To", client],
      ["Date", dateStr],
      ["S. N", refNo],
      ["Subject", "Quotation"],
      ["Scope of Work", scope],
    ],
    styles: {
      cellPadding: 3,
      lineWidth: 0.25,
      lineColor: "#cfd8dc",
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Line items table ──
  const bodyRows = lines.map((l, i) => [
    String(i + 1),
    l.description,
    String(l.qty),
    fmt(l.unitPrice),
    `${fmt(l.totalPrice)} OMR`,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["No.", "Description", "Qty", "Unit Cost", "Total Amount"]],
    body: bodyRows,
    headStyles: {
      fillColor: BLUE,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: DARK },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 34, halign: "right" },
    },
    styles: {
      cellPadding: 3,
      lineWidth: 0.25,
      lineColor: "#cfd8dc",
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ── Totals rows (inline below the table) ──
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    body: [
      [{ content: "Sub Total", colSpan: 4, styles: { halign: "right" as const, fillColor: BLUE, textColor: "#ffffff", fontStyle: "bold" as const } }, `${fmt(subtotal)} OMR`],
      [{ content: "VAT 5%", colSpan: 4, styles: { halign: "right" as const, fillColor: BLUE, textColor: "#ffffff", fontStyle: "bold" as const } }, `${fmt(vat)} OMR`],
      [{ content: "Total Amount", colSpan: 4, styles: { halign: "right" as const, fillColor: BLUE, textColor: "#ffffff", fontStyle: "bold" as const } }, { content: `${fmt(total)} OMR`, styles: { fillColor: BLUE, textColor: "#ffffff", fontStyle: "bold" as const } }],
    ],
    columnStyles: {
      0: { cellWidth: pageW - margin * 2 - 34 },
      4: { cellWidth: 34, halign: "right" },
    },
    styles: {
      cellPadding: 3,
      lineWidth: 0.25,
      lineColor: "#cfd8dc",
      fontSize: 9,
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Payment terms ──
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Terms:", margin, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.text(
    "50% advance with LPO as confirmation. Remaining 50% payable on day of delivery.",
    margin,
    y
  );
  y += 8;

  // ── Terms & Conditions ──
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions:", margin, y);
  doc.setFont("helvetica", "normal");
  y += 5;

  const terms = [
    "Pricing is indicative and may be revised based on final design, dimensions, and materials.",
    "Delivery timeline: 5-7 working days. Delivery within Muscat included; other locations on request.",
    "Cancellation/rescheduling: notice at least 7 days before production. Cancellation after production starts incurs 100%.",
    "The Agency is not responsible for damage caused by weather, force majeure, or mishandling by others.",
  ];
  const bulletIndent = margin + 4;
  const maxTextW = pageW - bulletIndent - margin;
  for (const t of terms) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 16;
    }
    doc.text("\u2022", margin, y);
    const split = doc.splitTextToSize(t, maxTextW);
    doc.text(split, bulletIndent, y);
    y += split.length * 4 + 2;
  }
  y += 4;

  // ── Approval line ──
  if (y > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    y = 16;
  }
  doc.text(
    "To approve, please sign & return with a PO.",
    margin,
    y
  );
  y += 5;
  doc.text("Received by: ______________    Date: ______________    Signature: ______________", margin, y);
  y += 8;

  // ── Bank details ──
  doc.text(
    "All cheques payable to Modern Lifestyle.  IBAN: OM110270323021625490018   SWIFT: BMUSOMRXXXX",
    margin,
    y
  );
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Quotation Validity: 7 Working Days", margin, y);
  y += 6;
  doc.text("Modern Lifestyle L.L.C. — Authorised Signatory", margin, y);
  y += 10;

  // ── Footer ──
  drawFooter(doc, margin);

  // ── Download ──
  const filename = refNo
    ? `Quotation_${refNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
    : "Quotation.pdf";
  doc.save(filename);
}

function drawFooter(doc: jsPDF, margin: number) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const footerY = pageH - 12;

  doc.setDrawColor(BLUE);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 2, pageW - margin, footerY - 2);

  doc.setFontSize(8);
  doc.setTextColor(BLUE);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Web: theagencyoman.com  |  Email: info@theagencyoman.com  |  Phone: +968 9317 1717",
    pageW / 2,
    footerY + 1,
    { align: "center" }
  );
  doc.text(
    "Address: Azaiba, Muscat, P.O. Box 544, Postal Code 114, Kalbu  |  Modern Lifestyle L.L.C., C.R. No. 1156928",
    pageW / 2,
    footerY + 5,
    { align: "center" }
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
