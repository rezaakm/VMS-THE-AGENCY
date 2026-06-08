import { supabase } from "../supabase";

export async function getArSummary() {
  const { data, error } = await supabase
    .from("ar_entries")
    .select("balance, original_amount");

  if (error) throw error;

  const totalOutstanding = (data ?? []).reduce(
    (sum, r) => sum + (r.balance ?? 0),
    0
  );
  const totalInvoiced = (data ?? []).reduce(
    (sum, r) => sum + (r.original_amount ?? 0),
    0
  );
  const count = data?.length ?? 0;
  const collectionRate =
    totalInvoiced > 0
      ? ((totalInvoiced - totalOutstanding) / totalInvoiced) * 100
      : 0;

  return { totalOutstanding, totalInvoiced, count, collectionRate };
}

export async function getArAging() {
  const { data, error } = await supabase.from("ar_aging").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getArEntries() {
  const { data, error } = await supabase
    .from("ar_entries")
    .select("*, sales_invoices(*)");
  if (error) throw error;
  return data ?? [];
}

export async function getSalesInvoices() {
  const { data, error } = await supabase
    .from("sales_invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
