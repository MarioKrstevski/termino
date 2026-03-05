import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  appointmentId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 })

  const { appointmentId, startTime, endTime } = parsed.data
  const admin = createAdminClient()

  const { data: appt } = await admin
    .from('appointments')
    .select('id, staff_id, business_id, status')
    .eq('id', appointmentId)
    .single()

  if (!appt) return Response.json({ error: 'Not found' }, { status: 404 })
  if (appt.status !== 'booked') {
    return Response.json({ error: 'Only booked appointments can be rescheduled' }, { status: 409 })
  }

  // Check for overlapping appointments for this staff (excluding this one)
  const { data: overlapping } = await admin
    .from('appointments')
    .select('id')
    .eq('staff_id', appt.staff_id)
    .eq('business_id', appt.business_id)
    .neq('id', appointmentId)
    .in('status', ['booked'])
    .lt('start_time', endTime)
    .gt('end_time', startTime)

  if (overlapping?.length) {
    return Response.json({ error: 'Time slot is no longer available' }, { status: 409 })
  }

  const { error } = await admin
    .from('appointments')
    .update({ start_time: startTime, end_time: endTime })
    .eq('id', appointmentId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
