# Termino – Claude Project Context

## What This Project Is
Multi-tenant local service booking SaaS (barbershops, salons, nail, massage).
One app, one database, many businesses — isolated via `business_id` + RLS.
Owner: Mario Krstevski (mariokrstevski@hotmail.com)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase email + password |
| Deployment | Vercel |
| Payments | Stripe (future — not yet implemented) |
| SMS/Voice | Removed from scope (schema stubbed only) |

## What Is NOT In Scope
- Twilio or any real SMS provider
- Vapi / any AI voice agent
- Phone number auth (email only)
- Stripe (schema placeholder exists, not wired)

---

## Auth Behaviour

**Method:** Supabase email + password. No magic links for login (avoids Supabase’s ~4 emails/hour rate limit).

**Flow:**
1. **Sign in:** `/login` — email + password → `signInWithPassword` → redirect to `/` (dashboard or onboarding).
2. **Sign up:** `/signup` — if `SKIP_SIGNUP_EMAIL_VERIFICATION=true`, POST to `/api/auth/signup` → admin creates user as confirmed (no email) → client signs in and redirects. Otherwise client `signUp()` → confirmation email → `/auth/callback`. **Revert for production:** set env to false/remove and rely on client signUp + email confirmation; see Environment Variables and `app/api/auth/signup/route.ts`.
3. **Forgot password:** `/forgot-password` — email → `resetPasswordForEmail` → user clicks link → `/auth/callback` (password reset).
4. If business exists → `/dashboard`, else → `/onboarding`.

**Middleware protects:**
- `/dashboard/*` — must be authenticated + have a business
- `/admin/*` — must be authenticated + `user.email === ADMIN_EMAIL`
- Public (no auth): `/`, `/login`, `/signup`, `/forgot-password`, `/auth`, `/book/*`, `/api/booking/*`

---

## SMS / Messaging

The `sms_logs` table exists in the schema and `lib/sms/sendSMS.ts` writes to it (mock only, no external provider).
**Wired:** `sendSMS` is called on booking creation and cancellation (confirmation + cancellation messages).
Cron jobs call it for 24h/2h reminders and review requests. OTP codes are logged via verify-otp.
The `/dashboard/messages` page reads `sms_logs` for the mock notification feed.
When real SMS is needed later: replace the mock implementation with a real provider; API/cron wiring stays the same.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://okfjsytnnfstayyljlwz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAIL=mariokrstevski@hotmail.com
CRON_SECRET=...         # for /api/cron/* (Vercel sends Bearer token)
STRIPE_SECRET_KEY=...   # future

# Signup: skip verification email (for dev / low Supabase email limit). REVERT FOR PRODUCTION:
# Set to false or remove, and use normal client signUp() so users confirm email.
# Code: app/api/auth/signup/route.ts (skipVerification) + signup page (calls API first).
SKIP_SIGNUP_EMAIL_VERIFICATION=true
```

Server-only (never expose to client): `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `DATABASE_URL`
Client-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Scripts (`run-migrations.mjs`, `seed-admin.mjs`, `seed.mjs`) read from env; run with `node --env-file=.env.local scripts/…`. Add `DATABASE_URL` (Postgres connection string) to `.env.local` for migrations/seed.

---

## Database — Key Rules

1. Every business-scoped table MUST have `business_id uuid NOT NULL` + index + RLS policy
2. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
3. Never trust client-provided `business_id` — always derive from session:
   ```ts
   const { data: { user } } = await supabase.auth.getUser()
   const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
   ```
4. Booking creation MUST be atomic — always use the `create_appointment` RPC, never direct insert
5. All revenue aggregation at DB level (views), never compute in frontend code

## Database — Supabase Connection
- Project ref: `okfjsytnnfstayyljlwz`
- Direct URL: `postgresql://postgres.okfjsytnnfstayyljlwz:[PASS]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`
- Pooler URL: same host, port 6543, `?pgbouncer=true`
- DB password: in `pass.txt`
- Migrations runner: `node --env-file=.env.local scripts/run-migrations.mjs`
- Seed runner: `node --env-file=.env.local scripts/seed-admin.mjs`

---

## Folder Structure

