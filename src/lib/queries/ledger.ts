import { supabase } from "../supabase";

export async function getLedgerEntries() {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
