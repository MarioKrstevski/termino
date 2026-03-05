import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/sendSMS'
import { z } from 'zod'

// In-memory OTP store (MVP only — fine for single-server dev/demo)
// In production, store in DB or Redis with expiry
const otpStore = new Map<string, { code: string; expires: number }>()

const sendSchema = z.object({
  phone: z.string().min(5),
  slug: z.string(),
})

const verifySchema = z.object({
  phone: z.string().min(5),
  code: z.string().length(4),
  slug: z.string(),
})

export async function POST(req: Request) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? 'send'
  const body = await req.json()

  if (action === 'send') {
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })

    const { phone, slug } = parsed.data
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const key = `${slug}:${phone}`
    otpStore.set(key, { code, expires: Date.now() + 10 * 60 * 1000 }) // 10min expiry

    const admin = createAdminClient()
    const { data: business } = await admin.from('businesses').select('id, name').eq('slug', slug).single()

    await sendSMS({
      businessId: business?.id ?? null,
      phone,
      type: 'otp',
      vars: { code },
    })

    return Response.json({ ok: true })
  }

  if (action === 'verify') {
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })

    const { phone, code, slug } = parsed.data
    const key = `${slug}:${phone}`
    const stored = otpStore.get(key)

    if (!stored || stored.code !== code) {
      return Response.json({ error: 'Invalid code' }, { status: 400 })
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(key)
      return Response.json({ error: 'Code expired' }, { status: 400 })
    }

    otpStore.delete(key)

    // Check if returning customer
    const admin = createAdminClient()
    const { data: business } = await admin.from('businesses').select('id').eq('slug', slug).single()

    if (!business) return Response.json({ verified: true, returning: false })

    const { data: customer } = await admin
      .from('customers')
      .select('id, name, total_visits')
      .eq('business_id', business.id)
      .eq('phone_number', phone)
      .maybeSingle()

    if (customer && customer.total_visits > 0) {
      const { data: lastAppt } = await admin
        .from('appointments')
        .select('service_id, services(id, name, duration_minutes, price)')
        .eq('business_id', business.id)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return Response.json({
        verified: true,
        returning: true,
        customerName: customer.name,
        lastService: lastAppt ? (lastAppt.services as any) : null,
      })
    }

    return Response.json({ verified: true, returning: false, customerName: customer?.name ?? null })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
