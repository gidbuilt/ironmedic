import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createQuickChatMachine } from '../lib/quickChat'

type TabKey = 'home' | 'chat' | 'fleet' | 'settings'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6V20.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M5 5.5h14A2.5 2.5 0 0 1 21.5 8v6A2.5 2.5 0 0 1 19 16.5H9l-4 3.5V8A2.5 2.5 0 0 1 7.5 5.5H5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FleetIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M4 7h16M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7m-1 0v10.5A1.5 1.5 0 0 1 15.5 19h-7A1.5 1.5 0 0 1 7 17.5V7"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
        strokeLinecap="round"
      />
      <path
        d="M9 11h6M9 14.5h4"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
        strokeLinecap="round"
      />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
      />
      <path
        d="M19.4 13.5a7.4 7.4 0 0 0 .1-3l2-1.2-2-3.5-2.3.7a7.5 7.5 0 0 0-2.6-1.5L14.5 2h-5L9.4 5.5a7.5 7.5 0 0 0-2.6 1.5l-2.3-.7-2 3.5 2 1.2a7.4 7.4 0 0 0 0 3l-2 1.2 2 3.5 2.3-.7c.8.6 1.7 1.1 2.6 1.5l.1 3.5h5l.1-3.5c.9-.4 1.8-.9 2.6-1.5l2.3.7 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.75}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function tabClass(active: boolean) {
  return `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-colors ${
    active ? 'text-safety-400' : 'text-steel-500 hover:text-steel-300'
  }`
}

function resolveActiveTab(pathname: string, search: string): TabKey | null {
  const chatOpen = new URLSearchParams(search).has('chat')
  if (pathname === '/chat' || pathname.endsWith('/repair') || chatOpen) return 'chat'
  if (pathname.startsWith('/machines')) return 'fleet'
  if (pathname === '/account' || pathname === '/pricing') return 'settings'
  if (pathname === '/') return 'home'
  return null
}

export function BottomTabBar() {
  const { user, isSubscribed } = useAuth()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const active = resolveActiveTab(pathname, search)

  async function handleNewChat() {
    if (!user || creating) return
    if (!isSubscribed) {
      navigate('/pricing')
      return
    }
    setCreating(true)
    try {
      const machine = await createQuickChatMachine(user.id)
      navigate(`/machines/${machine.id}/repair`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not start a new chat.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <nav
      aria-label="Main"
      className="im-tab-bar fixed inset-x-0 bottom-0 z-30 border-t border-steel-800/90 bg-steel-950/95 backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1">
        <Link to="/" className={tabClass(active === 'home')} aria-current={active === 'home' ? 'page' : undefined}>
          <HomeIcon active={active === 'home'} />
          <span>Home</span>
        </Link>

        <Link
          to="/chat"
          className={tabClass(active === 'chat')}
          aria-current={active === 'chat' ? 'page' : undefined}
        >
          <ChatIcon active={active === 'chat'} />
          <span>Chat</span>
        </Link>

        <div className="flex flex-col items-center justify-end pb-1.5">
          <button
            type="button"
            aria-label="New chat"
            disabled={creating}
            onClick={() => void handleNewChat()}
            className="im-tab-fab grid h-11 w-11 shrink-0 place-items-center rounded-full border border-safety-400/50 bg-safety-400 text-steel-950 shadow-[0_8px_24px_rgba(255,199,44,0.35)] transition-transform active:scale-95 disabled:opacity-60"
          >
            {creating ? (
              <span className="text-lg leading-none">…</span>
            ) : (
              <PlusIcon />
            )}
          </button>
          <span className="mt-0.5 text-[10px] font-medium opacity-0" aria-hidden>
            New
          </span>
        </div>

        <Link
          to="/machines"
          className={tabClass(active === 'fleet')}
          aria-current={active === 'fleet' ? 'page' : undefined}
        >
          <FleetIcon active={active === 'fleet'} />
          <span>Fleet</span>
        </Link>

        <Link
          to="/account"
          className={tabClass(active === 'settings')}
          aria-current={active === 'settings' ? 'page' : undefined}
        >
          <SettingsIcon active={active === 'settings'} />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  )
}
