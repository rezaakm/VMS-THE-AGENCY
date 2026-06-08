import { supabase } from "../supabase";

export async function getBankAccounts() {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getBankTransactions() {
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*, bank_accounts(name)")
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
