-- 004_grant_authenticated_access.sql
--
-- Root cause of the "empty pages / 403 Forbidden" bug:
-- ~25 tables (quotations, quotation_items, monthly_financial_snapshots,
-- enquiries, entities, financial_flags, cost_estimates, etc.) were created
-- WITHOUT table-level privileges granted to the `authenticated` role.
-- PostgREST therefore returned HTTP 403 on read, and the pages showed nothing,
-- while tables that DID have the grant (ar_entries, ap_entries, bank_accounts,
-- cost_sheets, sales_invoices, vendors, ...) worked.
--
-- This migration grants the logged-in owner (authenticated) full DML on every
-- table in the public schema, plus sequence usage, and sets default privileges
-- so future tables inherit the grant. The `anon` (logged-out) role is
-- intentionally NOT granted anything, so the app still requires login.
--
-- Applied to production on 2026-06-10 via Supabase MCP migration
-- "grant_authenticated_access_all_tables".

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Backfill a permissive policy on any RLS-enabled table that lacks one for the
-- authenticated role, so reads/writes are not silently blocked by RLS even
-- though the grant is present.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
          and p.roles::text like '%authenticated%'
      )
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      r.relname || '_auth_all', r.relname
    );
  end loop;
end $$;
