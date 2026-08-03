import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { deleteMachine, listMachines } from '../lib/machines'
import type { Machine } from '../types/database'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12ZM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MachineNameplate({
  machine,
  onDeleted,
}: {
  machine: Machine
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const isUnidentified = !machine.make.trim() || !machine.model.trim()
  const makeModel = `${machine.make} ${machine.model}`
  const hasCustomName =
    machine.name &&
    !isUnidentified &&
    machine.name !== makeModel &&
    machine.name !== machine.model &&
    machine.name !== machine.make

  async function handleDelete(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const label = isUnidentified ? machine.name : makeModel.trim() || machine.name
    if (!confirm(`Delete ${label}? This can’t be undone.`)) return
    setDeleting(true)
    try {
      await deleteMachine(machine.id)
      onDeleted(machine.id)
    } catch {
      setDeleting(false)
      alert('Could not delete that machine. Try again.')
    }
  }

  return (
    <Card className="h-full overflow-hidden p-0">
      <div className="flex h-full items-stretch">
        <div className={`w-1.5 shrink-0 ${isUnidentified ? 'bg-tech-400/50' : 'bg-safety-400'}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-w-0 flex-1">
            <Link
              to={`/machines/${machine.id}`}
              className="block min-w-0 flex-1 px-3 py-3 pr-10 transition-colors hover:bg-steel-800/60"
            >
              {isUnidentified ? (
                <>
                  <p className="truncate text-[10px] font-medium tracking-wide text-tech-400 uppercase">
                    Identifying…
                  </p>
                  <p className="truncate text-sm font-semibold text-steel-50">{machine.name}</p>
                </>
              ) : (
                <>
                  <p className="truncate text-[10px] font-medium tracking-wide text-steel-500 uppercase">
                    {machine.make}
                  </p>
                  <p className="truncate text-sm font-semibold text-steel-50">{machine.model}</p>
                </>
              )}
              {hasCustomName && (
                <p className="mt-0.5 truncate text-xs text-steel-400">&ldquo;{machine.name}&rdquo;</p>
              )}
            </Link>
            <button
              type="button"
              aria-label={`Delete ${machine.name}`}
              disabled={deleting}
              onClick={(e) => void handleDelete(e)}
              className="absolute top-2 right-2 rounded-lg p-1.5 text-danger-500/80 hover:bg-danger-500/15 hover:text-danger-500 disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <Link
            to={`/machines/${machine.id}/repair`}
            className="border-t border-steel-800 px-3 py-2 text-xs font-medium text-tech-400 transition-colors hover:bg-steel-800/60 hover:text-tech-300"
          >
            Talk to Gus →
          </Link>
        </div>
      </div>
    </Card>
  )
}

export function FleetPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listMachines()
      .then((data) => {
        if (!cancelled) setMachines(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/" className="text-sm text-steel-400 hover:text-steel-200">
            &larr; Back to Gus
          </Link>
          <p className="mt-2 text-[11px] font-semibold tracking-wide text-steel-500 uppercase">Fleet</p>
          <h1 className="text-xl font-semibold text-steel-50">Your machines</h1>
        </div>
        <Link to="/machines/new">
          <Button variant="secondary" className="min-h-10 px-3 py-2 text-sm">
            + Add machine
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-danger-500/40 p-3 text-sm text-danger-500">
          Couldn&apos;t load machines: {error}
        </Card>
      )}

      {machines === null && !error && <p className="text-sm text-steel-400">Loading…</p>}

      {machines?.length === 0 && (
        <p className="text-sm text-steel-400">
          No machines yet —{' '}
          <Link to="/machines/new" className="text-tech-400 hover:underline">
            add a machine
          </Link>{' '}
          or ask Gus from the home screen.
        </p>
      )}

      {machines && machines.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {machines.map((machine) => (
            <MachineNameplate
              key={machine.id}
              machine={machine}
              onDeleted={(id) => setMachines((prev) => (prev ? prev.filter((m) => m.id !== id) : prev))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
