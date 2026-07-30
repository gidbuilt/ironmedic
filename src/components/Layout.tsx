import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/Button'
import { checkPendingFollowups, requestNotificationPermission } from '../lib/notifications'
import { GUS_AVATAR_URL, IRONMEDIC_WORDMARK_URL } from '../lib/gusAssets'

const FOLLOWUP_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    requestNotificationPermission()
    checkPendingFollowups(user.id)
    const interval = setInterval(() => checkPendingFollowups(user.id), FOLLOWUP_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user])

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-steel-800 bg-steel-950/97 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center" aria-label="IronMedic home">
            <img
              src={IRONMEDIC_WORDMARK_URL}
              alt="IronMedic"
              className="h-8 w-auto max-w-[11rem] object-contain object-left sm:h-9 sm:max-w-[14rem]"
              draggable={false}
            />
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <div
                className="hidden items-center gap-1.5 rounded-full border border-steel-700 bg-steel-900 py-1 pl-1 pr-3 sm:flex"
                title="Gus is online"
              >
                <img src={GUS_AVATAR_URL} alt="" className="h-5 w-5 rounded-full object-cover" />
                <span className="relative flex h-1.5 w-1.5">
                  <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-tech-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tech-400" />
                </span>
                <span className="text-xs font-medium text-steel-300">Gus is online</span>
              </div>
              <span className="hidden text-sm text-steel-400 md:inline">{user.email}</span>
              <Button
                variant="ghost"
                className="min-h-9 px-3 py-2 text-sm"
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
        <div className="hazard-stripe h-[3px] w-full opacity-90" />
      </header>
      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
        <Outlet />
      </main>
    </div>
  )
}
