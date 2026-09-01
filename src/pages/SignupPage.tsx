import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { BrandMark } from '../components/BrandMark'

export function SignupPage() {
  const { signUp, upgradeGuestAccount, isAnonymous, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const forUpgrade = params.get('reason') === 'upgrade'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (authLoading) return
    setSubmitting(true)
    setError(null)

    try {
      // Prefer converting the current guest so machines/chats stay attached.
      const result =
        isAnonymous && user
          ? await upgradeGuestAccount(email, password)
          : await signUp(email, password)

      if (result.error) {
        setError(result.error)
        return
      }

      if (!result.needsEmailConfirmation) {
        navigate(next.startsWith('/') ? next : '/', { replace: true })
        return
      }

      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="tech-grid relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom),var(--keyboard-inset))] pt-[env(safe-area-inset-top)]">
        <div className="hazard-stripe absolute inset-x-0 top-0 h-1 opacity-90" />
        <Card accent="tech" className="fade-up max-w-sm p-6 text-center sm:p-7">
          <p className="text-lg font-semibold tracking-tight text-steel-50">Check your email</p>
          <p className="mt-2 text-[15px] leading-relaxed text-steel-400">
            We sent a confirmation link to <span className="text-steel-200">{email}</span>. Confirm it, then
            sign in.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="tech-grid relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom),var(--keyboard-inset))] pt-[env(safe-area-inset-top)]">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-1 opacity-90" />
      <div className="fade-up w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size="hero" showTagline={false} />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-steel-400">
            {forUpgrade
              ? 'Create an account to unlock Pro — your guest chat history stays with you.'
              : 'Create your account to keep your fleet with Gus.'}
          </p>
        </div>
        <Card accent="tech" className="p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-danger-500">{error}</p>}
            <Button type="submit" disabled={submitting || authLoading} className="mt-2 w-full">
              {authLoading
                ? 'Starting…'
                : submitting
                  ? 'Creating account…'
                  : forUpgrade
                    ? 'Save account & continue'
                    : 'Create account'}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-[15px] text-steel-400">
          Already have an account?{' '}
          <Link
            to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-safety-400 hover:text-safety-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
