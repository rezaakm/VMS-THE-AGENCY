import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared Recharts tooltip style — calm dark frosted panel used across finance + dashboard. */
export const CHART_TOOLTIP = {
  background: "hsl(0 0% 6%)",
  border: "1px solid hsl(0 0% 15%)",
  borderRadius: 8,
  fontSize: 12,
} as const;

/** Shared chart palette — meaning-driven (info/positive/negative/ai). */
export const CHART_COLORS = {
  revenue: "hsl(217 91% 60%)",
  net: "hsl(158 64% 52%)",
  expenses: "hsl(0 84% 60%)",
  ai: "hsl(270 60% 62%)",
} as const;

/** Format a number as OMR currency, e.g. "OMR 35,911.000" */
export function formatOMR(amount: number | null | undefined): string {
  if (amount == null) return "OMR 0.000";
  return `OMR ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}
