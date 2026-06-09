-- Pipeline: schema additions for enquiry → quote automation
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Types: enquiries.id=bigint, cost_sheets.id=text, quotations.id=bigint

-- ─── cost_sheets: pipeline status + approval tracking ───
ALTER TABLE cost_sheets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS enquiry_id bigint REFERENCES enquiries(id),
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

COMMENT ON COLUMN cost_sheets.status IS 'draft | approved | rejected | quoted';
COMMENT ON COLUMN cost_sheets.confidence IS 'Weighted average confidence 0-100';
COMMENT ON COLUMN cost_sheets.enquiry_id IS 'Link back to the source enquiry';

-- ─── cost_sheet_items: per-line confidence from match_pricing ───
ALTER TABLE cost_sheet_items
  ADD COLUMN IF NOT EXISTS match_type text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS price_source text;

COMMENT ON COLUMN cost_sheet_items.match_type IS 'exact | fuzzy | null (manual)';
COMMENT ON COLUMN cost_sheet_items.confidence IS 'Line confidence 0-100';
COMMENT ON COLUMN cost_sheet_items.price_source IS 'e.g. history:exact, history:fuzzy, manual';

-- ─── enquiries: ensure source tracking + extended status lifecycle ───
ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS source_email_id text;

COMMENT ON COLUMN enquiries.source_email_id IS 'Gmail message ID for dedup on hourly scan';

-- ─── quotations: link to cost sheet + send tracking ───
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS cost_sheet_id text REFERENCES cost_sheets(id),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to text,
  ADD COLUMN IF NOT EXISTS account_owner text;

COMMENT ON COLUMN quotations.cost_sheet_id IS 'Source cost sheet for pipeline-generated quotes';
COMMENT ON COLUMN quotations.sent_at IS 'When the quote was sent to the client';
COMMENT ON COLUMN quotations.sent_to IS 'Email address the quote was sent to';

-- ─── Update the COLUMNS whitelist in api-client.tsx after running this ───
-- cost_sheets: add "status","confidence","enquiry_id","approved_by","approved_at"
-- cost_sheet_items: add "match_type","confidence","price_source"
-- quotations: add "cost_sheet_id","sent_at","sent_to","account_owner"
-- enquiries: add "source_email_id"

-- ─── Indexes for pipeline queries ───
CREATE INDEX IF NOT EXISTS idx_cost_sheets_status ON cost_sheets(status);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_enquiry_id ON cost_sheets(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_source_email_id ON enquiries(source_email_id);
CREATE INDEX IF NOT EXISTS idx_quotations_cost_sheet_id ON quotations(cost_sheet_id);

-- ─── RLS: keep authenticated policies on new columns (inherits existing) ───
-- No new RLS needed — the existing row-level policies on these tables
-- already grant authenticated users full access.
