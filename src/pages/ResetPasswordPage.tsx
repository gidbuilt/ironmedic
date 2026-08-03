import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { IRONMEDIC_WORDMARK_URL } from '../lib/gusAssets'

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
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
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
          <p className="mt-3 text-steel-400">Choose a new password</p>
        </div>
        <Card accent="tech" className="p-6">
          {done ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-steel-50">Password updated</p>
              <p className="mt-2 text-sm text-steel-400">You can sign in with your new password.</p>
              <Button className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>
                Go to IronMedic
              </Button>
            </div>
          ) : !canReset ? (
            <div className="text-center">
              <p className="text-sm text-steel-300">
                {loading
                  ? 'Checking reset link…'
                  : 'This reset link is invalid or has expired. Request a new one from the sign-in page.'}
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-safety-400 hover:text-safety-300"
              >
                Back to sign in
              </Link>
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
