import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMachine } from '../lib/machines'
import { isOverdueForFollowup, listDiagnoses } from '../lib/diagnoses'
import type { Diagnosis, Machine } from '../types/database'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const OUTCOME_LABEL: Record<Diagnosis['outcome'], string> = {
  pending: 'Awaiting outcome',
  fixed: 'Fixed',
  not_fixed: "Didn't fix it",
  no_fault_found: 'No fault found',
}

const OUTCOME_STYLE: Record<Diagnosis['outcome'], string> = {
  pending: 'bg-steel-700 text-steel-300',
  fixed: 'bg-safe-500/15 text-safe-500',
  not_fixed: 'bg-danger-500/15 text-danger-500',
  no_fault_found: 'bg-steel-700 text-steel-300',
}

function FollowupPrompt({ diagnosis, machineId }: { diagnosis: Diagnosis; machineId: string }) {
  const [text, setText] = useState('')
  const navigate = useNavigate()
  const overdue = isOverdueForFollowup(diagnosis)

  function report() {
    const message = text.trim() || `About the "${diagnosis.summary}" diagnosis — here's what happened.`
    navigate(`/machines/${machineId}/repair`, { state: { prefillMessage: message } })
  }

  return (
    <Card accent={overdue ? 'yellow' : 'none'} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-steel-50">Did fixing "{diagnosis.summary}" resolve it?</p>
          <p className="mt-1 font-mono text-xs text-steel-500">
            {diagnosis.tag_number} · {new Date(diagnosis.created_at).toLocaleDateString()}
          </p>
        </div>
        {overdue && (
          <span className="shrink-0 rounded-xl bg-safety-400/20 px-2.5 py-1 text-xs font-semibold text-safety-400 uppercase tracking-wide">
            Awaiting your answer
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="e.g. Replaced the thermostat, ran it under load — still overheating"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1"
        />
        <Button className="min-h-12 shrink-0" onClick={report}>
          Tell Gus
        </Button>
      </div>
    </Card>
  )
}

export function ServiceLogPage() {
  const { id: machineId } = useParams<{ id: string }>()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [diagnoses, setDiagnoses] = useState<Diagnosis[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!machineId) return
    Promise.all([getMachine(machineId), listDiagnoses(machineId)])
      .then(([m, d]) => {
        setMachine(m)
        setDiagnoses(d)
      })
      .catch((err) => setError(err.message))
  }, [machineId])

  const pending = diagnoses?.filter((d) => d.outcome === 'pending') ?? []
  const resolved = diagnoses?.filter((d) => d.outcome !== 'pending') ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={`/machines/${machineId}`} className="mb-4 inline-block text-sm text-steel-400 hover:text-steel-200">
        &larr; {machine?.name ?? 'Back to machine'}
      </Link>
      <p className="font-mono text-[11px] font-semibold tracking-widest text-steel-500 uppercase">Service history</p>
      <h1 className="mb-6 text-2xl font-semibold text-steel-50">Service Log</h1>

      {error && <Card className="border-danger-500/40 p-4 text-danger-500">{error}</Card>}

      {pending.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {pending.map((d) => (
            <FollowupPrompt key={d.id} diagnosis={d} machineId={machineId!} />
          ))}
        </div>
      )}

      {diagnoses?.length === 0 && (
        <Card className="p-8 text-center text-steel-400">
          No diagnoses yet — once you talk to Gus about an issue, it'll show up here.
        </Card>
      )}

      {resolved.length > 0 && (
        <div className="flex flex-col gap-3">
          {resolved.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-steel-100">{d.summary}</p>
                  <p className="mt-1 font-mono text-xs text-steel-500">
                    {d.tag_number} · {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${OUTCOME_STYLE[d.outcome]}`}>
                  {OUTCOME_LABEL[d.outcome]}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
