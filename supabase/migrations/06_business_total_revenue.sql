-- ============================================================
-- Migration 06: business_total_revenue view (all-time per business)
-- ============================================================

CREATE OR REPLACE VIEW business_total_revenue AS
SELECT
  business_id,
  SUM(amount + COALESCE(tip, 0)) AS total
FROM payments
GROUP BY business_id;
