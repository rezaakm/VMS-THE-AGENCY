-- ═══════════════════════════════════════════════════════════════════════════
-- 006 · Smart Pricing Engine for Quote Wizard
-- Provides: match_pricing_v2, find_similar_jobs
-- Requires: pg_trgm extension
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable trigram matching for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for fast trigram searches on item descriptions
CREATE INDEX IF NOT EXISTS idx_csi_desc_trgm
  ON cost_sheet_items USING gin (description gin_trgm_ops);

-- Index for fast trigram searches on cost sheet events/scopes
CREATE INDEX IF NOT EXISTS idx_cs_event_trgm
  ON cost_sheets USING gin (event gin_trgm_ops);

-- Index for client name trigram searches
CREATE INDEX IF NOT EXISTS idx_cs_client_trgm
  ON cost_sheets USING gin (client gin_trgm_ops);

-- ─── match_pricing_v2 ─────────────────────────────────────────────────────
-- Given a search term, returns historical pricing data from cost_sheet_items.
-- Ranks by: exact match first, then trigram similarity, weighted by recency.
-- Returns avg/min/max costs, vendor breakdown, usage count.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_pricing_v2(q text)
RETURNS TABLE (
  item_label       text,
  typical_cost     numeric,
  typical_sell     numeric,
  min_cost         numeric,
  max_cost         numeric,
  min_sell         numeric,
  max_sell         numeric,
  usual_vendor     text,
  vendor_options   jsonb,
  times_used       bigint,
  match_type       text,
  score            double precision,
  avg_markup       numeric,
  last_used        date,
  sample_clients   text[]
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      ci.description,
      ci."unitCost",
      ci."unitSellingPrice",
      ci.vendor,
      cs.client,
      cs.date::date AS job_date,
      -- Exact match gets score 1.0, otherwise trigram similarity
      CASE
        WHEN lower(trim(ci.description)) = lower(trim(q)) THEN 1.0
        ELSE similarity(ci.description, q)::double precision
      END AS sim,
      CASE
        WHEN lower(trim(ci.description)) = lower(trim(q)) THEN 'exact'
        ELSE 'fuzzy'
      END AS mtype,
      -- Recency weight: jobs in last 6 months get full weight, older ones decay
      CASE
        WHEN cs.date IS NULL THEN 0.5
        WHEN cs.date::date > CURRENT_DATE - INTERVAL '6 months' THEN 1.0
        WHEN cs.date::date > CURRENT_DATE - INTERVAL '12 months' THEN 0.75
        ELSE 0.5
      END AS recency_weight
    FROM cost_sheet_items ci
    JOIN cost_sheets cs ON cs.id = ci."costSheetId"
    WHERE ci.description IS NOT NULL
      AND length(trim(ci.description)) > 2
      AND (
        lower(trim(ci.description)) = lower(trim(q))
        OR similarity(ci.description, q) > 0.25
      )
  ),
  -- Group by normalized description to aggregate pricing
  grouped AS (
    SELECT
      s.description AS label,
      -- Weighted average cost (recent jobs weigh more)
      ROUND(
        COALESCE(
          SUM(s."unitCost" * s.recency_weight) FILTER (WHERE s."unitCost" > 0)
          / NULLIF(SUM(s.recency_weight) FILTER (WHERE s."unitCost" > 0), 0),
          0
        )::numeric, 3
      ) AS avg_cost,
      ROUND(
        COALESCE(
          SUM(s."unitSellingPrice" * s.recency_weight) FILTER (WHERE s."unitSellingPrice" > 0)
          / NULLIF(SUM(s.recency_weight) FILTER (WHERE s."unitSellingPrice" > 0), 0),
          0
        )::numeric, 3
      ) AS avg_sell,
      ROUND(MIN(s."unitCost") FILTER (WHERE s."unitCost" > 0)::numeric, 3) AS mn_cost,
      ROUND(MAX(s."unitCost") FILTER (WHERE s."unitCost" > 0)::numeric, 3) AS mx_cost,
      ROUND(MIN(s."unitSellingPrice") FILTER (WHERE s."unitSellingPrice" > 0)::numeric, 3) AS mn_sell,
      ROUND(MAX(s."unitSellingPrice") FILTER (WHERE s."unitSellingPrice" > 0)::numeric, 3) AS mx_sell,
      -- Most frequently used vendor
      MODE() WITHIN GROUP (ORDER BY s.vendor) FILTER (WHERE s.vendor IS NOT NULL AND s.vendor <> '') AS top_vendor,
      -- All vendors with their avg cost as JSON
      jsonb_agg(DISTINCT jsonb_build_object(
        'vendor', s.vendor,
        'avg_cost', s."unitCost"
      )) FILTER (WHERE s.vendor IS NOT NULL AND s.vendor <> '') AS vendors,
      COUNT(*) AS cnt,
      MAX(s.sim) AS best_sim,
      -- Use match type of the best-scoring row
      (ARRAY_AGG(s.mtype ORDER BY s.sim DESC))[1] AS best_mtype,
      -- Average markup percentage
      ROUND(
        AVG(
          CASE WHEN s."unitCost" > 0 AND s."unitSellingPrice" > 0
            THEN ((s."unitSellingPrice" / s."unitCost") - 1) * 100
            ELSE NULL
          END
        )::numeric, 1
      ) AS markup_avg,
      MAX(s.job_date) AS latest_date,
      -- Sample of clients who ordered this item
      (ARRAY_AGG(DISTINCT s.client ORDER BY s.client) FILTER (WHERE s.client IS NOT NULL AND s.client <> ''))[1:3] AS clients
    FROM scored s
    WHERE s.sim >= 0.25
    GROUP BY s.description
  )
  SELECT
    g.label,
    g.avg_cost,
    g.avg_sell,
    g.mn_cost,
    g.mx_cost,
    g.mn_sell,
    g.mx_sell,
    g.top_vendor,
    g.vendors,
    g.cnt,
    g.best_mtype,
    g.best_sim,
    g.markup_avg,
    g.latest_date,
    g.clients
  FROM grouped g
  ORDER BY
    -- Exact matches first, then by similarity × usage count
    (CASE WHEN g.best_mtype = 'exact' THEN 100 ELSE 0 END) DESC,
    g.best_sim * ln(g.cnt + 1) DESC
  LIMIT 10;
