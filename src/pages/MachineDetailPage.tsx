import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteMachine, getMachine, updateMachine } from '../lib/machines'
import type { Machine } from '../types/database'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { ManualsSection } from '../components/ManualsSection'

const MODES = [
  {
    id: 'repair',
    title: 'Repair Diagnosis',
    description: "Something's wrong — work through it with Gus, step by step.",
    available: true,
  },
  {
    id: 'pre-purchase',
    title: 'Pre-Purchase Inspection',
    description: 'Thinking about buying this machine? Run the checklist first.',
    available: false,
  },
  {
    id: 'routine',
    title: 'Routine Inspection',
    description: 'Scheduled walk-around and preventive checks.',
    available: false,
  },
] as const

export function MachineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getMachine(id).then(setMachine).catch((err) => setError(err.message))
  }, [id])

  if (error) {
    return (
      <div className="fade-up space-y-4">
        <Link to="/machines" className="im-pill !px-2.5">
          ← Fleet
        </Link>
        <Card className="border-danger-500/40 p-4 text-sm text-danger-500">{error}</Card>
      </div>
    )
  }

  if (!machine) {
    return (
      <div className="fade-up space-y-4">
        <div className="im-skeleton h-8 w-28 rounded-full" />
        <div className="im-skeleton h-40 rounded-2xl" />
        <div className="im-skeleton h-28 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="fade-up flex flex-col gap-6 pb-10">
      <div className="space-y-1.5">
        <Link to="/machines" className="im-pill !px-2.5">
          ← Fleet
        </Link>
      </div>

      <Card accent="tech" className="p-5 sm:p-6">
        {editing ? (
          <EditMachineForm
            machine={machine}
            onSaved={(m) => {
              setMachine(m)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-tech-400 uppercase">
                  Equipment record
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-steel-50">
                  {machine.name}
                </h1>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Delete ${machine.name}? This can't be undone.`)) return
                    await deleteMachine(machine.id)
                    navigate('/machines')
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-steel-700/80 bg-steel-700/80 sm:grid-cols-4">
              {[
                { label: 'Make', value: machine.make || '—' },
                { label: 'Model', value: machine.model || '—' },
                { label: 'Serial', value: machine.serial_number || '—' },
                { label: 'Hours', value: machine.hours != null ? machine.hours : '—' },
              ].map((f) => (
                <div key={f.label} className="bg-steel-900/95 px-3.5 py-3 sm:px-4">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-steel-500 uppercase">
                    {f.label}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-sm font-semibold text-steel-100">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[10px] font-semibold tracking-[0.18em] text-steel-500 uppercase">
            Diagnostic modes
          </h2>
          <Link
            to={`/machines/${machine.id}/log`}
            className="text-sm font-medium text-steel-400 transition-colors hover:text-tech-300"
          >
            Service Log →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {MODES.map((mode) =>
            mode.available ? (
              <Link key={mode.id} to={`/machines/${machine.id}/${mode.id}`} className="group">
                <Card className="h-full p-5 transition-colors group-hover:border-safety-400/45">
                  <p className="font-semibold text-steel-50">{mode.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-steel-400">{mode.description}</p>
                  <p className="mt-3 text-xs font-medium text-safety-400 group-hover:text-safety-300">
                    Start with Gus →
                  </p>
                </Card>
              </Link>
            ) : (
              <Card key={mode.id} className="h-full p-5 opacity-55">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-steel-50">{mode.title}</p>
                  <span className="shrink-0 rounded-full bg-steel-800 px-2 py-0.5 font-mono text-[10px] tracking-wide text-steel-400 uppercase">
                    Soon
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-steel-400">{mode.description}</p>
              </Card>
            ),
          )}
        </div>
      </div>

      <ManualsSection machineId={machine.id} />
    </div>
  )
}

function EditMachineForm({
  machine,
  onSaved,
  onCancel,
}: {
  machine: Machine
  onSaved: (m: Machine) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(machine.name)
  const [make, setMake] = useState(machine.make)
  const [model, setModel] = useState(machine.model)
  const [serialNumber, setSerialNumber] = useState(machine.serial_number ?? '')
  const [hours, setHours] = useState(machine.hours?.toString() ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateMachine(machine.id, {
        name,
        make,
        model,
        serial_number: serialNumber || null,
        hours: hours ? Number(hours) : null,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Nickname" required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Input label="Make" required value={make} onChange={(e) => setMake(e.target.value)} />
        <Input label="Model" required value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <Input label="Serial number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
      <Input label="Hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
      {error && <p className="text-sm text-danger-500">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
