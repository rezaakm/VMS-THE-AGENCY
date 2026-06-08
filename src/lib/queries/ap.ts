import { supabase } from "../supabase";

export async function getApSummary() {
  const { data, error } = await supabase
    .from("ap_entries")
    .select("balance, original_amount");

  if (error) throw error;

  const totalOutstanding = (data ?? []).reduce(
    (sum, r) => sum + (r.balance ?? 0),
    0
  );
  const totalPayable = (data ?? []).reduce(
    (sum, r) => sum + (r.original_amount ?? 0),
    0
  );
  const count = data?.length ?? 0;

  return { totalOutstanding, totalPayable, count };
}

export async function getApEntries() {
  const { data, error } = await supabase
    .from("ap_entries")
    .select("*, invoices(*), vendors(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
