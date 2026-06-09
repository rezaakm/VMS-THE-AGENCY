/**
 * Confidence scoring for match_pricing results.
 * Per PIPELINE-SPEC.md section 5.
 */

export type ConfidenceBucket = "high" | "medium" | "low" | "none";

export interface ConfidenceResult {
  /** 0–100 */
  score: number;
  bucket: ConfidenceBucket;
  label: string;
}

export function computeLineConfidence(
  matchType: string | null | undefined,
  matchScore: number | null | undefined
): ConfidenceResult {
  if (!matchType || matchScore == null) {
    return { score: 0, bucket: "none", label: "Manual price required" };
  }

  if (matchType === "exact") {
    return { score: 95, bucket: "high", label: "Exact match" };
  }

  // Fuzzy match
  if (matchScore >= 0.75) {
    return { score: 85, bucket: "high", label: "Strong fuzzy match" };
  }
  if (matchScore >= 0.6) {
    return { score: 70, bucket: "medium", label: "Fuzzy match" };
  }
  if (matchScore >= 0.45) {
    return { score: 55, bucket: "low", label: "Weak match — review" };
  }

  return { score: 0, bucket: "none", label: "No reliable match" };
}

export function computeSheetConfidence(
  lines: Array<{ total: number; confidence: number }>
): number {
  const totalValue = lines.reduce((s, l) => s + l.total, 0);
  if (totalValue <= 0) return 0;
  const weightedSum = lines.reduce((s, l) => s + l.total * l.confidence, 0);
  return Math.round(weightedSum / totalValue);
}

export const CONFIDENCE_COLORS: Record<ConfidenceBucket, string> = {
  high: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  medium: "bg-amber-900/50 text-amber-300 border-amber-700",
  low: "bg-orange-900/50 text-orange-300 border-orange-700",
  none: "bg-red-900/50 text-red-300 border-red-700",
};

export const CONFIDENCE_DOT_COLORS: Record<ConfidenceBucket, string> = {
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-orange-400",
  none: "bg-red-400",
};
