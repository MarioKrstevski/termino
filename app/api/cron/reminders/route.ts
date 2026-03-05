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

  const window24hStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
  const window24hEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)
  const window2hStart = new Date(now.getTime() + 1.75 * 60 * 60 * 1000)
  const window2hEnd = new Date(now.getTime() + 2.25 * 60 * 60 * 1000)

  const { data: appointments24h } = await admin
    .from('appointments')
    .select(`
      id,
      business_id,
      start_time,
      businesses(name),
      services(name),
      customers(phone_number, name)
    `)
    .eq('status', 'booked')
    .gte('start_time', window24hStart.toISOString())
    .lte('start_time', window24hEnd.toISOString())

  const { data: appointments2h } = await admin
    .from('appointments')
    .select(`
      id,
      business_id,
      start_time,
      businesses(name),
      services(name),
      customers(phone_number, name)
    `)
    .eq('status', 'booked')
    .gte('start_time', window2hStart.toISOString())
    .lte('start_time', window2hEnd.toISOString())

  const sent: { reminder_24h: number; reminder_2h: number } = { reminder_24h: 0, reminder_2h: 0 }

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })

  for (const a of appointments24h ?? []) {
    const { data: existing } = await admin
      .from('sms_logs')
      .select('id')
      .eq('appointment_id', a.id)
      .eq('message_type', 'reminder_24h')
      .limit(1)
      .maybeSingle()

    if (existing) continue

    const business = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses
    const service = Array.isArray(a.services) ? a.services[0] : a.services
    const customer = Array.isArray(a.customers) ? a.customers[0] : a.customers
    if (!customer?.phone_number) continue

    try {
      await sendSMS({
        businessId: a.business_id,
        phone: customer.phone_number,
        type: 'reminder_24h',
        appointmentId: a.id,
        vars: {
          name: (customer as { name?: string })?.name ?? 'there',
          service: (service as { name?: string })?.name ?? 'appointment',
          business: (business as { name?: string })?.name ?? 'us',
          time: formatTime(a.start_time),
        },
      })
      sent.reminder_24h += 1
    } catch {
      // continue with next
    }
  }

  for (const a of appointments2h ?? []) {
    const { data: existing } = await admin
      .from('sms_logs')
      .select('id')
      .eq('appointment_id', a.id)
      .eq('message_type', 'reminder_2h')
      .limit(1)
      .maybeSingle()

    if (existing) continue

    const business = Array.isArray(a.businesses) ? a.businesses[0] : a.businesses
    const service = Array.isArray(a.services) ? a.services[0] : a.services
    const customer = Array.isArray(a.customers) ? a.customers[0] : a.customers
    if (!customer?.phone_number) continue

    try {
      await sendSMS({
        businessId: a.business_id,
        phone: customer.phone_number,
        type: 'reminder_2h',
        appointmentId: a.id,
        vars: {
          name: (customer as { name?: string })?.name ?? 'there',
          service: (service as { name?: string })?.name ?? 'appointment',
          business: (business as { name?: string })?.name ?? 'us',
          time: formatTime(a.start_time),
        },
      })
      sent.reminder_2h += 1
    } catch {
      // continue with next
    }
  }

  return Response.json({ ok: true, sent })
}
