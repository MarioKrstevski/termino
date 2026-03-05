import { getAvailableSlots } from '@/lib/booking/getAvailableSlots'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  slug: z.string(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.string().uuid().optional(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = schema.safeParse({
    slug: url.searchParams.get('slug'),
    serviceId: url.searchParams.get('serviceId'),
    date: url.searchParams.get('date'),
    staffId: url.searchParams.get('staffId') ?? undefined,
  })

  if (!parsed.success) {
    return Response.json({ error: 'Invalid params' }, { status: 400 })
  }

  const { slug, serviceId, date, staffId } = parsed.data
  const admin = createAdminClient()

  const { data: business } = await admin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

  const slots = await getAvailableSlots({
    businessId: business.id,
    serviceId,
    date,
    staffId,
  })

  return Response.json({ slots })
}
