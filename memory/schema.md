# Termino – Database Schema (Finalized)

## Multi-Tenant Rule
All business-related tables MUST have:
- `business_id uuid NOT NULL`
- Index on `business_id`
- RLS policy using `business_id`

---

## Table: profiles
Extends Supabase Auth (`auth.users`). Auth is email+password.

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at timestamptz DEFAULT now()
);
```

---

## Table: businesses

```sql
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,         -- used in public booking URL: /book/[slug]
  address text,
  business_type text NOT NULL CHECK (business_type IN ('barber', 'salon', 'nail', 'massage')),
  working_hours_json jsonb,
  -- Manual subscription tracking (no Stripe for MVP)
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  sub_status text NOT NULL DEFAULT 'trial' CHECK (sub_status IN ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
```

---

## Table: staff

```sql
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name text NOT NULL,
  linked_user_id uuid REFERENCES profiles(id),  -- nullable, for staff login
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_staff_business_id ON staff(business_id);
```

---

## Table: services

```sql
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name text NOT NULL,
  duration_minutes int NOT NULL,
  price numeric(10,2) NOT NULL,
  buffer_minutes int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_services_business_id ON services(business_id);
```

---

## Table: customers

```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  phone_number text NOT NULL,
  name text,
  tags text[],
  total_visits int DEFAULT 0,
  no_show_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (business_id, phone_number)
);
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone_number);
```

---

## Table: appointments

```sql
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  service_id uuid NOT NULL REFERENCES services(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled', 'no_show')),
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'ai_call', 'manual', 'walk_in')),
  delay_minutes int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_appointments_business_time ON appointments(business_id, start_time);
CREATE INDEX idx_appointments_staff_time ON appointments(staff_id, start_time);
```

---

## Table: payments

```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  amount numeric(10,2) NOT NULL,
  tip numeric(10,2) DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'other')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_payments_business_id ON payments(business_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

---

## Table: reviews

```sql
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  rating_service int CHECK (rating_service BETWEEN 1 AND 5),
  rating_staff int CHECK (rating_staff BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
```

---

## Table: notes

```sql
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  staff_id uuid REFERENCES staff(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

## Table: sms_logs

```sql
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  phone_number text NOT NULL,
  message_type text NOT NULL,   -- otp | booking_confirmation | reminder_24h | reminder_2h | review_request | cancellation
  content text,                 -- the actual message text (so messages page can display it)
  status text NOT NULL DEFAULT 'mock',
  created_at timestamptz DEFAULT now()
);
```

No RLS required on sms_logs (system-written via service role only).

---

## Revenue Views

```sql
CREATE VIEW daily_revenue AS
SELECT
  business_id,
  DATE(created_at) AS date,
  SUM(amount + COALESCE(tip, 0)) AS total
FROM payments
GROUP BY business_id, DATE(created_at);

CREATE VIEW revenue_by_staff AS
SELECT
  a.business_id,
  a.staff_id,
  SUM(p.amount + COALESCE(p.tip, 0)) AS total
FROM payments p
JOIN appointments a ON a.id = p.appointment_id
GROUP BY a.business_id, a.staff_id;

CREATE VIEW revenue_by_service AS
SELECT
  a.business_id,
  a.service_id,
  SUM(p.amount + COALESCE(p.tip, 0)) AS total
FROM payments p
JOIN appointments a ON a.id = p.appointment_id
GROUP BY a.business_id, a.service_id;
```

---

## RLS Policy Pattern

Enable RLS on all tables except sms_logs.

### Owner policy (example for appointments):
```sql
CREATE POLICY "owner_access" ON appointments
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );
```

### Staff policy (example for appointments):
```sql
CREATE POLICY "staff_access" ON appointments
  USING (
    staff_id IN (
      SELECT id FROM staff WHERE linked_user_id = auth.uid()
    )
  );
```

Pattern is the same for all business tables — scope by owner_id or linked_user_id.

---

## Booking Atomicity (Critical)

Use a Supabase RPC function for all appointment creation:

```sql
CREATE OR REPLACE FUNCTION create_appointment(...)
RETURNS appointments AS $$
BEGIN
  -- 1. Lock the time range (advisory lock or FOR UPDATE)
  -- 2. Check overlapping appointments for staff in time window
  -- 3. INSERT if no conflict
  -- 4. Return new row
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Never create appointments via direct table insert from route handlers.
Always call the RPC function.

---

## Subscriptions Table (Future – Stripe)
When Stripe is added, replace the manual plan/sub_status/trial_ends_at columns on businesses with:

```sql
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```
