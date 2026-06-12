import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface PricingMatch {
  item_label: string;
  typical_cost: number;
  typical_sell: number;
  min_cost: number;
  max_cost: number;
  min_sell: number;
  max_sell: number;
  usual_vendor: string | null;
  vendor_options: VendorOption[];
  times_used: number;
  match_type: string;
  score: number;
  avg_markup: number;
  last_used: string | null;
  sample_clients: string[];
}

export interface VendorOption {
  vendor: string;
  avg_cost: number;
}

export interface SimilarJob {
  id: string;
  job_number: string;
  client: string;
  event: string;
  job_date: string;
  status: string;
  item_count: number;
  total_cost: number;
  total_sell: number;
  avg_markup: number;
  client_score: number;
  scope_score: number;
  combined_score: number;
}

export interface SimilarJobWithItems extends SimilarJob {
  items: JobItem[];
}

export interface JobItem {
  id: string;
  description: string;
  vendor: string | null;
  days: number;
  unitCost: number;
  totalCost: number;
  unitSellingPrice: number;
  totalSellingPrice: number;
}

/* ─── Hook ──────────────────────────────────────────────────────────────── */

export function useSmartPricing() {
  const [matches, setMatches] = useState<Record<number, PricingMatch[]>>({});
  const [loading, setLoading] = useState<number | null>(null);
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  /** Search for pricing matches (debounced, called on each keystroke) */
  const searchPricing = useCallback((lineId: number, query: string) => {
    clearTimeout(timers.current[lineId]);
    if (query.trim().length < 3) {
      setMatches((m) => ({ ...m, [lineId]: [] }));
      return;
    }
    timers.current[lineId] = setTimeout(async () => {
      setLoading(lineId);
      const { data, error } = await supabase.rpc("match_pricing_v2", { q: query });
      setLoading(null);
      if (error) {
        // v2 is the source of truth (rich min/max, vendor_options, markup, recency, sample_clients).
        // Legacy match_pricing removed — run 006_smart_pricing.sql on the DB if this errors.
        console.warn("match_pricing_v2 error (apply supabase/migrations/006_smart_pricing.sql if needed):", error.message);
        setMatches((m) => ({ ...m, [lineId]: [] }));
        return;
      }
      setMatches((m) => ({ ...m, [lineId]: (data as PricingMatch[]) ?? [] }));
    }, 300);
  }, []);

  /** Instant search (no debounce, for the "Find cost" button) */
  const searchPricingNow = useCallback(async (lineId: number, query: string) => {
    if (!query.trim()) return;
    setLoading(lineId);
    const { data, error } = await supabase.rpc("match_pricing_v2", { q: query });
    setLoading(null);
    if (error) {
      // v2 is the source of truth (rich min/max, vendor_options, markup, recency, sample_clients).
      // Legacy match_pricing removed — run 006_smart_pricing.sql on the DB if this errors.
      console.warn("match_pricing_v2 error (apply supabase/migrations/006_smart_pricing.sql if needed):", error.message);
      setMatches((m) => ({ ...m, [lineId]: [] }));
      return;
    }
    setMatches((m) => ({ ...m, [lineId]: (data as PricingMatch[]) ?? [] }));
  }, []);

  /** Clear suggestions for a specific line */
  const clearMatches = useCallback((lineId: number) => {
    setMatches((m) => ({ ...m, [lineId]: [] }));
  }, []);

  /** Find similar past jobs by client + scope */
  const findSimilarJobs = useCallback(async (client: string, scope: string) => {
    if (!client.trim() && !scope.trim()) {
      setSimilarJobs([]);
      return;
    }
    setSimilarLoading(true);
    const { data, error } = await supabase.rpc("find_similar_jobs", {
      p_client: client || null,
      p_scope: scope || null,
    });
    setSimilarLoading(false);
    if (error) {
      console.warn("find_similar_jobs error:", error.message);
      setSimilarJobs([]);
      return;
    }
    setSimilarJobs((data as SimilarJob[]) ?? []);
  }, []);

  /** Load full line items for a specific past job (to use as template) */
  const loadJobItems = useCallback(async (jobId: string): Promise<JobItem[]> => {
    const { data, error } = await supabase
      .from("cost_sheet_items")
      .select("id, description, vendor, days, unitCost, totalCost, unitSellingPrice, totalSellingPrice")
      .eq("costSheetId", jobId)
      .order("itemNumber", { ascending: true });
    if (error) {
      console.warn("loadJobItems error:", error.message);
      return [];
    }
    return (data ?? []) as JobItem[];
  }, []);

  return {
    matches,
    loading,
    searchPricing,
    searchPricingNow,
    clearMatches,
    similarJobs,
    similarLoading,
    findSimilarJobs,
    loadJobItems,
  };
}
