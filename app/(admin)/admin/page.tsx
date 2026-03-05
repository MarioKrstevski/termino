import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'

const statusColors: Record<string, string> = {
  trial: 'bg-blue-500/10 text-blue-700',
  active: 'bg-green-500/10 text-green-700',
  past_due: 'bg-orange-500/10 text-orange-700',
  cancelled: 'bg-red-500/10 text-red-700',
}

export default async function AdminPage() {
  const admin = createAdminClient()

  const { data: businesses } = await admin
    .from('businesses')
    .select('id, name, slug, business_type, plan, sub_status, trial_ends_at, created_at, profiles(email)')
    .order('created_at', { ascending: false })

  // Get appointment counts per business
  const apptCounts: Record<string, number> = {}
  if (businesses?.length) {
    const ids = businesses.map(b => b.id)
    const { data: counts } = await admin
      .from('appointments')
      .select('business_id')
      .in('business_id', ids)

    for (const row of counts ?? []) {
      apptCounts[row.business_id] = (apptCounts[row.business_id] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Businesses</h1>
        <p className="text-muted-foreground">{businesses?.length ?? 0} registered</p>
      </div>

      {!businesses?.length ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No businesses yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {businesses.map(b => (
            <Link key={b.id} href={`/admin/businesses/${b.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(b.profiles as any)?.email} · {b.business_type} · /book/{b.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-2 justify-end">
                        <Badge className={`text-xs capitalize ${statusColors[b.sub_status] ?? ''}`} variant="secondary">
                          {b.plan} · {b.sub_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{apptCounts[b.id] ?? 0} appointments</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
