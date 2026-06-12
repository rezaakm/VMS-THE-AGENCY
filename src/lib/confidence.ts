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
  matchScore: number | null | undefined,
  context?: { timesUsed?: number; vendor?: string | null }
): ConfidenceResult {
  if (!matchType || matchScore == null) {
    // Soften for history-backed cases even without strong matchType/score
    if (context && ((context.timesUsed ?? 0) >= 3 || /rehan/i.test(context.vendor || ""))) {
      return { score: 60, bucket: "low", label: "History-based (soft)" };
    }
    return { score: 0, bucket: "none", label: "Manual price required" };
  }

  if (matchType === "exact") {
    return { score: 95, bucket: "high", label: "Exact match" };
  }

  // Fuzzy match (base tiers)
  let score: number;
  let label: string;
  if (matchScore >= 0.75) {
    score = 85;
    label = "Strong fuzzy match";
  } else if (matchScore >= 0.6) {
    score = 70;
    label = "Fuzzy match";
  } else if (matchScore >= 0.45) {
    score = 55;
    label = "Weak match — review";
  } else {
    score = 0;
    label = "No reliable match";
  }

  // Soften: fuzzy + used ≥3× or known good vendor (e.g. Rehan) → at least >50%
  if (matchType !== "exact" && context) {
    const used = context.timesUsed ?? 0;
    const vend = (context.vendor || "").toLowerCase();
    if (used >= 3 || vend.includes("rehan")) {
      if (score < 60) {
        score = 60;
        label = "Good history match";
      }
    }
  }

  // Final floor for any history-backed line that would otherwise be 0
  if (score === 0 && context && ((context.timesUsed ?? 0) > 0 || context.vendor)) {
    score = 60;
    label = "History-based (review)";
  }

  const bucket: ConfidenceBucket =
    score >= 80 ? "high" : score >= 60 ? "medium" : score >= 50 ? "low" : "none";

  return { score, bucket, label };
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
