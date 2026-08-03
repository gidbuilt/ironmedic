import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { IRONMEDIC_WORDMARK_URL } from '../lib/gusAssets'

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
    const { error } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate(next.startsWith('/') ? next : '/')
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResetSent(false)
    const { error } = await resetPasswordForEmail(email)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setResetSent(true)
  }

  async function continueAsGuest() {
    setSubmitting(true)
    setError(null)
    const { error } = await signInAnonymously()
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/')
  }

  return (
    <div className="tech-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-[env(safe-area-inset-top)]">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src={IRONMEDIC_WORDMARK_URL}
            alt="IronMedic"
            className="mx-auto h-12 w-auto max-w-[16rem] object-contain sm:h-14"
            draggable={false}
          />
          <p className="mt-3 font-mono text-xs tracking-widest text-tech-400 uppercase">
            AI Heavy-Equipment Diagnostics
          </p>
          <p className="mt-2 text-steel-400">Ask Gus. He never guesses.</p>
        </div>
        <Card accent="tech" className="p-6">
          {mode === 'forgot' ? (
            resetSent ? (
              <div className="text-center">
                <p className="text-lg font-semibold text-steel-50">Check your email</p>
                <p className="mt-2 text-sm text-steel-400">
                  If an account exists for <span className="text-steel-200">{email}</span>, we sent a
                  password reset link.
                </p>
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
            View Pro pricing
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
