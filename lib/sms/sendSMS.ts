import { createAdminClient } from '@/lib/supabase/admin'

export type MessageType =
  | 'otp'
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'review_request'
  | 'cancellation'

const templates: Record<MessageType, (vars: Record<string, string>) => string> = {
  otp: v => `Your Termino verification code is: ${v.code}`,
  booking_confirmation: v => `Hi ${v.name}! Your ${v.service} appointment at ${v.business} is confirmed for ${v.datetime}. See you soon!`,
  reminder_24h: v => `Hi ${v.name}! Reminder: you have a ${v.service} appointment at ${v.business} tomorrow at ${v.time}.`,
  reminder_2h: v => `Hi ${v.name}! Your ${v.service} appointment at ${v.business} is in 2 hours at ${v.time}.`,
  review_request: v => `Hi ${v.name}! How was your visit to ${v.business}? We'd love your feedback.`,
  cancellation: v => `Hi ${v.name}! Your appointment at ${v.business} on ${v.datetime} has been cancelled.`,
}

export async function sendSMS({
  businessId,
  phone,
  type,
  vars = {},
  appointmentId = null,
}: {
  businessId: string | null
  phone: string
  type: MessageType
  vars?: Record<string, string>
  appointmentId?: string | null
}) {
  const content = templates[type](vars)
  const admin = createAdminClient()

  await admin.from('sms_logs').insert({
    business_id: businessId,
    phone_number: phone,
    message_type: type,
    content,
    status: 'mock',
    ...(appointmentId && { appointment_id: appointmentId }),
  })

  return { content }
}
