-- ============================================================
-- Migration 01: Tables + Indexes
-- Run in Supabase SQL Editor
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at timestamptz DEFAULT now()
);

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  address text,
  business_type text NOT NULL CHECK (business_type IN ('barber', 'salon', 'nail', 'massage')),
  working_hours_json jsonb,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  sub_status text NOT NULL DEFAULT 'trial' CHECK (sub_status IN ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  linked_user_id uuid REFERENCES profiles(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_business_id ON staff(business_id);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes int NOT NULL,
  price numeric(10,2) NOT NULL,
  buffer_minutes int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);

-- Customers (per business, identified by phone)
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  name text,
  tags text[],
  total_visits int DEFAULT 0,
  no_show_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (business_id, phone_number)
);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled', 'no_show')),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'manual', 'walk_in')),
  delay_minutes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_business_time ON appointments(business_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_time ON appointments(staff_id, start_time);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  amount numeric(10,2) NOT NULL,
  tip numeric(10,2) DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'other')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  rating_service int CHECK (rating_service BETWEEN 1 AND 5),
  rating_staff int CHECK (rating_staff BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  staff_id uuid REFERENCES staff(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- SMS Logs (mock messages + OTP codes)
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('otp', 'booking_confirmation', 'reminder_24h', 'reminder_2h', 'review_request', 'cancellation')),
  content text,
  status text NOT NULL DEFAULT 'mock',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_business_id ON sms_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
-- ============================================================
-- Migration 02: Row Level Security Policies
-- Run in Supabase SQL Editor AFTER 01_tables.sql
-- ============================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
-- sms_logs: no RLS (written via service role, read via service role in dashboard)

-- ----------------------------------------
-- profiles
-- ----------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Allow insert so handle_new_user trigger can create profile on signup.
-- Auth trigger runs as supabase_auth_admin; SECURITY DEFINER runs as owner (postgres). Cover both.
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Trigger can insert profile on signup" ON profiles;
CREATE POLICY "Trigger can insert profile on signup" ON profiles
  FOR INSERT TO postgres WITH CHECK (true);

DROP POLICY IF EXISTS "Auth admin can insert profile on signup" ON profiles;
CREATE POLICY "Auth admin can insert profile on signup" ON profiles
  FOR INSERT TO supabase_auth_admin WITH CHECK (true);

-- ----------------------------------------
-- businesses
-- ----------------------------------------
DROP POLICY IF EXISTS "Owners can manage own business" ON businesses;
CREATE POLICY "Owners can manage own business" ON businesses
  FOR ALL USING (owner_id = auth.uid());

-- ----------------------------------------
-- staff
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage staff" ON staff;
CREATE POLICY "Owner can manage staff" ON staff
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read own record" ON staff;
CREATE POLICY "Staff can read own record" ON staff
  FOR SELECT USING (linked_user_id = auth.uid());

-- ----------------------------------------
-- services
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage services" ON services;
CREATE POLICY "Owner can manage services" ON services
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can read active services" ON services;
CREATE POLICY "Public can read active services" ON services
  FOR SELECT USING (active = true);

-- ----------------------------------------
-- customers
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage customers" ON customers;
CREATE POLICY "Owner can manage customers" ON customers
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ----------------------------------------
-- appointments
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage appointments" ON appointments;
CREATE POLICY "Owner can manage appointments" ON appointments
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read own appointments" ON appointments;
CREATE POLICY "Staff can read own appointments" ON appointments
  FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE linked_user_id = auth.uid())
  );

-- ----------------------------------------
-- payments
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage payments" ON payments;
CREATE POLICY "Owner can manage payments" ON payments
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ----------------------------------------
-- reviews
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can read reviews" ON reviews;
CREATE POLICY "Owner can read reviews" ON reviews
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- ----------------------------------------
-- notes
-- ----------------------------------------
DROP POLICY IF EXISTS "Owner can manage notes" ON notes;
CREATE POLICY "Owner can manage notes" ON notes
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
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

-- ============================================================
-- Migration 04: sms_logs.appointment_id for cron dedupe + review requests
-- ============================================================
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_appointment_message
  ON sms_logs(appointment_id, message_type)
  WHERE appointment_id IS NOT NULL;

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

-- ============================================================
-- Migration 06: business_total_revenue view (all-time per business)
-- ============================================================

CREATE OR REPLACE VIEW business_total_revenue AS
SELECT
  business_id,
  SUM(amount + COALESCE(tip, 0)) AS total
FROM payments
GROUP BY business_id;
