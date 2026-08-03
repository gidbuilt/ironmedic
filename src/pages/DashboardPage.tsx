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
    <div className="relative left-1/2 flex w-screen max-w-[100vw] -translate-x-1/2 -mt-3 -mb-3 h-[calc(100dvh-5.5rem+1.5rem)] flex-col sm:-mt-4 sm:-mb-4 sm:h-[calc(100dvh-5.5rem+2rem)]">
      <div className="shrink-0 px-4 sm:px-6">
        <FirstRunIntro />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/machines" className="text-sm text-steel-400 hover:text-steel-200">
          Your machines
        </Link>
        <Link
          to="/machines/new"
          className="rounded-lg border border-steel-600 bg-steel-900 px-2.5 py-1 text-sm text-steel-200 hover:border-tech-400/50"
        >
          + Add machine
        </Link>
      </div>

      {chatOpen && chatMachineId ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col border-t border-steel-800 bg-steel-950">
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
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 sm:px-6">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <img
                src={GUS_AVATAR_URL}
                alt=""
                className="h-16 w-16 rounded-2xl border border-steel-700 object-cover shadow-lg"
              />
              <div>
                <h1 className="text-xl font-semibold text-steel-50 sm:text-2xl">What&apos;s the machine doing?</h1>
                <p className="mt-1 max-w-md text-sm text-steel-400">
                  Describe the symptom — Gus will dig in. No machine form required to start.
                </p>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <QuickChatBox onSessionStart={openSession} />
            </div>

            {recentMachines.length > 0 && (
              <div className="w-full max-w-xl">
                <p className="mb-2 font-mono text-[10px] tracking-widest text-steel-500 uppercase">
                  Continue with a machine
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {recentMachines.map((m) => {
                    const label =
                      m.make.trim() && m.model.trim() ? `${m.make} ${m.model}` : m.name
                    return (
                      <div
                        key={m.id}
                        className="relative rounded-xl border border-steel-700 bg-steel-900 transition-colors hover:border-tech-400/50"
                      >
                        <Link
                          to={`/machines/${m.id}/repair`}
                          className="block px-3 py-2.5 pr-10 text-left text-sm text-steel-100"
                        >
                          <span className="block truncate font-medium">{label}</span>
                          <span className="text-xs text-steel-500">Open repair chat</span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${label}`}
                          className="absolute top-2 right-2 rounded-lg p-1.5 text-danger-500/80 hover:bg-danger-500/15 hover:text-danger-500"
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
