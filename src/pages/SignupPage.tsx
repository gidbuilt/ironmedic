import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signUp(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="tech-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5" />
        <Card accent="tech" className="max-w-sm p-6 text-center">
          <p className="text-lg font-semibold text-steel-50">Check your email</p>
          <p className="mt-2 text-steel-400">
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
    <div className="tech-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-1.5" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-5xl tracking-wide text-steel-50">
            IRON<span className="text-safety-400">MEDIC</span>
          </span>
          <p className="mt-2 font-mono text-xs tracking-widest text-tech-400 uppercase">AI Heavy-Equipment Diagnostics</p>
          <p className="mt-2 text-steel-400">Create your account to meet Gus.</p>
        </div>
        <Card accent="tech" className="p-6">
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
            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Card>
        <p className="mt-6 text-center text-steel-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-safety-400 hover:text-safety-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
