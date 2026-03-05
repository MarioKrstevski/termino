'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'

type Service = {
  id: string; name: string; duration_minutes: number;
  price: number; buffer_minutes: number; active: boolean
}

const empty = { name: '', duration_minutes: 30, price: 0, buffer_minutes: 5 }

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [businessId, setBusinessId] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()
    if (!biz) return
    setBusinessId(biz.id)
    const { data } = await supabase.from('services').select('*').eq('business_id', biz.id).order('name')
    setServices(data ?? [])
  }

  function openNew() { setEditing(null); setForm(empty); setOpen(true) }
  function openEdit(s: Service) { setEditing(s); setForm({ name: s.name, duration_minutes: s.duration_minutes, price: s.price, buffer_minutes: s.buffer_minutes }); setOpen(true) }

  async function handleSave() {
    setLoading(true)
    if (editing) {
      const { error } = await supabase.from('services').update(form).eq('id', editing.id)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Service updated')
    } else {
      const { error } = await supabase.from('services').insert({ ...form, business_id: businessId, active: true })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Service created')
    }
    setOpen(false)
    setLoading(false)
    load()
  }

  async function toggleActive(s: Service) {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage what you offer and pricing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit service' : 'New service'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Haircut" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: +e.target.value }))} min={5} step={5} />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (€)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} min={0} step={0.5} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Buffer time after (min)</Label>
                <Input type="number" value={form.buffer_minutes} onChange={e => setForm(f => ({ ...f, buffer_minutes: +e.target.value }))} min={0} step={5} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={loading || !form.name} className="flex-1">
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {services.length === 0 && (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No services yet. Add your first one.</CardContent></Card>
        )}
        {services.map(s => (
          <Card key={s.id} className={!s.active ? 'opacity-60' : ''}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{s.name}</p>
                  {!s.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.duration_minutes} min · €{Number(s.price).toFixed(2)}
                  {s.buffer_minutes > 0 && ` · +${s.buffer_minutes}min buffer`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => toggleActive(s)}>
                  {s.active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
