# Termino – Build Order (Phased Checklist)

Do NOT jump phases. Each phase must be stable before the next begins.
Update status: [ ] pending → [x] done → [~] in-progress

---

## Phase 1 – Foundation
Goal: Database, auth, business setup, service/staff CRUD

- [x] F01 Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zod`
- [x] F02 Create Supabase client files (`client.ts`, `server.ts`, `admin.ts`)
- [x] F03 Run DB migration — all tables + indexes (incl. subscription fields on businesses)
- [x] F04 Run DB migration — RLS policies
- [x] F05 Run DB migration — revenue views + `create_appointment` RPC
- [x] F06 Auth — login page (email magic link OTP, dev mode shows link on screen)
- [x] F07 Auth — middleware (protect /dashboard and /admin routes)
- [x] F08 Business onboarding page (first login → create business, redirect to dashboard)
- [x] F09 Services CRUD page
- [x] F10 Staff CRUD page

---

## Phase 2 – Booking Engine
Goal: Atomic booking, public booking page, dashboard calendar

- [x] F11 `getAvailableSlots` lib (per-staff + any-staff/auto-assign modes)
- [x] F12 API routes: `booking/create`, `booking/cancel`, `booking/reschedule`
- [x] F13 Public booking page — step 1: phone entry + mock OTP verify (OTP logged to messages page)
- [x] F14 Public booking page — step 2: returning customer recognition (offer to repeat last service)
- [x] F15 Public booking page — step 3: service → staff (or "No preference") → slot → confirm
- [x] F16 Booking success state (inline step 7 in booking-flow.tsx)
- [x] F17 Dashboard calendar (view appointments + status updates: completed / no_show / cancelled)

---

## Phase 3 – Payments + Revenue + Mock Messaging
Goal: Record payments, show revenue, messages page as notification panel

- [x] F18 Payment marking UI on calendar (mark appointment as paid, choose method + tip)
- [x] F19 Payment record API (handled in calendar page via supabase direct update)
- [x] F20 Revenue dashboard (daily, by staff, by service — from DB views)
- [x] F21 Mock `sendSMS` lib (writes to `sms_logs`, no external provider)
- [x] F22 Messages page `/dashboard/messages` (OTP codes + all SMS logs in one feed)
- [x] F23 Wire mock SMS on booking creation + cancellation

---

## Phase 4 – Customers + Automation
Goal: Customer management, reminders, review requests

- [x] F24 Customers list page (paginated, searchable by name/phone)
- [x] F25 Customer detail page (visit history, notes, tags)
- [x] F26 Notes: add/view per customer
- [x] F27 Cron: 24h + 2h reminder mock SMS logs
- [x] F28 Cron: auto no-show marking + increment no_show_count
- [x] F29 Cron: review request mock SMS after appointment completed

---

## Phase 5 – Admin Panel
Goal: Platform owner oversight of all businesses

- [x] F30 Admin route group `/admin` — protected by ADMIN_EMAIL env var check
- [x] F31 Admin: businesses list (name, type, plan, status, last active, appointment count)
- [x] F32 Admin: business detail view — read-only, service role fetch, same dashboard components
- [x] F33 Admin: manual subscription status editor per business (plan, status, trial_ends_at)

---

## Settings (Any Phase)
- [x] F34 Settings page — edit business name, address, working hours

---

## Phase 6 – Stripe (Future)
- [ ] Replace manual subscription fields with proper Stripe subscriptions table
- [ ] Stripe checkout for business subscription
- [ ] `app/api/stripe/webhook/route.ts` — sync subscription status
- [ ] Middleware: check subscription tier for feature gating

---

## Removed From Scope
- Twilio SMS (real sending) — replaced by in-app mock log viewer
- Vapi Voice AI — removed entirely

---

## Known Issues / Pending Fixes
- middleware.ts deprecation — Next.js 16 prefers `proxy.ts` convention (low priority)
- Auth callback route created (`app/auth/callback/route.ts`) but not battle-tested yet