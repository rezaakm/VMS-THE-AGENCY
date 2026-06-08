import { supabase } from "../supabase";

export async function getOverviewMetrics() {
  // Fetch AR total
  const { data: arData, error: arErr } = await supabase
    .from("ar_entries")
    .select("balance");
  if (arErr) throw arErr;
  const totalAR = (arData ?? []).reduce((s, r) => s + (r.balance ?? 0), 0);

  // Fetch AP total
  const { data: apData, error: apErr } = await supabase
    .from("ap_entries")
    .select("balance");
  if (apErr) throw apErr;
  const totalAP = (apData ?? []).reduce((s, r) => s + (r.balance ?? 0), 0);

  // Net position
  const netPosition = totalAR - totalAP;

  // Open journal entries count
  const { count: openJournals, error: jErr } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .in("status", ["DRAFT", "PENDING_REVIEW"]);
  if (jErr) throw jErr;

  // Invoice count
  const { count: invoiceCount, error: iErr } = await supabase
    .from("sales_invoices")
    .select("id", { count: "exact", head: true });
  if (iErr) throw iErr;

  return {
    totalAR,
    totalAP,
    netPosition,
    openJournals: openJournals ?? 0,
    invoiceCount: invoiceCount ?? 0,
  };
}

export async function getRecentActivity() {
  const [journalRes, invoiceRes] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, description, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, client_name, amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (journalRes.error) throw journalRes.error;
  if (invoiceRes.error) throw invoiceRes.error;

  return {
    recentJournals: journalRes.data ?? [],
    recentInvoices: invoiceRes.data ?? [],
  };
}