```
app/
  (auth)/
    login/page.tsx              ← email + password sign in
    signup/page.tsx             ← email + password sign up
    forgot-password/page.tsx    ← request password reset email
  (auth)/auth/callback/         ← Supabase auth redirect handler
  (public)/
    book/[slug]/page.tsx        ← public booking page (no auth required)
    book/[slug]/success/page.tsx
  (dashboard)/
    onboarding/page.tsx         ← create business after first login
    dashboard/
      layout.tsx                ← loads business from session, renders nav
      page.tsx                  ← overview / today's stats
      calendar/page.tsx         ← appointments by day + status + payment
      services/page.tsx         ← CRUD services
      staff/page.tsx            ← CRUD staff
      customers/page.tsx        ← paginated customer list
      customers/[id]/page.tsx   ← customer detail: history, notes
      revenue/page.tsx          ← DB views: daily/staff/service revenue
      messages/page.tsx         ← sms_logs reader (mock notification panel)
      settings/page.tsx         ← edit business name, address, working hours
  (admin)/
    admin/
      layout.tsx                ← checks ADMIN_EMAIL
      page.tsx                  ← list all businesses
      businesses/[id]/page.tsx  ← read-only view + subscription editor
  api/
    booking/
      slots/route.ts            ← GET available time slots
      create/route.ts           ← POST create appointment (atomic via RPC)
      cancel/route.ts           ← POST cancel appointment
      reschedule/route.ts       ← POST reschedule
      verify-otp/route.ts       ← POST send/verify customer phone OTP
    cron/
      reminders/route.ts        ← Vercel Cron: 24h + 2h reminder logs
      no-show/route.ts          ← Vercel Cron: auto-mark no_show
      review-request/route.ts   ← Vercel Cron: review request after completed

lib/
  supabase/
    client.ts    ← createBrowserClient (client components)
    server.ts    ← createServerClient with cookies (server components)
    admin.ts     ← service role client (server-only, bypasses RLS)
  booking/
    getAvailableSlots.ts
  sms/
    sendSMS.ts   ← stubbed, not wired to booking events yet
    templates.ts

components/
  dashboard/nav.tsx
  booking/booking-flow.tsx      ← multi-step booking flow (client component)
  ui/                           ← shadcn components

scripts/
  run-migrations.mjs            ← runs all SQL migrations against Supabase
  seed-admin.mjs                ← creates demo businesses + test data
  seed.mjs                      ← older seed (superseded by seed-admin.mjs)

supabase/migrations/
  01_tables.sql
  02_rls.sql
  03_views_and_rpc.sql
  ALL_MIGRATIONS.sql            ← combined, paste this into Supabase SQL Editor
```

---

## Database Schema Summary

### Tables
| Table | Key columns |
|---|---|
| `profiles` | id (FK auth.users), email, role (owner/staff) |
| `businesses` | id, owner_id, name, slug, business_type, working_hours_json, plan, sub_status, trial_ends_at |
| `staff` | id, business_id, name, linked_user_id, active |
| `services` | id, business_id, name, duration_minutes, price, buffer_minutes, active |
| `customers` | id, business_id, phone_number, name, tags[], total_visits, no_show_count |
| `appointments` | id, business_id, service_id, staff_id, customer_id, start_time, end_time, status, source, delay_minutes |
| `payments` | id, business_id, appointment_id, amount, tip, payment_method |
| `reviews` | id, business_id, appointment_id, rating_service, rating_staff, comment |
| `notes` | id, business_id, customer_id, staff_id, content |
| `sms_logs` | id, business_id, phone_number, message_type, content, status |

### Views (DB-level aggregation)
- `daily_revenue` — sum(amount+tip) grouped by business_id + date
- `revenue_by_staff` — grouped by business_id + staff_id
- `revenue_by_service` — grouped by business_id + service_id

### Key RPC
- `create_appointment(...)` — atomic: checks overlap FOR UPDATE, inserts, returns row
- `handle_new_user()` trigger — auto-creates profile row on auth.users insert

### Subscription tracking (manual, no Stripe yet)
Fields on `businesses`: `plan` (free/starter/pro), `sub_status` (trial/active/past_due/cancelled), `trial_ends_at`
Admin can update these manually via `/admin/businesses/[id]`.
When Stripe is added: replace with proper `subscriptions` table.

---

## Booking Flow (Public — No Auth Required)

Customer visits `/book/[slug]`:
1. Enter phone number
2. Receive OTP → shown on `/dashboard/messages` in dev mode
3. Enter 4-digit OTP to verify
4. If returning customer: offer to repeat last service
5. If new: enter name (auto-saved to `customers`)
6. Pick service → pick staff or "No preference" → pick date/time slot → confirm
7. Appointment created via `create_appointment` RPC

**Staff selection:**
- Specific staff: show that person's slots only
- "No preference": show union of all available slots grouped by staff; auto-assign

---

## Admin Panel

- Route: `/admin` — requires `user.email === process.env.ADMIN_EMAIL`
- Uses `lib/supabase/admin.ts` (service role) to read any business's data
- Read-only except: can update `plan`, `sub_status`, `trial_ends_at` per business
- No session impersonation — admin stays logged in as themselves

---

## Coding Rules

### API route handler pattern
```ts
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })
  // ... use admin client for mutations that bypass RLS
}
```

### Supabase client selection
| Where | Import from |
|---|---|
| Server Component / Route Handler | `lib/supabase/server.ts` |
| Client Component | `lib/supabase/client.ts` |
| Admin operation (service role) | `lib/supabase/admin.ts` — server-side only |

### Performance
- Server Components for all dashboard pages
- Date range filters on all appointment queries — never full table scan
- Paginate customers (page size: 50)
- Revenue via DB views only

### Multi-vertical pattern
```ts
if (business.business_type === 'barber') { /* barber-specific */ }
```
Never hardcode vertical logic into the booking engine core.

---

## Demo Accounts (Seed Data)
| Email | Password | Business |
|---|---|---|
| demo-barber@termino.test | Demo1234! | Kings Cut Barbershop (/book/kings-cut) |
| demo-nails@termino.test | Demo1234! | Glamour Nails & Beauty (/book/glamour-nails) |

Staff: Marco, Jake, Danny (Kings Cut) · Sofia, Elena (Glamour Nails)

---

## Progress Tracking
See `PROGRESS.md` in project root for the full feature checklist.
