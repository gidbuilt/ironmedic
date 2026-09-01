import { Link } from 'react-router-dom'
import { GUS_AVATAR_URL } from '../lib/gusAssets'
import { formatRelativeTime, machineLabel } from '../lib/machineLabel'
import { deleteMachine } from '../lib/machines'
import type { RecentSession } from '../lib/recentActivity'

type RecentsSectionProps = {
  sessions: RecentSession[]
  loading?: boolean
  onDeleted?: (machineId: string) => void
}

export function RecentsSection({ sessions, loading, onDeleted }: RecentsSectionProps) {
  if (loading) {
    return (
      <div className="w-full max-w-xl space-y-3">
        <div className="flex items-end justify-between gap-2">
          <p className="font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">Recents</p>
        </div>
        <div className="space-y-2">
          <div className="im-skeleton h-[4.25rem] rounded-2xl" />
          <div className="im-skeleton h-[4.25rem] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (sessions.length === 0) return null

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">Recents</p>
          <p className="mt-0.5 text-xs text-steel-500">Machines and chats you&apos;ve opened lately</p>
        </div>
        <Link to="/chat" className="text-xs font-medium text-tech-400 hover:text-tech-300">
          See all
        </Link>
      </div>

      <ul className="space-y-2">
        {sessions.map(({ machine, lastMessage, lastActiveAt, hasChat }) => {
          const label = machineLabel(machine)
          return (
            <li
              key={machine.id}
              className="flex items-stretch gap-1 rounded-2xl border border-steel-700/70 bg-steel-900/80 transition-colors hover:border-tech-400/40"
            >
              <Link
                to={`/machines/${machine.id}/repair`}
                className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left"
              >
                <img
                  src={GUS_AVATAR_URL}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl border border-steel-700/70 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-steel-50">{label}</p>
                  <p className="mt-0.5 truncate text-xs text-steel-500">
                    {hasChat && lastMessage ? lastMessage : 'No messages yet — tap to start'}
                  </p>
                  <p className="mt-1 text-[10px] text-steel-600">{formatRelativeTime(lastActiveAt)}</p>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-steel-800/80 px-1.5 py-2">
                <Link
                  to={`/machines/${machine.id}`}
                  className="rounded-lg p-2 text-steel-500 transition-colors hover:bg-steel-800 hover:text-tech-300"
                  aria-label={`Open ${label} profile`}
                  title="Machine profile"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${label}`}
                  title="Delete"
                  className="rounded-lg p-2 text-steel-500 transition-colors hover:bg-danger-500/15 hover:text-danger-500"
                  onClick={() => {
                    if (!confirm(`Delete ${label}? This can’t be undone.`)) return
                    void deleteMachine(machine.id)
                      .then(() => onDeleted?.(machine.id))
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
            </li>
          )
        })}
      </ul>

      <Link
        to="/machines"
        className="block text-center text-xs font-medium text-steel-500 hover:text-tech-400"
      >
        View equipment garage →
      </Link>
    </div>
  )
}
