import { supabase } from "../supabase";

export async function getJournalEntries(status?: string) {
  let query = supabase
    .from("journal_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getJournalEntriesCount(status?: string) {
  let query = supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
