-- ============================================================
-- Migration 03: Revenue Views + create_appointment RPC
-- Run in Supabase SQL Editor AFTER 02_rls.sql
-- ============================================================

-- ----------------------------------------
-- Revenue Views
-- ----------------------------------------

CREATE OR REPLACE VIEW daily_revenue AS
SELECT
  business_id,
  DATE(created_at) AS date,
  SUM(amount + COALESCE(tip, 0)) AS total
FROM payments
GROUP BY business_id, DATE(created_at);

CREATE OR REPLACE VIEW revenue_by_staff AS
SELECT
  a.business_id,
  a.staff_id,
  SUM(p.amount + COALESCE(p.tip, 0)) AS total
FROM payments p
JOIN appointments a ON a.id = p.appointment_id
GROUP BY a.business_id, a.staff_id;

CREATE OR REPLACE VIEW revenue_by_service AS
SELECT
  a.business_id,
  a.service_id,
  SUM(p.amount + COALESCE(p.tip, 0)) AS total
FROM payments p
JOIN appointments a ON a.id = p.appointment_id
GROUP BY a.business_id, a.service_id;

-- ----------------------------------------
-- Atomic booking RPC
-- ----------------------------------------

CREATE OR REPLACE FUNCTION create_appointment(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_customer_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_source text DEFAULT 'web'
)
RETURNS appointments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment appointments;
BEGIN
  -- Lock conflicting rows to prevent double-booking (FOR UPDATE on raw rows, not aggregate)
  PERFORM id FROM appointments
  WHERE staff_id = p_staff_id
    AND business_id = p_business_id
    AND status NOT IN ('cancelled', 'no_show')
    AND tstzrange(start_time, end_time) && tstzrange(p_start_time, p_end_time)
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'Time slot is no longer available';
  END IF;

  -- Insert appointment
  INSERT INTO appointments (
    business_id, service_id, staff_id, customer_id,
    start_time, end_time, source, status
  )
  VALUES (
    p_business_id, p_service_id, p_staff_id, p_customer_id,
    p_start_time, p_end_time, p_source, 'booked'
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

-- ----------------------------------------
-- Auto-create profile on signup
-- ----------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
