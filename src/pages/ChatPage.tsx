import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GUS_AVATAR_URL } from '../lib/gusAssets'
import { machineLabel } from '../lib/machineLabel'
import { listMachines } from '../lib/machines'
import type { Machine } from '../types/database'
import { Card } from '../components/ui/Card'

/** Recent Gus conversations — tap to reopen repair chat. */
export function ChatPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listMachines()
      .then((rows) => {
        if (!cancelled) setMachines(rows)
      })
      .catch(() => {
        if (!cancelled) setMachines([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fade-up min-h-0 flex-1 space-y-5 overflow-y-auto pb-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">Gus</p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Chats</h1>
        <p className="text-[15px] text-steel-400">Pick up where you left off, or tap + for a new session.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="im-skeleton h-16 rounded-2xl" />
          <div className="im-skeleton h-16 rounded-2xl" />
        </div>
      ) : machines.length === 0 ? (
        <Card accent="tech" className="flex flex-col items-center gap-4 p-8 text-center">
          <img
            src={GUS_AVATAR_URL}
            alt=""
            className="h-14 w-14 rounded-2xl border border-steel-700/80 object-cover"
          />
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-steel-50">No chats yet</p>
            <p className="text-sm text-steel-400">Tap + in the bar below to ask Gus about a machine.</p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-2">
          {machines.map((m) => (
            <li key={m.id}>
              <Link
                to={`/machines/${m.id}/repair`}
                className="flex items-center gap-3 rounded-2xl border border-steel-700/70 bg-steel-900/80 px-4 py-3.5 transition-colors hover:border-tech-400/40"
              >
                <img
                  src={GUS_AVATAR_URL}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl border border-steel-700/70 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-steel-50">{machineLabel(m)}</p>
                  <p className="text-xs text-steel-500">Open repair chat</p>
                </div>
                <span className="text-steel-600" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
