import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteMachine, listMachines } from '../lib/machines'
import type { Machine } from '../types/database'
import { GUS_AVATAR_URL } from '../lib/gusAssets'
import { QUICK_CHAT_PLACEHOLDER_NAME } from './QuickChatBox'

function machineIdFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/machines\/([^/]+)/)
  if (!m || m[1] === 'new') return undefined
  return m[1]
}

function machineLabel(m: Machine): string {
  if (m.name === QUICK_CHAT_PLACEHOLDER_NAME || (!m.make.trim() && !m.model.trim())) {
    return 'Untitled session'
  }
  if (m.make.trim() && m.model.trim()) {
    const makeModel = `${m.make} ${m.model}`
    if (m.name && m.name !== makeModel && m.name !== m.model && m.name !== m.make) {
      return `${makeModel} (“${m.name}”)`
    }
    return makeModel
  }
  return m.name || 'Machine'
}

function MenuLink({
  to,
  onClick,
  children,
  accent,
}: {
  to: string
  onClick: () => void
  children: ReactNode
  accent?: 'yellow' | 'default'
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-steel-800 ${
        accent === 'yellow' ? 'font-medium text-safety-400' : 'text-steel-100'
      }`}
    >
      {children}
    </Link>
  )
}

/**
 * Top-right hamburger — holds machine switcher + account / billing actions.
 */
export function HeaderMenu() {
  const { isAnonymous, subscriptionTier, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [machines, setMachines] = useState<Machine[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const activeMachineId = machineIdFromPath(pathname)

  useEffect(() => {
    let cancelled = false
    listMachines()
      .then((rows) => {
        if (!cancelled) setMachines(rows)
      })
      .catch(() => {
        if (!cancelled) setMachines([])
      })
    return () => {
      cancelled = true
    }
  }, [pathname, open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-steel-500/50 bg-gradient-to-b from-steel-700/90 to-steel-900/95 text-steel-50 shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,background-color,box-shadow] hover:border-safety-400/45 hover:from-steel-700 hover:shadow-[0_4px_20px_rgba(255,199,44,0.12)] focus:border-tech-400 focus:outline-none sm:h-11 sm:w-11 sm:rounded-2xl"
      >
        <span className="flex w-4 flex-col gap-[3.5px]" aria-hidden>
          <span
            className={`h-0.5 w-full rounded-full bg-steel-100 transition duration-200 ${open ? 'translate-y-[5.5px] rotate-45' : ''}`}
          />
          <span className={`h-0.5 w-full rounded-full bg-steel-100 transition duration-200 ${open ? 'opacity-0' : ''}`} />
          <span
            className={`h-0.5 w-full rounded-full bg-steel-100 transition duration-200 ${open ? '-translate-y-[5.5px] -rotate-45' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="fade-up absolute right-0 z-50 mt-2.5 w-[min(18.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-steel-600/70 bg-steel-900/97 shadow-[0_24px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,199,44,0.06)] backdrop-blur-xl"
        >
          <div className="flex items-center gap-2.5 border-b border-steel-800/90 bg-gradient-to-r from-safety-400/8 via-transparent to-tech-400/8 px-3.5 py-3">
            <img
              src={GUS_AVATAR_URL}
              alt=""
              className="h-7 w-7 rounded-lg border border-safety-400/30 object-cover"
            />
            <span className="relative flex h-1.5 w-1.5">
              <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-tech-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tech-400" />
            </span>
            <span className="text-xs font-medium text-steel-200">Gus is online</span>
          </div>

          {machines.length > 0 && (
            <div className="border-b border-steel-800 py-1">
              <p className="px-3 py-1.5 font-mono text-[10px] tracking-widest text-steel-500 uppercase">
                Machines
              </p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  navigate('/machines')
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-steel-800 ${
                  !activeMachineId ? 'text-tech-400' : 'text-steel-100'
                }`}
              >
                <span className="w-3 shrink-0">{!activeMachineId ? '✓' : ''}</span>
                All machines…
              </button>
              {machines.map((m) => {
                const selected = m.id === activeMachineId
                const label = machineLabel(m)
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-1 pr-1 hover:bg-steel-800 ${
                      selected ? 'text-tech-400' : 'text-steel-100'
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close()
                        navigate(`/machines/${m.id}/repair`)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <span className="w-3 shrink-0">{selected ? '✓' : ''}</span>
                      <span className="truncate">{label}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${label}`}
                      className="shrink-0 rounded-md p-1.5 text-danger-500/80 hover:bg-danger-500/15 hover:text-danger-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!confirm(`Delete ${label}? This can’t be undone.`)) return
                        void deleteMachine(m.id)
                          .then(() => {
                            setMachines((prev) => prev.filter((row) => row.id !== m.id))
                            if (activeMachineId === m.id) {
                              close()
                              navigate('/')
                            }
                          })
                          .catch(() => alert('Could not delete that machine. Try again.'))
                      }}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12ZM10 11v6M14 11v6"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                )
              })}
              <MenuLink to="/machines/new" onClick={close}>
                + Add machine
              </MenuLink>
            </div>
          )}

          <div className="py-1">
            {subscriptionTier === 'free' && (
              <MenuLink to="/pricing" onClick={close} accent="yellow">
                Start free trial
              </MenuLink>
            )}
            {subscriptionTier === 'basic' && (
              <MenuLink to="/pricing" onClick={close} accent="yellow">
                Upgrade to Pro
              </MenuLink>
            )}
            {subscriptionTier === 'pro' && (
              <MenuLink to="/pricing" onClick={close} accent="yellow">
                Upgrade to Premium
              </MenuLink>
            )}
            <MenuLink to="/pricing" onClick={close}>
              Pricing
            </MenuLink>
            <MenuLink to="/account" onClick={close}>
              Account
            </MenuLink>
            {isAnonymous ? (
              <>
                <MenuLink to="/signup" onClick={close}>
                  Create account
                </MenuLink>
                <MenuLink to="/login" onClick={close}>
                  Sign in
                </MenuLink>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  close()
                  await signOut()
                  navigate('/')
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-steel-100 hover:bg-steel-800"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
