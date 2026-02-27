-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Full-text search column
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS description_tsv tsvector;

-- Auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION line_items_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.description_tsv := to_tsvector('english', COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS line_items_tsv_update ON line_items;
CREATE TRIGGER line_items_tsv_update
  BEFORE INSERT OR UPDATE OF description ON line_items
  FOR EACH ROW EXECUTE FUNCTION line_items_tsv_trigger();

-- Update existing rows
UPDATE line_items SET description_tsv = to_tsvector('english', COALESCE(description, ''));

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_line_items_tsv ON line_items USING GIN(description_tsv);

-- Trigram index for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_line_items_description_trgm ON line_items USING GIN(description gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_line_items_category_vendor ON line_items(category_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_year ON projects(client_id, year);

-- Function: search items with combined FTS + trigram scoring
CREATE OR REPLACE FUNCTION search_line_items(
  search_query TEXT,
  limit_count INT DEFAULT 50,
  min_similarity FLOAT DEFAULT 0.15
)
RETURNS TABLE(
  id TEXT,
  description TEXT,
  category_id TEXT,
  quantity FLOAT,
  unit_cost FLOAT,
  total_cost FLOAT,
  unit_selling FLOAT,
  total_selling FLOAT,
  margin_pct FLOAT,
  vendor_id TEXT,
  vendor_raw TEXT,
  project_id TEXT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    li.id::TEXT,
    li.description,
    li.category_id::TEXT,
    li.quantity::FLOAT,
    li.unit_cost::FLOAT,
    li.total_cost::FLOAT,
    li.unit_selling::FLOAT,
    li.total_selling::FLOAT,
    li.margin_pct::FLOAT,
    li.vendor_id::TEXT,
    li.vendor_raw,
    li.project_id::TEXT,
    (
      COALESCE(ts_rank(li.description_tsv, plainto_tsquery('english', search_query)), 0) * 2 +
      COALESCE(similarity(li.description, search_query), 0)
    )::FLOAT AS relevance_score
  FROM line_items li
  WHERE
    li.description_tsv @@ plainto_tsquery('english', search_query)
    OR similarity(li.description, search_query) > min_similarity
  ORDER BY relevance_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: get price benchmarks for a category
CREATE OR REPLACE FUNCTION get_category_benchmarks(cat_id TEXT)
RETURNS TABLE(
  avg_unit_cost FLOAT,
  min_unit_cost FLOAT,
  max_unit_cost FLOAT,
  median_unit_cost FLOAT,
  item_count BIGINT,
  avg_margin_pct FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(li.unit_cost)::FLOAT,
    MIN(li.unit_cost)::FLOAT,
    MAX(li.unit_cost)::FLOAT,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY li.unit_cost)::FLOAT,
    COUNT(*)::BIGINT,
    AVG(li.margin_pct)::FLOAT
  FROM line_items li
  WHERE li.category_id = cat_id::UUID
    AND li.unit_cost > 0;
END;
$$ LANGUAGE plpgsql;
