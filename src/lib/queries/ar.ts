import { supabase } from "../supabase";

export async function getArSummary(entity?: string | null) {
  const { data, error } = await supabase
    .from("ar_entries")
    .select("balance, original_amount, entity");

  if (error) throw error;

  const filtered = entity
    ? (data ?? []).filter((r) => r.entity === entity)
    : (data ?? []);

  const totalOutstanding = filtered.reduce(
    (sum, r) => sum + (r.balance ?? 0),
    0
  );
  const totalInvoiced = filtered.reduce(
    (sum, r) => sum + (r.original_amount ?? 0),
    0
  );
  const count = filtered.length;
  const collectionRate =
    totalInvoiced > 0
      ? ((totalInvoiced - totalOutstanding) / totalInvoiced) * 100
      : 0;

  return { totalOutstanding, totalInvoiced, count, collectionRate };
}

export async function getArAging(entity?: string | null) {
  const { data, error } = await supabase.from("ar_aging").select("*");
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}

export async function getArEntries(entity?: string | null) {
  const { data, error } = await supabase
    .from("ar_entries")
    .select("*, sales_invoices(*)");
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}

export async function getSalesInvoices(entity?: string | null) {
  const { data, error } = await supabase
    .from("sales_invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}
