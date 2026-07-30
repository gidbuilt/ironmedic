import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FirstRunIntro } from '../components/FirstRunIntro'
import { QuickChatBox } from '../components/QuickChatBox'
import { GusChatPanel } from '../components/GusChatPanel'
import { AvatarPanel } from '../components/avatar/AvatarPanel'

/**
 * Home: Gus stage stays visible for the whole conversation.
 * Chat opens as a bottom dock instead of navigating away.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const chatMachineId = searchParams.get('chat')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [gusBusy, setGusBusy] = useState(false)

  const openSession = useCallback(
    (machineId: string, message: string) => {
      setPendingMessage(message)
      setSearchParams({ chat: machineId }, { replace: true })
    },
    [setSearchParams],
  )

  const closeSession = useCallback(() => {
    setPendingMessage(null)
    setGusBusy(false)
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  const chatOpen = Boolean(chatMachineId)

  return (
    // Break out of Layout’s max-w + padding so the stage fills the viewport
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-3 -mb-3 flex h-[calc(100dvh-5.5rem+1.5rem)] flex-col sm:-mt-4 sm:-mb-4 sm:h-[calc(100dvh-5.5rem+2rem)]">
      <div className="shrink-0 px-4 sm:px-6">
        <FirstRunIntro />
      </div>

      <div
        className={`relative min-h-0 overflow-hidden bg-[#cfe9fb] sm:rounded-none ${
          chatOpen ? 'flex-[1.05]' : 'flex-1'
        }`}
      >
        <div className="gus-stage-bg" aria-hidden>
          <div className="gus-stage-bg__grid" />
          <div className="gus-stage-bg__vignette" />
        </div>

        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link
            to="/machines"
            className="rounded-lg bg-black/45 px-2.5 py-1 text-sm text-steel-100 backdrop-blur-sm hover:bg-black/60"
          >
            Your machines
          </Link>
          <Link
            to="/machines/new"
            className="rounded-lg border border-steel-500/60 bg-black/45 px-2.5 py-1 text-sm text-steel-100 backdrop-blur-sm hover:border-tech-400/50"
          >
            + Add machine
          </Link>
        </div>

        <div className="relative z-[1] flex h-full min-h-0 flex-col">
          <AvatarPanel speaking={gusBusy} size="hero" />
        </div>

        {!chatOpen && (
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 z-10 text-center text-xs text-steel-700/90">
            Ask Gus anything — no machine form required
          </p>
        )}
      </div>

      {chatOpen && chatMachineId ? (
        <div className="relative z-20 flex min-h-0 flex-[0.95] flex-col border-t border-steel-700 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:min-h-[16rem] sm:max-h-[48vh] sm:flex-none sm:h-[42vh]">
          <GusChatPanel
            key={chatMachineId}
            machineId={chatMachineId}
            initialMessage={pendingMessage}
            variant="embedded"
            onBusyChange={setGusBusy}
            onClose={closeSession}
            onInitialMessageConsumed={() => setPendingMessage(null)}
          />
        </div>
      ) : (
        <div className="shrink-0 border-t border-steel-800 bg-steel-950 px-4 py-2 sm:px-6">
          <QuickChatBox onSessionStart={openSession} />
        </div>
      )}
    </div>
  )
}
