import { createAdminClient } from '@/lib/supabase/admin'

type WorkingHours = {
  [day: string]: { open: string; close: string } | null
}

export type Slot = {
  start: string // ISO
  end: string   // ISO
  staff_id: string
  staff_name: string
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

export async function getAvailableSlots({
  businessId,
  serviceId,
  date,
  staffId,
}: {
  businessId: string
  serviceId: string
  date: string // YYYY-MM-DD
  staffId?: string // if undefined, return slots for all active staff
}): Promise<Slot[]> {
  const admin = createAdminClient()
  const dateObj = new Date(date + 'T00:00:00')
  const dayKey = DAYS[dateObj.getDay()]

  // Fetch business working hours
  const { data: business } = await admin
    .from('businesses')
    .select('working_hours_json')
    .eq('id', businessId)
    .single()

  if (!business) return []
  const hours = business.working_hours_json as WorkingHours
  const dayHours = hours[dayKey]
  if (!dayHours) return [] // closed

  // Fetch service
  const { data: service } = await admin
    .from('services')
    .select('duration_minutes, buffer_minutes')
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .single()

  if (!service) return []
  const slotDuration = service.duration_minutes + service.buffer_minutes

  // Fetch staff
  const staffQuery = admin
    .from('staff')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('active', true)

  if (staffId) staffQuery.eq('id', staffId)

  const { data: staffList } = await staffQuery
  if (!staffList?.length) return []

  const staffIds = staffList.map(s => s.id)

  // Fetch existing appointments for the day
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const { data: existingAppts } = await admin
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('business_id', businessId)
    .in('staff_id', staffIds)
    .not('status', 'in', '("cancelled","no_show")')
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)

  const openTime = parseTime(dateObj, dayHours.open)
  const closeTime = parseTime(dateObj, dayHours.close)
  const slots: Slot[] = []

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const isToday = date === todayStr

  for (const staffMember of staffList) {
    const bookedForStaff = (existingAppts ?? [])
      .filter(a => a.staff_id === staffMember.id)
      .map(a => ({
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
      }))

    let cursor = new Date(openTime)

    // For today: fast-forward to the next 30-min boundary after now
    if (isToday && cursor < now) {
      const ms30 = 30 * 60 * 1000
      cursor = new Date(Math.ceil(now.getTime() / ms30) * ms30)
    }

    while (true) {
      const slotEnd = new Date(cursor.getTime() + slotDuration * 60 * 1000)
      if (slotEnd > closeTime) break

      const slotStartMs = cursor.getTime()
      const slotEndMs = slotEnd.getTime()

      const overlaps = bookedForStaff.some(
        b => slotStartMs < b.end && slotEndMs > b.start
      )

      if (!overlaps) {
        slots.push({
          start: cursor.toISOString(),
          end: new Date(cursor.getTime() + service.duration_minutes * 60 * 1000).toISOString(),
          staff_id: staffMember.id,
          staff_name: staffMember.name,
        })
      }

      cursor = new Date(cursor.getTime() + 30 * 60 * 1000) // 30min increments
    }
  }

  return slots
}