END;
$$;

-- ─── find_similar_jobs ────────────────────────────────────────────────────
-- Given a client name and/or scope, returns past cost sheets that are similar.
-- Used for "Similar Jobs" panel in the Quote Wizard.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_similar_jobs(
  p_client text DEFAULT NULL,
  p_scope  text DEFAULT NULL
)
RETURNS TABLE (
  id             text,
  job_number     text,
  client         text,
  event          text,
  job_date       date,
  status         text,
  item_count     bigint,
  total_cost     numeric,
  total_sell     numeric,
  avg_markup     numeric,
  client_score   double precision,
  scope_score    double precision,
  combined_score double precision
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH sheet_totals AS (
    SELECT
      cs.id AS sid,
      cs."jobNumber",
      cs.client AS cs_client,
      cs.event,
      cs.date::date AS dt,
      cs.status AS cs_status,
      COUNT(ci.id) AS items,
      ROUND(COALESCE(SUM(ci."totalCost"), 0)::numeric, 3) AS t_cost,
      ROUND(COALESCE(SUM(ci."totalSellingPrice"), 0)::numeric, 3) AS t_sell,
      ROUND(
        AVG(
          CASE WHEN ci."unitCost" > 0 AND ci."unitSellingPrice" > 0
            THEN ((ci."unitSellingPrice" / ci."unitCost") - 1) * 100
            ELSE NULL
          END
        )::numeric, 1
      ) AS m_avg
    FROM cost_sheets cs
    LEFT JOIN cost_sheet_items ci ON ci."costSheetId" = cs.id
    WHERE cs.client IS NOT NULL
    GROUP BY cs.id, cs."jobNumber", cs.client, cs.event, cs.date, cs.status
    HAVING COUNT(ci.id) > 0
  ),
  scored AS (
    SELECT
      st.*,
      CASE
        WHEN p_client IS NOT NULL AND p_client <> '' THEN
          GREATEST(
            similarity(st.cs_client, p_client)::double precision,
            CASE WHEN lower(st.cs_client) = lower(p_client) THEN 1.0 ELSE 0.0 END
          )
        ELSE 0.0
      END AS c_score,
      CASE
        WHEN p_scope IS NOT NULL AND p_scope <> '' AND st.event IS NOT NULL THEN
          GREATEST(
            similarity(st.event, p_scope)::double precision,
            CASE WHEN lower(st.event) = lower(p_scope) THEN 1.0 ELSE 0.0 END
          )
        ELSE 0.0
      END AS s_score
    FROM sheet_totals st
  )
  SELECT
    sc.sid,
    sc."jobNumber",
    sc.cs_client,
    sc.event,
    sc.dt,
    sc.cs_status,
    sc.items,
    sc.t_cost,
    sc.t_sell,
    sc.m_avg,
    sc.c_score,
    sc.s_score,
    -- Combined: client match weighs 40%, scope match weighs 60%
    (COALESCE(sc.c_score, 0) * 0.4 + COALESCE(sc.s_score, 0) * 0.6) AS combo
  FROM scored sc
  WHERE sc.c_score > 0.2 OR sc.s_score > 0.25
  ORDER BY combo DESC, sc.dt DESC NULLS LAST
  LIMIT 8;
END;
$$;

-- ─── Override match_pricing to call v2 (backward compat) ──────────────────
-- The old quote wizard and pipeline service call match_pricing(q text).
-- Point it at v2 so everything benefits from the upgrade.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_pricing(q text)
RETURNS TABLE (
  item_label     text,
  typical_cost   numeric,
  typical_sell   numeric,
  usual_vendor   text,
  times_used     bigint,
  match_type     text,
  score          double precision
) LANGUAGE sql STABLE AS $$
  SELECT
    item_label,
    typical_cost,
    typical_sell,
    usual_vendor,
    times_used,
    match_type,
    score
  FROM match_pricing_v2(q);
$$;
