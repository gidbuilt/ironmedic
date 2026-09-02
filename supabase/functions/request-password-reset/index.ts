import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabaseClients.ts'

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://ironmedic.vercel.app').replace(/\/$/, '')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'IronMedic <onboarding@resend.dev>'

function buildRecoveryUrl(tokenHash: string): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type: 'recovery' })
  return `${APP_URL}/auth/confirm?${params.toString()}`
}

async function sendResendEmail(to: string, resetUrl: string): Promise<string | null> {
  if (!RESEND_API_KEY) return 'resend_not_configured'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: 'Reset your password',
      html: `
        <h2>Reset your password</h2>
        <p>We received a request to reset your IronMedic password. Follow the link below to choose a new one.</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('request-password-reset: resend failed', res.status, text)
    return 'email_send_failed'
  }
  return null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let email = ''
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (!email || !email.includes('@')) {
    return jsonResponse({ error: 'invalid_email', message: 'Enter a valid email address.' }, 400)
  }

  const service = createServiceClient()
  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${APP_URL}/auth/confirm` },
  })

  if (error) {
    console.error('request-password-reset: generateLink', error)
    return jsonResponse({ error: 'reset_failed', message: error.message }, 400)
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    return jsonResponse({ error: 'link_failed', message: 'Could not create reset link.' }, 500)
  }

  const resetUrl = buildRecoveryUrl(tokenHash)
  const sendError = await sendResendEmail(email, resetUrl)

  if (sendError === 'resend_not_configured') {
    return jsonResponse(
      {
        error: 'email_not_configured',
        message:
          'Password reset email is not configured yet. Add RESEND_API_KEY to Supabase secrets, or set custom SMTP + recovery template in the Supabase dashboard (see docs/AUTH.md).',
      },
      503,
    )
  }

  if (sendError) {
    return jsonResponse(
      { error: sendError, message: 'Could not send reset email. Try again in a moment.' },
      500,
    )
  }

  return jsonResponse({ ok: true })
})
