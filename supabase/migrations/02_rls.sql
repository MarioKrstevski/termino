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
