import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FirstRunIntro } from '../components/FirstRunIntro'
import { QuickChatBox } from '../components/QuickChatBox'
import { GusChatPanel } from '../components/GusChatPanel'
import { deleteMachine, listMachines } from '../lib/machines'
import type { Machine } from '../types/database'
import { GUS_AVATAR_URL } from '../lib/gusAssets'

/**
 * Home: chat-first. Quick-ask creates a session; open chats fill the main area.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const chatMachineId = searchParams.get('chat')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [recentMachines, setRecentMachines] = useState<Machine[]>([])

  useEffect(() => {
    let cancelled = false
    listMachines()
      .then((rows) => {
        if (!cancelled) setRecentMachines(rows.slice(0, 4))
      })
      .catch(() => {
        /* fleet link still works */
      })
    return () => {
      cancelled = true
    }
  }, [chatMachineId])

  const openSession = useCallback(
    (machineId: string, message: string) => {
      setPendingMessage(message)
      setSearchParams({ chat: machineId }, { replace: true })
    },
    [setSearchParams],
  )

  const closeSession = useCallback(() => {
    setPendingMessage(null)
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  const chatOpen = Boolean(chatMachineId)

  return (
    <div className="relative left-1/2 flex h-full min-h-0 w-screen max-w-[100vw] -translate-x-1/2 -mt-4 -mb-[max(1rem,env(safe-area-inset-bottom))] flex-col sm:-mt-5 sm:-mb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="shrink-0 px-4 sm:px-6">
        <FirstRunIntro />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/machines" className="im-pill">
          Your machines
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {chatOpen && (
            <button
              type="button"
              onClick={closeSession}
              className="inline-flex items-center rounded-full border border-safety-400/45 bg-safety-400/15 px-3 py-1.5 text-xs font-semibold text-safety-400 transition-colors hover:border-safety-400/70 hover:bg-safety-400/25"
            >
              New chat
            </button>
          )}
          <Link
            to="/machines/new"
            className="im-pill hover:border-tech-400/40 hover:text-tech-300"
          >
            + Add machine
          </Link>
        </div>
      </div>

      {chatOpen && chatMachineId ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col border-t border-steel-800/70 bg-steel-950">
          <GusChatPanel
            key={chatMachineId}
            machineId={chatMachineId}
            initialMessage={pendingMessage}
            variant="embedded"
            onClose={closeSession}
            onInitialMessageConsumed={() => setPendingMessage(null)}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6">
          <div className="fade-up flex min-h-0 flex-1 flex-col items-center justify-center gap-8 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-[1.75rem] bg-tech-400/10 blur-xl" aria-hidden />
                <img
                  src={GUS_AVATAR_URL}
                  alt=""
                  className="relative h-[4.5rem] w-[4.5rem] rounded-[1.35rem] border border-steel-700/80 object-cover shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                />
              </div>
              <div className="max-w-md space-y-2">
                <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight text-steel-50 sm:text-3xl">
                  What&apos;s the machine doing?
                </h1>
                <p className="text-[15px] leading-relaxed text-steel-400">
                  Describe the symptom — Gus digs in. No machine form required to start.
                </p>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <QuickChatBox onSessionStart={openSession} />
            </div>

            {recentMachines.length > 0 && (
              <div className="w-full max-w-xl space-y-3">
                <p className="font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">
                  Continue
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {recentMachines.map((m) => {
                    const label =
                      m.make.trim() && m.model.trim() ? `${m.make} ${m.model}` : m.name
                    return (
                      <div
                        key={m.id}
                        className="group relative overflow-hidden rounded-2xl border border-steel-700/70 bg-steel-900/80 transition-colors hover:border-tech-400/40"
                      >
                        <Link
                          to={`/machines/${m.id}/repair`}
                          className="block px-4 py-3.5 pr-11 text-left"
                        >
                          <span className="block truncate text-sm font-semibold text-steel-50">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-xs text-steel-500 group-hover:text-tech-400/90">
                            Open repair chat
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${label}`}
                          className="absolute top-2.5 right-2.5 rounded-xl p-1.5 text-steel-500 transition-colors hover:bg-danger-500/15 hover:text-danger-500"
                          onClick={(e) => {
                            e.preventDefault()
                            if (!confirm(`Delete ${label}? This can’t be undone.`)) return
                            void deleteMachine(m.id)
                              .then(() =>
                                setRecentMachines((prev) => prev.filter((row) => row.id !== m.id)),
                              )
                              .catch(() => alert('Could not delete that machine. Try again.'))
                          }}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
