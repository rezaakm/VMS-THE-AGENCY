import { supabase } from "../supabase";

export async function getLedgerEntries(entity?: string | null) {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .order("posted_at", { ascending: false });
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}
