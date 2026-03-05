'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

type Hours = Record<string, { open: string; close: string } | null>

export default function SettingsPage() {
  const [businessId, setBusinessId] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState<Hours>({})
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', user!.id).single()
    if (!biz) return
    setBusinessId(biz.id)
    setName(biz.name)
    setAddress(biz.address ?? '')
    setHours(biz.working_hours_json ?? {})
  }

  function toggleDay(key: string) {
    setHours(h => ({
      ...h,
      [key]: h[key] ? null : { open: '09:00', close: '18:00' },
    }))
  }

  function setDayHour(key: string, field: 'open' | 'close', val: string) {
    setHours(h => ({
      ...h,
      [key]: h[key] ? { ...(h[key] as any), [field]: val } : null,
    }))
  }

  async function handleSave() {
    setLoading(true)
    const { error } = await supabase.from('businesses').update({
      name, address, working_hours_json: hours
    }).eq('id', businessId)

    if (error) toast.error(error.message)
    else toast.success('Settings saved')
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Update your business details</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Business info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Working hours</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const day = hours[key]
            return (
              <div key={key} className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`w-24 text-sm font-medium text-left ${day ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                >
                  {label}
                </button>
                {day ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.open}
                      onChange={e => setDayHour(key, 'open', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      value={day.close}
                      onChange={e => setDayHour(key, 'close', e.target.value)}
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )
}
