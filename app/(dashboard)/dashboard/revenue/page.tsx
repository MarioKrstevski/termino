import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Users, Scissors } from 'lucide-react'

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()
  const admin = createAdminClient()
  const bId = business!.id

  const [
    { data: daily },
    { data: byStaff },
    { data: byService },
    { data: totalRow },
  ] = await Promise.all([
    admin.from('daily_revenue').select('*').eq('business_id', bId).order('date', { ascending: false }).limit(30),
    admin.from('revenue_by_staff').select('*, staff(name)').eq('business_id', bId),
    admin.from('revenue_by_service').select('*, services(name)').eq('business_id', bId),
    admin.from('business_total_revenue').select('total').eq('business_id', bId).maybeSingle(),
  ])

  const totalRevenue = Number(totalRow?.total ?? 0)
  const last7 = (daily ?? []).slice(0, 7).reduce((s, d) => s + Number(d.total), 0)
  const last30 = (daily ?? []).reduce((s, d) => s + Number(d.total), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Revenue</h1>
        <p className="text-muted-foreground">All revenue data from recorded payments</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total all-time', value: totalRevenue, icon: DollarSign },
          { label: 'Last 7 days', value: last7, icon: TrendingUp },
          { label: 'Last 30 days', value: last30, icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1">€{value.toFixed(2)}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />Revenue by staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!byStaff?.length ? (
              <p className="text-muted-foreground text-sm">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {byStaff.map(row => (
                  <div key={row.staff_id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <p className="font-medium">{(row.staff as any)?.name ?? 'Unknown'}</p>
                    <p className="font-semibold">€{Number(row.total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />Revenue by service
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!byService?.length ? (
              <p className="text-muted-foreground text-sm">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {byService.map(row => (
                  <div key={row.service_id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <p className="font-medium">{(row.services as any)?.name ?? 'Unknown'}</p>
                    <p className="font-semibold">€{Number(row.total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily revenue (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {!daily?.length ? (
            <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {daily.map(row => (
                <div key={row.date} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <p className="text-sm">{new Date(row.date).toLocaleDateString('en-IE', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <p className="font-semibold text-sm">€{Number(row.total).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
