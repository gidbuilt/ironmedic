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
    <Card className="h-full overflow-hidden p-0 transition-colors hover:border-steel-600/90">
      <div className="flex h-full items-stretch">
        <div className={`w-1 shrink-0 ${isUnidentified ? 'bg-tech-400/55' : 'bg-safety-400'}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-w-0 flex-1">
            <Link
              to={`/machines/${machine.id}`}
              className="block min-w-0 flex-1 px-3.5 py-3.5 pr-11 transition-colors hover:bg-steel-800/50"
            >
              {isUnidentified ? (
                <>
                  <p className="truncate text-[10px] font-medium tracking-[0.14em] text-tech-400 uppercase">
                    Identifying…
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-steel-50">{machine.name}</p>
                </>
              ) : (
                <>
                  <p className="truncate text-[10px] font-medium tracking-[0.14em] text-steel-500 uppercase">
                    {machine.make}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-steel-50">{machine.model}</p>
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
              className="absolute top-2.5 right-2.5 rounded-xl p-1.5 text-steel-500 transition-colors hover:bg-danger-500/15 hover:text-danger-500 disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <Link
            to={`/machines/${machine.id}/repair`}
            className="border-t border-steel-800/80 px-3.5 py-2.5 text-xs font-medium text-tech-400 transition-colors hover:bg-steel-800/50 hover:text-tech-300"
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
    <div className="fade-up min-h-0 flex-1 space-y-5 overflow-y-auto pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Link to="/" className="im-pill !px-2.5">
            ← Back to Gus
          </Link>
          <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">Fleet</p>
          <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Equipment garage</h1>
          <p className="text-sm text-steel-400">Machines Gus knows about — profiles, logs, and repair history.</p>
        </div>
        <Link to="/machines/new">
          <Button variant="secondary" size="sm">
            + Add machine
          </Button>
        </Link>
      </div>

      {error && (
        <Card className="border-danger-500/40 p-4 text-sm text-danger-500">
          Couldn&apos;t load machines: {error}
        </Card>
      )}

      {machines === null && !error && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="im-skeleton h-24 rounded-2xl" />
          <div className="im-skeleton h-24 rounded-2xl" />
        </div>
      )}

      {machines?.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-steel-100">No machines yet</p>
          <p className="mt-1.5 text-sm text-steel-400">
            <Link to="/machines/new" className="font-medium text-tech-400 hover:underline">
              Add a machine
            </Link>{' '}
            or ask Gus from the home screen.
          </p>
        </Card>
      )}

      {machines && machines.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
