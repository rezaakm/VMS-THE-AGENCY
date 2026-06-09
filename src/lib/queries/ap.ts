import { supabase } from "../supabase";

export async function getApSummary(entity?: string | null) {
  const { data, error } = await supabase
    .from("ap_entries")
    .select("balance, original_amount, entity");

  if (error) throw error;

  const filtered = entity
    ? (data ?? []).filter((r) => r.entity === entity)
    : (data ?? []);

  const totalOutstanding = filtered.reduce(
    (sum, r) => sum + (r.balance ?? 0),
    0
  );
  const totalPayable = filtered.reduce(
    (sum, r) => sum + (r.original_amount ?? 0),
    0
  );
  const count = filtered.length;

  return { totalOutstanding, totalPayable, count };
}

export async function getApEntries(entity?: string | null) {
  const { data, error } = await supabase
    .from("ap_entries")
    .select("*, invoices(*), vendors(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}
