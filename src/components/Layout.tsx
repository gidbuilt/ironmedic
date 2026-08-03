import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HeaderMenu } from './HeaderMenu'
import { checkPendingFollowups, requestNotificationPermission } from '../lib/notifications'
import { IRONMEDIC_WORDMARK_URL } from '../lib/gusAssets'

const FOLLOWUP_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function Layout() {
  const { user, isAnonymous } = useAuth()

  useEffect(() => {
    if (!user || isAnonymous) return
    requestNotificationPermission()
    checkPendingFollowups(user.id)
    const interval = setInterval(() => checkPendingFollowups(user.id), FOLLOWUP_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, isAnonymous])

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 border-b border-steel-800 bg-steel-950/97 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center" aria-label="IronMedic home">
            <img
              src={IRONMEDIC_WORDMARK_URL}
              alt="IronMedic"
              className="h-8 w-auto max-w-[9rem] object-contain object-left sm:h-9 sm:max-w-[14rem]"
              draggable={false}
            />
          </Link>
          {user && <HeaderMenu />}
        </div>
        <div className="hazard-stripe h-[3px] w-full opacity-90" />
      </header>
      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
        <Outlet />
      </main>
    </div>
  )
}
