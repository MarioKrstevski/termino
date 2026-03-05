'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Phone, Calendar, StickyNote, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [customer, setCustomer] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()
    if (!biz) return
    setBusinessId(biz.id)

    const { data: c } = await supabase.from('customers').select('*').eq('id', id).single()
    setCustomer(c)

    const { data: apts } = await supabase
      .from('appointments')
      .select('id, start_time, status, services(name), staff(name), payments(amount, tip)')
      .eq('customer_id', id)
      .eq('business_id', biz.id)
      .order('start_time', { ascending: false })
      .limit(20)
    setAppointments(apts ?? [])

    const { data: n } = await supabase
      .from('notes')
      .select('id, content, created_at, staff(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    setNotes(n ?? [])
  }

  async function addNote() {
    if (!newNote.trim()) return
    setLoading(true)
    await supabase.from('notes').insert({ business_id: businessId, customer_id: id, content: newNote.trim() })
    setNewNote('')
    setLoading(false)
    toast.success('Note added')
    load()
  }

  if (!customer) return <div className="text-muted-foreground p-8">Loading...</div>

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.name ?? 'Unknown'}</h1>
          <p className="text-muted-foreground flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{customer.phone_number}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Visits</p><p className="text-2xl font-bold">{customer.total_visits}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No-shows</p><p className="text-2xl font-bold text-orange-600">{customer.no_show_count}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Since</p><p className="text-sm font-medium mt-1">{fmt(customer.created_at)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" />Appointment history</CardTitle></CardHeader>
        <CardContent>
          {!appointments.length ? (
            <p className="text-muted-foreground text-sm">No appointments yet.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map(a => {
                const paid = a.payments?.[0]
                return (
                  <div key={a.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{(a.services as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{(a.staff as any)?.name} · {fmt(a.start_time)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs capitalize">{a.status.replace('_', ' ')}</Badge>
                      {paid && <p className="text-xs text-muted-foreground mt-1">€{(Number(paid.amount) + Number(paid.tip ?? 0)).toFixed(2)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" />Notes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note about this customer..."
              rows={2}
              className="flex-1"
            />
            <Button onClick={addNote} disabled={loading || !newNote.trim()} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {!notes.length ? (
            <p className="text-muted-foreground text-sm">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="bg-muted/50 rounded-md p-3">
                  <p className="text-sm">{n.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(n.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
