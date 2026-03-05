import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, DollarSign, TrendingUp, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, business_type, sub_status, plan')
    .eq('owner_id', user!.id)
    .single()

  if (!business) redirect('/onboarding')

  const businessId = business.id
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const todayStart = `${todayStr}T00:00:00.000Z`
  const todayEnd = `${todayStr}T23:59:59.999Z`

  const [
    { data: todayAppts },
    { data: upcomingAppts },
    { data: customerCount },
    { data: revenueToday },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, start_time, end_time, status, customers(name), services(name), staff(name)')
      .eq('business_id', businessId)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .order('start_time'),
    supabase
      .from('appointments')
      .select('id, start_time, status, customers(name), services(name)')
      .eq('business_id', businessId)
      .eq('status', 'booked')
      .gt('start_time', todayEnd)
      .order('start_time')
      .limit(5),
    supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId),
    supabase
      .from('payments')
      .select('amount, tip')
      .eq('business_id', businessId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
  ])

  const todayRevenue = (revenueToday ?? []).reduce((sum, p) => sum + Number(p.amount) + Number(p.tip ?? 0), 0)
  const bookedToday = (todayAppts ?? []).filter(a => a.status === 'booked').length
  const completedToday = (todayAppts ?? []).filter(a => a.status === 'completed').length

  const stats = [
    { label: "Today's appointments", value: todayAppts?.length ?? 0, icon: Calendar, sub: `${completedToday} completed` },
    { label: "Today's revenue", value: `€${todayRevenue.toFixed(2)}`, icon: DollarSign, sub: `${completedToday} paid` },
    { label: 'Total customers', value: customerCount?.length ?? 0, icon: Users, sub: 'All time' },
    { label: 'Upcoming (next 5)', value: upcomingAppts?.length ?? 0, icon: TrendingUp, sub: 'Booked' },
  ]

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{today.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Badge variant={business.sub_status === 'active' ? 'default' : 'secondary'} className="capitalize">
          {business.plan} · {business.sub_status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Today's schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!todayAppts?.length ? (
              <p className="text-muted-foreground text-sm">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{(a.customers as any)?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{(a.services as any)?.name} · {(a.staff as any)?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{fmt(a.start_time)}</p>
                      <Badge variant={
                        a.status === 'completed' ? 'default' :
                        a.status === 'cancelled' ? 'destructive' :
                        a.status === 'no_show' ? 'destructive' : 'secondary'
                      } className="text-xs capitalize">{a.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingAppts?.length ? (
              <p className="text-muted-foreground text-sm">No upcoming bookings.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{(a.customers as any)?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{(a.services as any)?.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(a.start_time).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })} · {fmt(a.start_time)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Public booking link:{' '}
            <span className="font-mono text-foreground">/book/{business.slug}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
