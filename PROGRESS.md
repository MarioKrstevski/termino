# Termino – Feature Progress

Last updated: 2026-03-05

## Phase 1 – Foundation
- [x] F01 Install dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `zod`)
- [x] F02 Supabase client files (`lib/supabase/client.ts`, `server.ts`, `admin.ts`)
- [x] F03 DB migration – tables + indexes (`supabase/migrations/01_tables.sql`)
- [x] F04 DB migration – RLS policies (`supabase/migrations/02_rls.sql`)
- [x] F05 DB migration – views + `create_appointment` RPC (`supabase/migrations/03_views_and_rpc.sql`)
- [x] F06 Auth – login page (email magic link OTP — dev mode shows link on screen)
- [x] F07 Auth – middleware (`middleware.ts` — protects `/dashboard/*` and `/admin/*`)
- [x] F08 Business onboarding (`app/(dashboard)/onboarding/page.tsx`)
- [x] F09 Services CRUD (`app/(dashboard)/dashboard/services/page.tsx`)
- [x] F10 Staff CRUD (`app/(dashboard)/dashboard/staff/page.tsx`)

## Phase 2 – Booking Engine
- [x] F11 `getAvailableSlots` lib (`lib/booking/getAvailableSlots.ts`)
- [x] F12 API routes: `booking/create`, `booking/cancel`, `booking/reschedule`
- [x] F13 Public booking – phone entry + mock OTP (`app/(public)/book/[slug]/page.tsx` + `components/booking/booking-flow.tsx`)
- [x] F14 Public booking – returning customer recognition (repeat last service offer)
- [x] F15 Public booking – service → staff → slot → confirm
- [x] F16 Booking success state (inline in booking-flow.tsx step 7)
- [x] F17 Dashboard calendar (`app/(dashboard)/dashboard/calendar/page.tsx`)

## Phase 3 – Payments + Revenue + Messaging
- [x] F18 Payment marking UI on calendar (mark paid, method, tip)
- [x] F19 Payment record API (handled in calendar page via supabase direct update)
- [x] F20 Revenue dashboard (`app/(dashboard)/dashboard/revenue/page.tsx`)
- [x] F21 Mock `sendSMS` lib (`lib/sms/sendSMS.ts` — writes to `sms_logs`, no external provider)
- [x] F22 Messages page (`app/(dashboard)/dashboard/messages/page.tsx`)
- [x] F23 Wire mock SMS on booking creation + cancellation

## Phase 4 – Customers + Automation
- [x] F24 Customers list (`app/(dashboard)/dashboard/customers/page.tsx`)
- [x] F25 Customer detail (`app/(dashboard)/dashboard/customers/[id]/page.tsx`)
- [x] F26 Notes: add/view per customer (included in customer detail page)
- [x] F27 Cron: 24h + 2h reminder mock SMS
- [x] F28 Cron: auto no-show marking
- [x] F29 Cron: review request mock SMS after completion

## Phase 5 – Admin Panel
- [x] F30 Admin route group (`app/(admin)/admin/layout.tsx` — ADMIN_EMAIL check)
- [x] F31 Admin businesses list (`app/(admin)/admin/page.tsx`)
- [x] F32 Admin business detail (`app/(admin)/admin/businesses/[id]/page.tsx`)
- [x] F33 Admin subscription editor (plan + sub_status dropdowns in business detail)

## Settings
- [x] F34 Settings page (`app/(dashboard)/dashboard/settings/page.tsx`)

## Known Issues / Fixes Needed
- [x] Auth callback route (`app/auth/callback/route.ts`) — implemented for magic link flow
- [ ] `middleware.ts` deprecation — Next.js 16 prefers `proxy.ts` convention (low priority)

## Seed / Scripts
- [x] `supabase/migrations/ALL_MIGRATIONS.sql` — combined SQL for manual paste
- [x] `scripts/seed-admin.mjs` — seeds auth users + demo business data
