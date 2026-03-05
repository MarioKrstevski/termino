import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

/**
 * When SKIP_SIGNUP_EMAIL_VERIFICATION=true we create the user via admin API
 * with email_confirm: true so no verification email is sent (avoids Supabase
 * rate limit). Otherwise we return useClientSignup and the client uses
 * supabase.auth.signUp() (sends confirmation email).
 *
 * REVERT FOR PRODUCTION: Set SKIP_SIGNUP_EMAIL_VERIFICATION=false or remove it,
 * and ensure Supabase Dashboard → Auth → Email has "Confirm email" enabled.
 * See CLAUDE.md Environment Variables section.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, password } = parsed.data
  const skipVerification =
    process.env.SKIP_SIGNUP_EMAIL_VERIFICATION === 'true' ||
    process.env.SKIP_SIGNUP_EMAIL_VERIFICATION === '1'

  if (!skipVerification) {
    return NextResponse.json({ useClientSignup: true })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }

  return NextResponse.json({ created: true, userId: data.user?.id })
}
