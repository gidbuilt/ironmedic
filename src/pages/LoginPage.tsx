import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { BrandMark } from '../components/BrandMark'

export function LoginPage() {
  const { user, loading, isAnonymous, signInWithPassword, signInAnonymously, resetPasswordForEmail } =
    useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'signIn' | 'forgot'>('signIn')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!loading && user && !isAnonymous) {
      navigate(next.startsWith('/') ? next : '/', { replace: true })
    }
  }, [loading, user, isAnonymous, navigate, next])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await signInWithPassword(email, password)
      if (error) {
        setError(error)
        return
      }
      navigate(next.startsWith('/') ? next : '/')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResetSent(false)
    try {
      const { error } = await resetPasswordForEmail(email)
      if (error) {
        setError(error)
        return
      }
      setResetSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  const forgotHint =
    'Look for an email with subject “Reset your IronMedic password” (not “Supabase Auth”). Old reset links will not work.'

  async function continueAsGuest() {
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await signInAnonymously()
      if (error) {
        setError(error)
        return
      }
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tech-grid relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom),var(--keyboard-inset))] pt-[env(safe-area-inset-top)]">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-1 opacity-90" />
      <div className="fade-up w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size="hero" />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-steel-400">
            AI heavy-equipment diagnostics. Ask Gus — he never guesses.
          </p>
        </div>
        <Card accent="tech" className="p-6 sm:p-7">
          {mode === 'forgot' ? (
            resetSent ? (
              <div className="text-center">
                <p className="text-lg font-semibold text-steel-50">Check your email</p>
                <p className="mt-2 text-sm text-steel-400">
                  If an account exists for <span className="text-steel-200">{email}</span>, we sent a
                  password reset link.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-steel-500">{forgotHint}</p>
                <Button
                  type="button"
                  className="mt-6 w-full"
                  onClick={() => {
                    setMode('signIn')
                    setResetSent(false)
                    setError(null)
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-steel-300">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error && <p className="text-sm text-danger-500">{error}</p>}
                <Button type="submit" disabled={submitting} className="mt-2 w-full">
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Button>
                <button
                  type="button"
                  className="text-sm text-steel-400 hover:text-steel-200"
                  onClick={() => {
                    setMode('signIn')
                    setError(null)
                  }}
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div>
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-tech-400 hover:text-tech-300 hover:underline"
                      onClick={() => {
                        setMode('forgot')
                        setError(null)
                        setResetSent(false)
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-danger-500">{error}</p>}
                <Button type="submit" disabled={submitting} className="mt-2 w-full">
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <div className="relative my-4 text-center">
                <span className="bg-steel-900 px-2 text-xs text-steel-500">or</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={submitting}
                onClick={() => void continueAsGuest()}
              >
                Continue without signing in
              </Button>
            </>
          )}
        </Card>
        <p className="mt-4 text-center text-sm text-steel-400">
          <Link to="/pricing" className="text-tech-400 hover:underline">
            View pricing
          </Link>
        </p>
        <p className="mt-4 text-center text-steel-400">
          New here?{' '}
          <Link
            to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-safety-400 hover:text-safety-300"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
