'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronRight, Phone, Scissors, User, Clock, CheckCircle } from 'lucide-react'

type Service = { id: string; name: string; duration_minutes: number; price: number; buffer_minutes: number }
type Staff = { id: string; name: string }
type Business = { id: string; name: string; slug: string; business_type: string }
type Slot = { start: string; end: string; staff_id: string; staff_name: string }

type Step = 'phone' | 'otp' | 'service' | 'staff' | 'slot' | 'confirm' | 'done'

interface Props {
  business: Business
  services: Service[]
  staff: Staff[]
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IE', { weekday: 'long', month: 'long', day: 'numeric' })

export function BookingFlow({ business, services, staff }: Props) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false) // stable: true when we need to collect name (avoids unmount on first keystroke)
  const [isReturning, setIsReturning] = useState(false)
  const [lastService, setLastService] = useState<Service | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null) // null = any
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [activeStaffTab, setActiveStaffTab] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-select first staff tab when slots load
  useEffect(() => {
    if (slots.length > 0) {
      const firstStaffId = staff.find(s => slots.some(sl => sl.staff_id === s.id))?.id ?? slots[0].staff_id
      setActiveStaffTab(firstStaffId)
    } else {
      setActiveStaffTab(null)
    }
  }, [slots])

  async function sendOtp() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/booking/verify-otp?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, slug: business.slug }),
    })
    setLoading(false)
    if (res.ok) setStep('otp')
    else setError('Failed to send code. Try again.')
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/booking/verify-otp?action=verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otp, slug: business.slug }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }

    if (data.customerName) setCustomerName(data.customerName)
    setShowNameInput(!data.customerName)
    setIsReturning(data.returning)
    if (data.lastService) setLastService(data.lastService)
    setStep('service')
  }

  async function loadSlots(service: Service, sId: string | null) {
    setLoading(true)
    const params = new URLSearchParams({
      slug: business.slug,
      serviceId: service.id,
      date: selectedDate,
      ...(sId ? { staffId: sId } : {}),
    })
    const res = await fetch(`/api/booking/slots?${params}`)
    const data = await res.json()
    setSlots(data.slots ?? [])
    setLoading(false)
    setStep('slot')
  }

  async function confirmBooking() {
    if (!selectedSlot || !selectedService) return
    setError('')
    setLoading(true)
    const res = await fetch('/api/booking/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: business.slug,
        serviceId: selectedService.id,
        staffId: selectedSlot.staff_id,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        customerPhone: phone,
        customerName,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Booking failed'); return }
    setStep('done')
  }

  // Group slots by staff
  const staffWithSlots = staff
    .map(s => ({ ...s, slots: slots.filter(sl => sl.staff_id === s.id) }))
    .filter(s => s.slots.length > 0)

  return (
    <div className="space-y-4">
      {/* Progress */}
      {step !== 'done' && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
          {(['phone', 'service', 'staff', 'slot', 'confirm'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={step === s ? 'text-foreground font-medium' : step === 'otp' && s === 'phone' ? 'text-foreground font-medium' : ''}>
                {s === 'phone' ? 'Phone' : s === 'service' ? 'Service' : s === 'staff' ? 'Staff' : s === 'slot' ? 'Time' : 'Confirm'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Step: Phone */}
      {step === 'phone' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center mb-2">
              <Phone className="h-8 w-8 mx-auto text-primary mb-2" />
              <h2 className="font-semibold">Enter your phone number</h2>
              <p className="text-sm text-muted-foreground">We'll send you a verification code</p>
            </div>
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+353 87 123 4567"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button className="w-full" onClick={sendOtp} disabled={loading || phone.length < 6}>
              {loading ? 'Sending...' : 'Send code'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: OTP */}
      {step === 'otp' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center mb-2">
              <h2 className="font-semibold">Enter your code</h2>
              <p className="text-sm text-muted-foreground">
                Check the <span className="font-medium">Messages</span> page to see your code (demo mode)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>4-digit code</Label>
              <Input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button className="w-full" onClick={verifyOtp} disabled={loading || otp.length !== 4}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
            <Button variant="ghost" className="w-full text-sm" onClick={() => { setStep('phone'); setOtp('') }}>
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Service */}
      {step === 'service' && (
        <div className="space-y-3">
          {/* Name input when we need to collect it (showNameInput stays true so input doesn't unmount on first keystroke) */}
          {showNameInput && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Label>Your name</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Your name" />
              </CardContent>
            </Card>
          )}

          {/* Returning customer: repeat offer */}
          {isReturning && lastService && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">Welcome back{customerName ? `, ${customerName}` : ''}!</p>
                <p className="text-sm text-muted-foreground mb-3">Book the same as last time?</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{lastService.name}</p>
                    <p className="text-sm text-muted-foreground">{lastService.duration_minutes} min · €{Number(lastService.price).toFixed(2)}</p>
                  </div>
                  <Button size="sm" onClick={() => { setSelectedService(lastService); setStep('staff') }}>
                    Book again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <h2 className="font-semibold px-1">Choose a service</h2>
          {services.map(s => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => { if (!customerName && !isReturning) return; setSelectedService(s); setStep('staff') }}
            >
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.duration_minutes} min</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">€{Number(s.price).toFixed(2)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}

          {!customerName && !isReturning && (
            <p className="text-sm text-muted-foreground text-center">Enter your name above to continue</p>
          )}
        </div>
      )}

      {/* Step: Staff */}
      {step === 'staff' && (
        <div className="space-y-3">
          <h2 className="font-semibold px-1">Choose a team member</h2>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => { setSelectedStaffId(null); loadSlots(selectedService!, null) }}
          >
            <CardContent className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No preference</p>
                  <p className="text-sm text-muted-foreground">Show all available slots</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>

          {staff.map(s => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => { setSelectedStaffId(s.id); loadSlots(selectedService!, s.id) }}
            >
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{s.name[0]}</span>
                  </div>
                  <p className="font-medium">{s.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}

          <Button variant="ghost" className="w-full" onClick={() => setStep('service')}>Back</Button>
        </div>
      )}

      {/* Step: Slot */}
      {step === 'slot' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold">Pick a date & time</h2>
            <Input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={async e => {
                setSelectedDate(e.target.value)
                await loadSlots(selectedService!, selectedStaffId)
              }}
              className="w-auto"
            />
          </div>

          {loading && <p className="text-center text-muted-foreground text-sm py-4">Loading slots...</p>}

          {!loading && slots.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No available slots on this date. Try another day.
              </CardContent>
            </Card>
          )}

          {!loading && staffWithSlots.length > 0 && (
            <div className="space-y-3">
              {/* Staff tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {staffWithSlots.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveStaffTab(s.id)}
                    className={[
                      'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors flex-shrink-0',
                      activeStaffTab === s.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background hover:border-primary',
                    ].join(' ')}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Slots for active tab — vertically scrollable */}
              {activeStaffTab && (() => {
                const activeSlots = staffWithSlots.find(s => s.id === activeStaffTab)?.slots ?? []
                return (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {activeSlots.map(sl => (
                      <Button
                        key={sl.start}
                        variant={selectedSlot?.start === sl.start && selectedSlot?.staff_id === sl.staff_id ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => { setSelectedSlot(sl); setStep('confirm') }}
                      >
                        <Clock className="h-3.5 w-3.5 mr-2 opacity-60" />
                        {fmtTime(sl.start)}
                      </Button>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => setStep('staff')}>Back</Button>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && selectedSlot && selectedService && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold text-lg">Confirm booking</h2>

            <div className="space-y-3 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedService.name}</p>
                  <p className="text-sm text-muted-foreground">€{Number(selectedService.price).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{selectedSlot.staff_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{fmtDate(selectedSlot.start)}</p>
                  <p className="text-sm text-muted-foreground">{fmtTime(selectedSlot.start)} – {fmtTime(selectedSlot.end)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{phone} · {customerName}</p>
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button className="w-full" onClick={confirmBooking} disabled={loading}>
              {loading ? 'Booking...' : 'Confirm booking'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep('slot')}>Back</Button>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === 'done' && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">You're booked!</h2>
            <p className="text-muted-foreground text-sm">
              Your {selectedService?.name} appointment on {selectedSlot && fmtDate(selectedSlot.start)} at {selectedSlot && fmtTime(selectedSlot.start)} is confirmed.
            </p>
            <p className="text-xs text-muted-foreground">A confirmation has been sent to {phone}</p>
            <Button variant="outline" onClick={() => { setStep('phone'); setPhone(''); setOtp(''); setSelectedSlot(null); setSelectedService(null) }}>
              Book another
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
