import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/sendSMS'
import { z } from 'zod'

const schema = z.object({ appointmentId: z.string().uuid() })

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()

  const { data: appt } = await admin
    .from('appointments')
    .select('id, business_id, start_time, customers(name, phone_number), services(name), businesses(name)')
    .eq('id', parsed.data.appointmentId)
    .single()

  if (!appt) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.appointmentId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const customer = appt.customers as any
  const dt = new Date(appt.start_time).toLocaleString('en-IE', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  try {
    await sendSMS({
      businessId: appt.business_id,
      phone: customer?.phone_number ?? '',
      type: 'cancellation',
      vars: {
        name: customer?.name ?? 'there',
        business: (appt.businesses as any)?.name ?? '',
        datetime: dt,
      },
    })
  } catch {
    // SMS logging must not affect cancellation response
  }

  return Response.json({ ok: true })
}
