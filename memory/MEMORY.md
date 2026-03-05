# Termino – Project Memory

## What This Is
Multi-tenant local service SaaS (barbershops, salons, nail, massage).
One app, one database, many businesses — isolated via business_id + RLS.

## Tech Stack (Finalized)
- **Framework**: Next.js (App Router) + TypeScript
- **DB/Auth**: Supabase (Postgres + RLS + email magic link OTP auth — no passwords)
- **Styling**: TailwindCSS
- **SMS**: Mock only — messages logged to `sms_logs`, displayed on `/dashboard/messages`
- **Voice AI**: Removed from scope
- **Hosting**: Vercel
- **Payments**: Stripe (future)

## Project State
- F01–F34 all implemented (see PROGRESS.md in project root for detailed status)
- Auth: email magic link OTP (`app/(auth)/login/page.tsx` + `app/auth/callback/route.ts`)
- Dev mode: magic link shown on screen after sending
- SMS: mock only — `lib/sms/sendSMS.ts` writes to `sms_logs`, NOT yet wired to booking events (F23 pending)

## Key Memory Files
- [schema.md](schema.md) — Final DB schema with all tables, indexes, RLS rules
- [build-order.md](build-order.md) — Phased feature checklist F01–F34
- [conventions.md](conventions.md) — Code patterns, security rules, architecture constraints

## Critical Rules (Never Break)
1. Every business table MUST have `business_id` (uuid, indexed, RLS protected)
2. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
3. Never trust client-provided `business_id` — always derive from session
4. Booking creation MUST be atomic (Postgres transaction / Supabase RPC)
5. All revenue aggregation happens at DB level (views), never in frontend
6. Rate limit the booking endpoint

## Customer Booking Flow (No account required)
1. Enter phone number on `/book/[slug]`
2. Receive mock OTP → shown on messages page → customer enters code
3. If returning customer: offer to repeat last service
4. If new: enter name (auto-saved to customers table)
5. Pick service → pick staff or "No preference" → pick slot → confirm
6. Booking confirmed, mock SMS shown on messages page

## Staff Selection
- Customer sees staff list + "No preference" option
- If staff chosen: show that person's slots
- If "No preference": show union of all slots, auto-assign least-busy staff at booking time

## Admin Panel
- Route: `/admin` — protected by checking `auth.email === ADMIN_EMAIL` env var
- Uses service role key server-side (bypasses RLS) to read any business's data
- Read-only for MVP
- Can manually update business subscription status (plan, status, trial_ends_at)

## Business Subscription Tracking (Manual, No Stripe)
- Fields on `businesses` table: `plan` (free/starter/pro), `sub_status` (trial/active/past_due/cancelled), `trial_ends_at`
- Admin updates these manually via admin panel

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAIL=mariokrstevski@hotmail.com
```

## Current Phase
**Phase 1 — F01** in progress. See build-order.md.
