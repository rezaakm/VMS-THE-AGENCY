import { supabase } from "../supabase";

export async function getPayrollEntries(period?: string, entity?: string | null) {
  let query = supabase
    .from("payroll_entries")
    .select("*")
    .order("pay_date", { ascending: false });

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}
