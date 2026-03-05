import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone } from 'lucide-react'

const typeColors: Record<string, string> = {
  otp: 'bg-blue-500/10 text-blue-700',
  booking_confirmation: 'bg-green-500/10 text-green-700',
  reminder_24h: 'bg-yellow-500/10 text-yellow-700',
  reminder_2h: 'bg-orange-500/10 text-orange-700',
  review_request: 'bg-purple-500/10 text-purple-700',
  cancellation: 'bg-red-500/10 text-red-700',
}

const typeLabels: Record<string, string> = {
  otp: 'OTP Code',
  booking_confirmation: 'Booking Confirmed',
  reminder_24h: '24h Reminder',
  reminder_2h: '2h Reminder',
  review_request: 'Review Request',
  cancellation: 'Cancellation',
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  if (!business) redirect('/onboarding')

  const admin = createAdminClient()
  const { data: messages } = await admin
    .from('sms_logs')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-IE', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Mock SMS log — what would be sent to customers</p>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
        <strong>Demo mode:</strong> No real SMS is sent. All messages are logged here for testing.
        OTP codes also appear here — share this page with customers during testing.
      </div>

      {!messages?.length ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No messages yet. They'll appear here when bookings are made.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <Card key={m.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{m.phone_number}</span>
                    <Badge className={`text-xs ${typeColors[m.message_type] ?? ''}`} variant="secondary">
                      {typeLabels[m.message_type] ?? m.message_type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmt(m.created_at)}</span>
                </div>
                <p className="text-sm bg-muted/50 rounded-md p-3 font-mono">{m.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
