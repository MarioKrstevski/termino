import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/sendSMS'

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
  const now = new Date()
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const { data: completed } = await admin
    .from('appointments')
    .select(`
      id,
      business_id,
      businesses(name),
      customers(phone_number, name)
    `)
    .eq('status', 'completed')
    .gte('end_time', since.toISOString())

  if (!completed?.length) {
    return Response.json({ ok: true, sent: 0 })
  }

  const ids = completed.map(a => a.id)
  const { data: alreadySent } = await admin
    .from('sms_logs')
    .select('appointment_id')
    .in('appointment_id', ids)
    .eq('message_type', 'review_request')

  const sentAppointmentIds = new Set((alreadySent ?? []).map((r: { appointment_id: string }) => r.appointment_id))
  const toSend = completed.filter(a => !sentAppointmentIds.has(a.id))

  let sent = 0
  for (const a of toSend) {
    const business = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses
    const customer = Array.isArray(a.customers) ? a.customers[0] : a.customers
    if (!(customer as { phone_number?: string })?.phone_number) continue

    try {
      await sendSMS({
        businessId: a.business_id,
        phone: (customer as { phone_number: string }).phone_number,
        type: 'review_request',
        appointmentId: a.id,
        vars: {
          name: (customer as { name?: string })?.name ?? 'there',
          business: (business as { name?: string })?.name ?? 'us',
        },
      })
      sent += 1
    } catch {
      // continue with next
    }
  }

  return Response.json({ ok: true, sent })
}
