'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

type Appointment = {
  id: string; start_time: string; end_time: string; status: string; source: string
  customers: { name: string; phone_number: string } | null
  services: { name: string; price: number } | null
  staff: { name: string } | null
}

const statusColors: Record<string, string> = {
  booked: 'bg-blue-500/10 text-blue-600 border-blue-200',
  completed: 'bg-green-500/10 text-green-600 border-green-200',
  cancelled: 'bg-red-500/10 text-red-600 border-red-200',
  no_show: 'bg-orange-500/10 text-orange-600 border-orange-200',
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [businessId, setBusinessId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [payDialog, setPayDialog] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payTip, setPayTip] = useState('0')
  const [payMethod, setPayMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [selectedDate])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user!.id).single()
    if (!biz) return
    setBusinessId(biz.id)

    const start = `${selectedDate}T00:00:00.000Z`
    const end = `${selectedDate}T23:59:59.999Z`

    const { data } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status, source, customers(name, phone_number), services(name, price), staff(name)')
      .eq('business_id', biz.id)
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time')

    setAppointments((data ?? []) as any)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    toast.success(`Marked as ${status}`)
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : null)
    load()
  }

  async function recordPayment() {
    if (!selected) return
    setLoading(true)
    const { error } = await supabase.from('payments').insert({
      business_id: businessId,
      appointment_id: selected.id,
      amount: parseFloat(payAmount),
      tip: parseFloat(payTip),
      payment_method: payMethod,
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    await updateStatus(selected.id, 'completed')
    setPayDialog(false)
    setLoading(false)
    toast.success('Payment recorded')
  }

  function offsetDate(n: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + n)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => offsetDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
          <Button variant="outline" size="icon" onClick={() => offsetDate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>Today</Button>
        </div>
      </div>

      <p className="text-muted-foreground">{displayDate} · {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</p>

      {appointments.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No appointments on this day.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {appointments.map(a => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelected(a)}
            >
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="font-semibold text-sm">{fmt(a.start_time)}</p>
                    <p className="text-xs text-muted-foreground">{fmt(a.end_time)}</p>
                  </div>
                  <div>
                    <p className="font-medium">{a.customers?.name ?? 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.services?.name} · {a.staff?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs capitalize ${statusColors[a.status] ?? ''}`}>
                    {a.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Appointment detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{selected.customers?.name ?? '–'}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{selected.customers?.phone_number ?? '–'}</p></div>
                <div><p className="text-muted-foreground">Service</p><p className="font-medium">{selected.services?.name ?? '–'}</p></div>
                <div><p className="text-muted-foreground">Staff</p><p className="font-medium">{selected.staff?.name ?? '–'}</p></div>
                <div><p className="text-muted-foreground">Time</p><p className="font-medium">{fmt(selected.start_time)} – {fmt(selected.end_time)}</p></div>
                <div><p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={`text-xs capitalize ${statusColors[selected.status] ?? ''}`}>
                    {selected.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {selected.status === 'booked' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => { setPayAmount(String(selected.services?.price ?? '')); setPayDialog(true) }}
                  >
                    <DollarSign className="h-4 w-4" />Record payment
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selected.id, 'no_show')}>No show</Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    await fetch('/api/booking/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: selected.id }) })
                    setSelected(null)
                    load()
                    toast.success('Appointment cancelled')
                  }}>Cancel</Button>
                </div>
              )}
              {selected.status === 'completed' && (
                <p className="text-sm text-green-600 text-center">Completed</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (€)</Label>
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min={0} step={0.5} />
              </div>
              <div className="space-y-1.5">
                <Label>Tip (€)</Label>
                <Input type="number" value={payTip} onChange={e => setPayTip(e.target.value)} min={0} step={0.5} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={recordPayment} disabled={loading}>
                {loading ? 'Saving...' : 'Confirm payment'}
              </Button>
              <Button variant="outline" onClick={() => setPayDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
