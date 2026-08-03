import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

export function ProtectedRoute() {
  const { user, loading, authError, signInAnonymously } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-steel-400">
        Loading&hellip;
      </div>
    )
  }

  if (!user) {
    return (
      <div className="tech-grid flex min-h-screen items-center justify-center px-4">
        <Card accent="tech" className="w-full max-w-md space-y-4 p-6">
          <h1 className="text-lg font-semibold text-steel-50">Almost ready</h1>
          <p className="text-sm text-steel-300">
            {authError ??
              'Could not start a guest session. Enable Anonymous sign-ins in your Supabase project, then try again.'}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-steel-400">
            <li>Open Supabase Dashboard → Authentication → Providers</li>
            <li>Enable <strong className="text-steel-200">Anonymous</strong></li>
            <li>Reload this page</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void signInAnonymously()
              }}
            >
              Try guest access again
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
