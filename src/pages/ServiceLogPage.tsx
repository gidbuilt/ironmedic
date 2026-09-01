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
  pending: 'bg-steel-700/80 text-steel-300',
  fixed: 'bg-safe-500/15 text-safe-500',
  not_fixed: 'bg-danger-500/15 text-danger-500',
  no_fault_found: 'bg-steel-700/80 text-steel-300',
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
    <Card accent={overdue ? 'yellow' : 'none'} className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-steel-50">
            Did fixing &ldquo;{diagnosis.summary}&rdquo; resolve it?
          </p>
          <p className="mt-1 font-mono text-xs text-steel-500">
            {diagnosis.tag_number} · {new Date(diagnosis.created_at).toLocaleDateString()}
          </p>
        </div>
        {overdue && (
          <span className="shrink-0 rounded-full bg-safety-400/20 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-safety-400 uppercase">
            Follow up
          </span>
        )}
      </div>
      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="e.g. Replaced the thermostat, ran it under load — still overheating"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1"
        />
        <Button className="shrink-0" onClick={report}>
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
    <div className="fade-up mx-auto max-w-2xl space-y-5 pb-10">
      <div className="space-y-1.5">
        <Link to={`/machines/${machineId}`} className="im-pill !px-2.5">
          ← {machine?.name ?? 'Machine'}
        </Link>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-steel-500 uppercase">
          Service history
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-steel-50">Service Log</h1>
      </div>

      {error && <Card className="border-danger-500/40 p-4 text-sm text-danger-500">{error}</Card>}

      {diagnoses === null && !error && (
        <div className="space-y-2.5">
          <div className="im-skeleton h-28 rounded-2xl" />
          <div className="im-skeleton h-20 rounded-2xl" />
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          {pending.map((d) => (
            <FollowupPrompt key={d.id} diagnosis={d} machineId={machineId!} />
          ))}
        </div>
      )}

      {diagnoses?.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-steel-100">No diagnoses yet</p>
          <p className="mt-1.5 text-sm text-steel-400">
            Once you talk to Gus about an issue, it&apos;ll show up here.
          </p>
          <Link to={`/machines/${machineId}/repair`} className="mt-4 inline-block">
            <Button size="sm">Start repair chat</Button>
          </Link>
        </Card>
      )}

      {resolved.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {resolved.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-steel-100">{d.summary}</p>
                  <p className="mt-1 font-mono text-xs text-steel-500">
                    {d.tag_number} · {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${OUTCOME_STYLE[d.outcome]}`}
                >
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
