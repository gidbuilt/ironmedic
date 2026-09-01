import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

export function ProtectedRoute() {
  const { user, loading, authError, signInAnonymously } = useAuth()

  if (loading) {
    return (
      <div className="tech-grid flex h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="im-skeleton h-10 w-40 rounded-2xl" />
        <div className="im-skeleton h-3 w-28 rounded-full" />
        <p className="text-sm text-steel-500">Starting IronMedic…</p>
      </div>
    )
  }

  if (!user) {
    const friendly =
      authError && /load failed|failed to fetch|network/i.test(authError)
        ? 'Connection issue. Check your network and try again.'
        : authError

    return (
      <div className="tech-grid flex min-h-screen items-center justify-center px-4 pt-[env(safe-area-inset-top)]">
        <Card accent="tech" className="fade-up w-full max-w-md space-y-5 p-6 sm:p-7">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-steel-50">Almost ready</h1>
            <p className="text-sm leading-relaxed text-steel-400">
              {friendly ?? 'Could not start a guest session. Try again in a moment.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void signInAnonymously()
              }}
            >
              Try again
            </Button>
            <Link to="/login">
              <Button type="button" variant="secondary">
                Sign in instead
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
