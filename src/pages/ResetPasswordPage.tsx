import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { BrandMark } from '../components/BrandMark'

export function ResetPasswordPage() {
  const { updatePassword, user, loading, isAnonymous } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const canReset = !loading && user && !isAnonymous

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await updatePassword(password)
      if (error) {
        setError(error)
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tech-grid relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom),var(--keyboard-inset))] pt-[env(safe-area-inset-top)]">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-1 opacity-90" />
      <div className="fade-up w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size="hero" showTagline={false} />
          <p className="mt-4 text-[15px] text-steel-400">Choose a new password</p>
        </div>
        <Card accent="tech" className="p-6 sm:p-7">
          {done ? (
            <div className="text-center">
              <p className="text-lg font-semibold tracking-tight text-steel-50">Password updated</p>
              <p className="mt-2 text-sm leading-relaxed text-steel-400">
                You can sign in with your new password.
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>
                Go to IronMedic
              </Button>
            </div>
          ) : !canReset ? (
            <div className="text-center">
              {loading ? (
                <div className="space-y-3">
                  <div className="im-skeleton mx-auto h-4 w-48 rounded-full" />
                  <p className="text-sm text-steel-400">Checking reset link…</p>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-steel-300">
                    This reset link is invalid or has expired. Request a new one from the sign-in page.
                  </p>
                  <Link
                    to="/login"
                    className="mt-6 inline-block text-sm font-medium text-safety-400 hover:text-safety-300"
                  >
                    Back to sign in
                  </Link>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <p className="text-sm text-danger-500">{error}</p>}
              <Button type="submit" disabled={submitting} className="mt-2 w-full">
                {submitting ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
