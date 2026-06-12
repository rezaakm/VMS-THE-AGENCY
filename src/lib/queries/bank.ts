import { supabase } from "../supabase";

export async function getBankAccounts(entity?: string | null) {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}

export async function getBankTransactions(entity?: string | null) {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*, bank_accounts(name)")
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  if (!entity) return data ?? [];
  return (data ?? []).filter((r) => r.entity === entity);
}
