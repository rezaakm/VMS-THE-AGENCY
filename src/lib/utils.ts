import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as OMR currency, e.g. "OMR 35,911.000" */
export function formatOMR(amount: number | null | undefined): string {
  if (amount == null) return "OMR 0.000";
  return `OMR ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}
