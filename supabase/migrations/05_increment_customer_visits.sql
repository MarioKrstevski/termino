-- ============================================================
-- Migration 05: increment_customer_visits RPC (used after create_appointment)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_customer_visits(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
  SET total_visits = COALESCE(total_visits, 0) + 1
  WHERE id = p_customer_id;
END;
$$;
