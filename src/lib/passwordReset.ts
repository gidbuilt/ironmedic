import { isSupabaseConfigured, supabase } from './supabase'

/** Sends a password-reset email with a token_hash link (works from Mail/Safari on iOS). */
export async function requestPasswordResetEmail(email: string): Promise<{ error: string | null }> {
  const trimmed = email.trim()
  if (!trimmed) return { error: 'Enter your email address.' }

  const base = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!isSupabaseConfigured || !base || !anonKey) {
    return { error: 'App is missing Supabase configuration.' }
  }

  try {
    const res = await fetch(`${base}/functions/v1/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify({ email: trimmed }),
    })

    const json = (await res.json()) as { error?: string; message?: string }
    if (!res.ok) {
      return { error: json.message ?? json.error ?? `Could not send reset email (${res.status}).` }
    }

    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not send reset email.' }
  }
}

/** @deprecated Use requestPasswordResetEmail — client resetPasswordForEmail uses PKCE links that fail on iOS. */
export async function legacyResetPasswordForEmail(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'https://ironmedic.vercel.app/auth/confirm',
  })
  return { error: error?.message ?? null }
}
