-- Fix missing RLS policies for quotations and monthly_financial_snapshots
-- These tables return 403 for authenticated users because they have no
-- SELECT/INSERT/UPDATE/DELETE policies.

-- ═══════════════════════════════════════════════════════════════════
-- 1. quotations — enable RLS + allow authenticated full access
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read quotations" ON quotations;
CREATE POLICY "Authenticated users can read quotations"
  ON quotations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON quotations;
CREATE POLICY "Authenticated users can insert quotations"
  ON quotations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update quotations" ON quotations;
CREATE POLICY "Authenticated users can update quotations"
  ON quotations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete quotations" ON quotations;
CREATE POLICY "Authenticated users can delete quotations"
  ON quotations FOR DELETE TO authenticated USING (true);

-- quotation_items too
ALTER TABLE IF EXISTS quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read quotation_items" ON quotation_items;
CREATE POLICY "Authenticated users can read quotation_items"
  ON quotation_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert quotation_items" ON quotation_items;
CREATE POLICY "Authenticated users can insert quotation_items"
  ON quotation_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update quotation_items" ON quotation_items;
CREATE POLICY "Authenticated users can update quotation_items"
  ON quotation_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete quotation_items" ON quotation_items;
CREATE POLICY "Authenticated users can delete quotation_items"
  ON quotation_items FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- 2. monthly_financial_snapshots — enable RLS + allow authenticated
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS monthly_financial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read snapshots" ON monthly_financial_snapshots;
CREATE POLICY "Authenticated users can read snapshots"
  ON monthly_financial_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert snapshots" ON monthly_financial_snapshots;
CREATE POLICY "Authenticated users can insert snapshots"
  ON monthly_financial_snapshots FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update snapshots" ON monthly_financial_snapshots;
CREATE POLICY "Authenticated users can update snapshots"
  ON monthly_financial_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Also fix enquiries + cost_sheets + cost_sheet_items (needed for
--    pipeline acceptance tests and pipeline page writes)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read enquiries" ON enquiries;
CREATE POLICY "Authenticated users can read enquiries"
  ON enquiries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert enquiries" ON enquiries;
CREATE POLICY "Authenticated users can insert enquiries"
  ON enquiries FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update enquiries" ON enquiries;
CREATE POLICY "Authenticated users can update enquiries"
  ON enquiries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete enquiries" ON enquiries;
CREATE POLICY "Authenticated users can delete enquiries"
  ON enquiries FOR DELETE TO authenticated USING (true);

ALTER TABLE IF EXISTS cost_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cost_sheets" ON cost_sheets;
CREATE POLICY "Authenticated users can read cost_sheets"
  ON cost_sheets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert cost_sheets" ON cost_sheets;
CREATE POLICY "Authenticated users can insert cost_sheets"
  ON cost_sheets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update cost_sheets" ON cost_sheets;
CREATE POLICY "Authenticated users can update cost_sheets"
  ON cost_sheets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete cost_sheets" ON cost_sheets;
CREATE POLICY "Authenticated users can delete cost_sheets"
  ON cost_sheets FOR DELETE TO authenticated USING (true);

ALTER TABLE IF EXISTS cost_sheet_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cost_sheet_items" ON cost_sheet_items;
CREATE POLICY "Authenticated users can read cost_sheet_items"
  ON cost_sheet_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert cost_sheet_items" ON cost_sheet_items;
CREATE POLICY "Authenticated users can insert cost_sheet_items"
  ON cost_sheet_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update cost_sheet_items" ON cost_sheet_items;
CREATE POLICY "Authenticated users can update cost_sheet_items"
  ON cost_sheet_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete cost_sheet_items" ON cost_sheet_items;
CREATE POLICY "Authenticated users can delete cost_sheet_items"
  ON cost_sheet_items FOR DELETE TO authenticated USING (true);
