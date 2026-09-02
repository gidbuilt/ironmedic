import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { BrandMark } from '../components/BrandMark'

function isRecoveryType(type: string | null, hash: string): boolean {
  return type === 'recovery' || hash.includes('type=recovery')
}

/**
 * Handles Supabase auth redirects: PKCE code exchange, token_hash confirm links,
 * and legacy hash tokens. Used by password reset and email confirmation flows.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function completeAuth() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const code = searchParams.get('code')
      const next = searchParams.get('next') ?? '/'
      const hash = window.location.hash

      try {
        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          })
          if (verifyError) throw verifyError
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (hash.includes('access_token')) {
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
          if (!data.session) throw new Error('Auth link expired. Request a new email.')
        } else {
          throw new Error('Invalid or expired auth link.')
        }

        if (cancelled) return

        window.history.replaceState({}, '', window.location.pathname)
        navigate(isRecoveryType(type, hash) ? '/reset-password' : next, { replace: true })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not complete sign-in.')
      }
    }

    void completeAuth()
    return () => {
      cancelled = true
    }
  }, [navigate, searchParams])

  return (
    <div className="tech-grid relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="fade-up w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size="hero" showTagline={false} />
        </div>
        <Card accent="tech" className="p-6 text-center sm:p-7">
          {error ? (
            <>
              <p className="text-sm leading-relaxed text-steel-300">{error}</p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-safety-400 hover:text-safety-300"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <div className="im-skeleton mx-auto h-4 w-48 rounded-full" />
              <p className="mt-3 text-sm text-steel-400">Completing sign-in…</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
