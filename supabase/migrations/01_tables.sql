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
