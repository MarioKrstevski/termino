'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, ToggleLeft, ToggleRight, User } from 'lucide-react'
import { toast } from 'sonner'

type Staff = { id: string; name: string; active: boolean }

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [businessId, setBusinessId] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()
    if (!biz) return
    setBusinessId(biz.id)
    const { data } = await supabase.from('staff').select('*').eq('business_id', biz.id).order('name')
    setStaff(data ?? [])
  }

  function openNew() { setEditing(null); setName(''); setOpen(true) }
  function openEdit(s: Staff) { setEditing(s); setName(s.name); setOpen(true) }

  async function handleSave() {
    setLoading(true)
    if (editing) {
      const { error } = await supabase.from('staff').update({ name }).eq('id', editing.id)
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Staff updated')
    } else {
      const { error } = await supabase.from('staff').insert({ name, business_id: businessId, active: true })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Staff member added')
    }
    setOpen(false)
    setLoading(false)
    load()
  }

  async function toggleActive(s: Staff) {
    await supabase.from('staff').update({ active: !s.active }).eq('id', s.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit staff member' : 'New staff member'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Marco" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={loading || !name} className="flex-1">
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {staff.length === 0 && (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No staff yet. Add your first team member.</CardContent></Card>
        )}
        {staff.map(s => (
          <Card key={s.id} className={!s.active ? 'opacity-60' : ''}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  {!s.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                </div>
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
