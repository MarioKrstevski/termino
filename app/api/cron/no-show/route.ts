import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: pastBooked } = await admin
    .from('appointments')
    .select('id, customer_id')
    .eq('status', 'booked')
    .lt('end_time', now)

  if (!pastBooked?.length) {
    return Response.json({ ok: true, marked: 0 })
  }

  let marked = 0
  const countByCustomer: Record<string, number> = {}

  for (const appt of pastBooked) {
    const { error: updateError } = await admin
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appt.id)

    if (updateError) continue
    marked += 1
    countByCustomer[appt.customer_id] = (countByCustomer[appt.customer_id] ?? 0) + 1
  }

  for (const [customerId, add] of Object.entries(countByCustomer)) {
    const { data: row } = await admin
      .from('customers')
      .select('no_show_count')
      .eq('id', customerId)
      .single()
    const current = (row?.no_show_count as number) ?? 0
    await admin
      .from('customers')
      .update({ no_show_count: current + add })
      .eq('id', customerId)
  }

  return Response.json({ ok: true, marked })
}
