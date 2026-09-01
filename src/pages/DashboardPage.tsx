import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FirstRunIntro } from '../components/FirstRunIntro'
import { QuickChatBox } from '../components/QuickChatBox'
import { GusChatPanel } from '../components/GusChatPanel'
import { RecentsSection } from '../components/RecentsSection'
import { listRecentSessions, type RecentSession } from '../lib/recentActivity'
import { GUS_AVATAR_URL } from '../lib/gusAssets'

/**
 * Home: chat-first. Quick-ask creates a session; open chats fill the main area.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const chatMachineId = searchParams.get('chat')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentSession[]>([])
  const [recentsLoading, setRecentsLoading] = useState(true)

  const loadRecents = useCallback(() => {
    setRecentsLoading(true)
    listRecentSessions(6)
      .then((rows) => setRecents(rows))
      .catch(() => setRecents([]))
      .finally(() => setRecentsLoading(false))
  }, [])

  useEffect(() => {
    if (chatMachineId) return
    loadRecents()
  }, [chatMachineId, loadRecents])

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
    <div className="relative left-1/2 flex min-h-0 flex-1 w-screen max-w-[100vw] -translate-x-1/2 -mt-4 flex-col sm:-mt-5">
      <div className="shrink-0 px-4 sm:px-6">
        <FirstRunIntro />
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="fade-up mx-auto flex w-full max-w-xl flex-col gap-8 py-6 sm:py-8">
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

            <QuickChatBox onSessionStart={openSession} />

            <RecentsSection
              sessions={recents}
              loading={recentsLoading}
              onDeleted={(id) => setRecents((prev) => prev.filter((row) => row.machine.id !== id))}
            />
          </div>
        </div>
      )}
    </div>
  )
}
