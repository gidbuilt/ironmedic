import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HeaderMenu } from './HeaderMenu'
import { BottomTabBar } from './BottomTabBar'
import { BrandMark } from './BrandMark'
import { checkPendingFollowups, requestNotificationPermission } from '../lib/notifications'

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
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">
      <header className="im-header sticky top-0 z-20 shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <Link
            to="/"
            className="flex shrink-0 items-center rounded-2xl outline-offset-4 transition-transform active:scale-[0.98]"
            aria-label="IronMedic home"
          >
            <BrandMark size="nav" />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {user && <HeaderMenu />}
          </div>
        </div>
        <div className="hazard-stripe h-[2px] w-full opacity-90" />
      </header>
      <main className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-[var(--tab-bar-height)] sm:px-6 sm:pt-5">
        <Outlet />
      </main>
      {user && <BottomTabBar />}
    </div>
  )
}
