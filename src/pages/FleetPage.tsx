import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMachines } from '../lib/machines'
import type { Machine } from '../types/database'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function MachineNameplate({ machine }: { machine: Machine }) {
  const isUnidentified = !machine.make.trim() || !machine.model.trim()
  const makeModel = `${machine.make} ${machine.model}`
  const hasCustomName =
    machine.name &&
    !isUnidentified &&
    machine.name !== makeModel &&
    machine.name !== machine.model &&
    machine.name !== machine.make

  return (
    <Card className="group h-full overflow-hidden p-0 transition-colors hover:border-tech-400/50">
      <div className="flex h-full items-stretch">
        <div
          className={`w-1.5 shrink-0 transition-colors group-hover:bg-tech-400 ${isUnidentified ? 'bg-tech-400/50' : 'bg-safety-400'}`}
        />
        <div className="flex flex-1 flex-col justify-between gap-2 px-3 py-3">
          <div className="min-w-0">
            {isUnidentified ? (
              <>
                <p className="truncate text-[10px] font-medium tracking-wide text-tech-400 uppercase">Identifying…</p>
                <p className="truncate text-sm font-semibold text-steel-50">{machine.name}</p>
              </>
            ) : (
              <>
                <p className="truncate text-[10px] font-medium tracking-wide text-steel-500 uppercase">{machine.make}</p>
                <p className="truncate text-sm font-semibold text-steel-50">{machine.model}</p>
              </>
            )}
            {hasCustomName && <p className="mt-0.5 truncate text-xs text-steel-400">&ldquo;{machine.name}&rdquo;</p>}
          </div>
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
        <Card className="border-danger-500/40 p-3 text-sm text-danger-500">Couldn't load machines: {error}</Card>
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
            <Link key={machine.id} to={`/machines/${machine.id}`}>
              <MachineNameplate machine={machine} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
