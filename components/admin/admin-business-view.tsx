'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

type Business = {
  id: string
  name: string
  slug: string
  business_type: string
  plan: string
  sub_status: string
  profiles?: { email: string } | null
}

type Staff = { id: string; name: string; active: boolean }
type Service = { id: string; name: string; price: number }
type RecentAppt = {
  id: string
  start_time: string
  status: string
  customers: { name: string } | null
  services: { name: string } | null
}

interface Props {
  business: Business
  staff: Staff[]
  services: Service[]
  recentAppts: RecentAppt[]
}

export function AdminBusinessView ({ business, staff, services, recentAppts }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState(business.plan)
  const [subStatus, setSubStatus] = useState(business.sub_status)
  const [saving, setSaving] = useState(false)

  async function saveSub () {
    setSaving(true)
    const res = await fetch(`/api/admin/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, sub_status: subStatus }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to update')
      return
    }
    toast.success('Subscription updated')
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="text-muted-foreground text-sm">
            {(business.profiles as { email?: string })?.email ?? '–'} · {business.business_type} · /book/{business.slug}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Staff</p><p className="text-2xl font-bold">{staff.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Services</p><p className="text-2xl font-bold">{services.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Recent appointments</p><p className="text-2xl font-bold">{recentAppts.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Plan</p>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Status</p>
              <Select value={subStatus} onValueChange={setSubStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveSub} disabled={saving} size="sm">
            {saving ? 'Saving...' : 'Update subscription'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Staff</CardTitle></CardHeader>
          <CardContent>
            {staff.map(s => (
              <div key={s.id} className="flex justify-between py-2 border-b border-border last:border-0">
                <p className="text-sm">{s.name}</p>
                <Badge variant={s.active ? 'default' : 'secondary'} className="text-xs">{s.active ? 'Active' : 'Off'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Services</CardTitle></CardHeader>
          <CardContent>
            {services.map(s => (
              <div key={s.id} className="flex justify-between py-2 border-b border-border last:border-0">
                <p className="text-sm">{s.name}</p>
                <p className="text-sm font-medium">€{Number(s.price).toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent appointments</CardTitle></CardHeader>
        <CardContent>
          {!recentAppts.length ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            recentAppts.map(a => (
              <div key={a.id} className="flex justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{(a.customers as { name?: string })?.name ?? '–'}</p>
                  <p className="text-xs text-muted-foreground">{(a.services as { name?: string })?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs">{fmt(a.start_time)}</p>
                  <Badge variant="outline" className="text-xs capitalize">{a.status.replace('_', ' ')}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
