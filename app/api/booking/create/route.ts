import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/sendSMS'
import { z } from 'zod'

const schema = z.object({
  slug: z.string(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  customerPhone: z.string().min(5),
  customerName: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })

  const { slug, serviceId, staffId, startTime, endTime, customerPhone, customerName } = parsed.data
  const admin = createAdminClient()

  // Resolve business
  const { data: business } = await admin
    .from('businesses')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  // Upsert customer
  const { data: customer } = await admin
    .from('customers')
    .upsert(
      { business_id: business.id, phone_number: customerPhone, name: customerName },
      { onConflict: 'business_id,phone_number', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (!customer) return Response.json({ error: 'Failed to create customer' }, { status: 500 })

  // Get service name for SMS
  const { data: service } = await admin
    .from('services')
    .select('name')
    .eq('id', serviceId)
    .single()

  // Atomic booking via RPC
  const { data: appointment, error } = await admin.rpc('create_appointment', {
    p_business_id: business.id,
    p_service_id: serviceId,
    p_staff_id: staffId,
    p_customer_id: customer.id,
    p_start_time: startTime,
    p_end_time: endTime,
    p_source: 'web',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 409 })
  }

  // Increment total_visits
  try {
    await admin.rpc('increment_customer_visits', { p_customer_id: customer.id })
  } catch {
    // Non-critical, ignore if function doesn't exist yet
  }

  // Mock SMS confirmation (fire-and-forget; never block response)
  try {
    const dt = new Date(startTime).toLocaleString('en-IE', {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    await sendSMS({
      businessId: business.id,
      phone: customerPhone,
      type: 'booking_confirmation',
      vars: {
        name: customerName,
        service: service?.name ?? 'appointment',
        business: business.name,
        datetime: dt,
      },
    })
  } catch {
    // SMS logging must not affect booking success
  }

  return Response.json({ appointment })
}
