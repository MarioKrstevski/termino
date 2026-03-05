import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { AdminBusinessView } from '@/components/admin/admin-business-view'

export default async function AdminBusinessPage ({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, slug, business_type, plan, sub_status, profiles(email)')
    .eq('id', id)
    .single()

  if (!business) notFound()

  // Supabase returns relation as array; normalize to single object for the view
  const businessForView = {
    ...business,
    profiles: Array.isArray(business.profiles) ? business.profiles[0] ?? null : business.profiles,
  }

  const [
    { data: staff },
    { data: services },
    { data: recentAppts },
  ] = await Promise.all([
    admin.from('staff').select('id, name, active').eq('business_id', id).order('name'),
    admin.from('services').select('id, name, price, active').eq('business_id', id).order('name'),
    admin
      .from('appointments')
      .select('id, start_time, status, customers(name), services(name)')
      .eq('business_id', id)
      .order('start_time', { ascending: false })
      .limit(10),
  ])

  const normalizedAppts = (recentAppts ?? []).map(a => ({
    ...a,
    customers: Array.isArray(a.customers) ? a.customers[0] ?? null : a.customers,
    services: Array.isArray(a.services) ? a.services[0] ?? null : a.services,
  }))

  return (
    <AdminBusinessView
      business={businessForView}
      staff={staff ?? []}
      services={services ?? []}
      recentAppts={normalizedAppts}
    />
  )
}
