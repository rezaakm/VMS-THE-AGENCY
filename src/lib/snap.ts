// Helpers for the monthly_financial_snapshots table.
//
// The table stores period as a TEXT label like "January-2026" and the
// financial figures live in camelCase columns:
//   revenueActual, netProfitActual, opexActual, directCostsActual, ...
// There is NO created_at, NO `revenue`, NO `net_income`, NO `expenses`.
//
//   revenue  = revenueActual
//   netIncome = netProfitActual
//   expenses  = revenueActual - netProfitActual
//
// Year / month must be parsed out of the `period` text.

type SnapRow = Record<string, any>;

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function snapRevenue(r: SnapRow): number {
  return num(r?.revenueActual);
}

export function snapNet(r: SnapRow): number {
  return num(r?.netProfitActual);
}

export function snapExpenses(r: SnapRow): number {
  return snapRevenue(r) - snapNet(r);
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Parse a period label like "January-2026", "january 2026", "Jan/2026"
// into { monthIndex (0-11, or -1 if unknown), year }.
function parsePeriod(period: any): { monthIndex: number; year: number } {
  const raw = String(period ?? "").trim();
  if (!raw) return { monthIndex: -1, year: 0 };

  // Split on non-alphanumeric separators (-, space, /, _ etc.)
  const parts = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);

  let monthIndex = -1;
  let year = 0;

  for (const p of parts) {
    const lower = p.toLowerCase();
    if (/^\d{4}$/.test(p)) {
      year = parseInt(p, 10);
      continue;
    }
    // Full or abbreviated month name
    const fullIdx = MONTHS.indexOf(lower);
    if (fullIdx >= 0) {
      monthIndex = fullIdx;
      continue;
    }
    const abbrIdx = MONTHS.findIndex((m) => m.startsWith(lower) && lower.length >= 3);
    if (abbrIdx >= 0) {
      monthIndex = abbrIdx;
      continue;
    }
    // Numeric month (1-12)
    if (/^\d{1,2}$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= 12 && monthIndex < 0) monthIndex = n - 1;
    }
  }

  return { monthIndex, year };
}

export function snapYear(r: SnapRow): string {
  const { year } = parsePeriod(r?.period);
  return year ? String(year) : "";
}

export function snapMonthIndex(r: SnapRow): number {
  return parsePeriod(r?.period).monthIndex;
}

// Sortable key like "2026-01". Unknown parts sort first/last predictably.
export function snapMonthKey(r: SnapRow): string {
  const { monthIndex, year } = parsePeriod(r?.period);
  const y = year ? String(year) : "0000";
  const m = monthIndex >= 0 ? String(monthIndex + 1).padStart(2, "0") : "00";
  return `${y}-${m}`;
}

// Short label like "Jan". Falls back to the raw period text if unparseable.
export function snapMonthLabel(r: SnapRow): string {
  const { monthIndex } = parsePeriod(r?.period);
  if (monthIndex >= 0) return MONTH_ABBR[monthIndex];
  return String(r?.period ?? "");
}
