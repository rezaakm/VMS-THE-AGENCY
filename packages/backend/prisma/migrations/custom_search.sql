-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add tsvector column for full-text search
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(description, ''))) STORED;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_line_items_description_tsv ON line_items USING gin(description_tsv);
CREATE INDEX IF NOT EXISTS idx_line_items_description_trgm ON line_items USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_line_items_category ON line_items(category_id);
CREATE INDEX IF NOT EXISTS idx_line_items_vendor ON line_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_line_items_project ON line_items(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_year ON projects(year);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- Function: smart search with FTS + trigram scoring
CREATE OR REPLACE FUNCTION search_line_items(
  search_query TEXT,
  limit_count INT DEFAULT 50,
  min_similarity FLOAT DEFAULT 0.1
)
RETURNS TABLE(
  id UUID,
  description TEXT,
  category_id UUID,
  quantity FLOAT,
  unit_cost FLOAT,
  total_cost FLOAT,
  unit_selling FLOAT,
  total_selling FLOAT,
  margin_pct FLOAT,
  vendor_id UUID,
  vendor_raw TEXT,
  project_id UUID,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    li.id::UUID,
    li.description::TEXT,
    li.category_id::UUID,
    li.quantity::FLOAT,
    li.unit_cost::FLOAT,
    li.total_cost::FLOAT,
    li.unit_selling::FLOAT,
    li.total_selling::FLOAT,
    li.margin_pct::FLOAT,
    li.vendor_id::UUID,
    li.vendor_raw,
    li.project_id::UUID,
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
