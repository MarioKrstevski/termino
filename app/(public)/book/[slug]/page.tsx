import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { BookingFlow } from '@/components/booking/booking-flow'

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, slug, business_type, address')
    .eq('slug', slug)
    .single()

  if (!business) notFound()

  const { data: services } = await admin
    .from('services')
    .select('id, name, duration_minutes, price, buffer_minutes')
    .eq('business_id', business.id)
    .eq('active', true)
    .order('name')

  const { data: staff } = await admin
    .from('staff')
    .select('id, name')
    .eq('business_id', business.id)
    .eq('active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">{business.name}</h1>
          {business.address && <p className="text-muted-foreground text-sm mt-1">{business.address}</p>}
        </div>
        <BookingFlow
          business={business}
          services={services ?? []}
          staff={staff ?? []}
        />
      </div>
    </div>
  )
}
