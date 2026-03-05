# Termino – Code Conventions & Architecture Patterns

## Supabase Client Usage

| Context | File | Usage |
|---|---|---|
| Server Components / Route Handlers | `lib/supabase/server.ts` | `createServerClient` with cookies |
| Client Components | `lib/supabase/client.ts` | `createBrowserClient` |
| Admin / service role | `lib/supabase/admin.ts` | `createClient` with SERVICE_ROLE key — server-only |

Never import `admin.ts` in client components or files that could run in browser.

## Folder Structure

```
app/
  (auth)/
    login/page.tsx
    verify/page.tsx
  (public)/
    book/[slug]/page.tsx
    book/[slug]/success/page.tsx
  (dashboard)/
    onboarding/page.tsx
    dashboard/
      layout.tsx
      page.tsx
      calendar/page.tsx
      services/page.tsx
      staff/page.tsx
      customers/page.tsx
      revenue/page.tsx
      messages/page.tsx     <-- OTP codes + mock SMS log viewer
      settings/page.tsx
  (admin)/
    admin/
      layout.tsx
      page.tsx              <-- businesses list
      businesses/[id]/page.tsx  <-- read-only business view
  api/
    booking/create/route.ts
    booking/cancel/route.ts
    booking/reschedule/route.ts
    stripe/webhook/route.ts   # future
    cron/reminders/route.ts
    cron/no-show/route.ts
    cron/review-request/route.ts

lib/
  supabase/
    client.ts
    server.ts
    admin.ts
  booking/
    getAvailableSlots.ts
  sms/
    sendSMS.ts      <-- mock only, writes to sms_logs
    templates.ts
  revenue/
    (queries live in DB views, not here)
```

## API Route Handlers

- Always validate input with zod before any DB operation
- Always return `{ error: string }` with appropriate HTTP status on failure
- Never catch errors silently — log them
- Booking endpoint: apply rate limiting

Example pattern:
```ts
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })
  // ...
}
```

## business_id Safety Rule

Never trust client-provided business_id. Always derive from session:

```ts
const { data: { user } } = await supabase.auth.getUser()
const { data: business } = await supabase
  .from('businesses')
  .select('id')
  .eq('owner_id', user.id)
  .single()
const business_id = business.id
```

## Booking Engine

- Slot generation: `lib/booking/getAvailableSlots.ts`
  - Per-staff mode: show slots for a specific staff member
  - Any-staff mode: union of all staff slots, auto-assign least-busy at booking time
- Appointment creation ALWAYS goes through Supabase RPC `create_appointment`
- Never insert to `appointments` table directly from route handlers
- Overlap check + insert is atomic inside the RPC function

## Customer Booking (No Account Required)

- Customer identified by (business_id, phone_number) — upserted in `customers` table
- OTP is mock: generate 4-digit code, write to `sms_logs` with type `otp`, display on messages page
- After OTP verified, store phone in session/cookie for duration of booking flow
- Returning customer: look up last appointment by customer_id, offer to repeat

## SMS (Mock — No External Provider)

- All SMS goes through `lib/sms/sendSMS.ts`
- `sendSMS` does NOT call any provider — writes to `sms_logs` with `status: 'mock'`
- The messages page reads `sms_logs` to display what would have been sent
- When switching to real SMS later, only `lib/sms/sendSMS.ts` needs to change
- Template types: `otp` | `booking_confirmation` | `reminder_24h` | `reminder_2h` | `review_request` | `cancellation`

## Admin Panel

- Protected by: `session.user.email === process.env.ADMIN_EMAIL`
- Check happens in middleware — redirect to /login if not admin
- All data fetches use `lib/supabase/admin.ts` (service role) — bypasses RLS
- Read-only: no mutations except subscription status updates

## Auth + Middleware

`middleware.ts` protects:
- `/dashboard/*` — must be logged in + have a business
- `/admin/*` — must be logged in + email matches ADMIN_EMAIL

Flow after login:
1. Check if business exists for user
2. If not → redirect to `/onboarding`
3. If yes → redirect to `/dashboard`

## Performance Rules

- Use Server Components for all dashboard pages (no client-fetch waterfalls)
- Use date range filters on all appointment queries — never fetch full table
- Paginate customer list (default page size: 50)
- Revenue data: always query views, never compute in code
- Target <200ms for booking availability query

## Multi-Vertical Pattern

```ts
if (business.business_type === 'barber') { ... }
if (business.business_type === 'nail') { ... }
```

Never hardcode vertical logic into the core booking engine. Core engine is universal.

## Environment Variables

Always access via `process.env.VAR_NAME` on server.
Only `NEXT_PUBLIC_*` vars are safe for client components.
Client-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `STRIPE_SECRET_KEY` (future)
