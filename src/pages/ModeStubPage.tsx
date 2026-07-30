import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const COPY: Record<string, { title: string; body: string }> = {
  'pre-purchase': {
    title: 'Pre-Purchase Inspection',
    body: 'A checklist-driven walk-around for a machine you\'re considering buying — pass/fail/notes/photo per item, then a summary report. Coming after Repair Diagnosis is solid.',
  },
  routine: {
    title: 'Routine Inspection',
    body: 'A scheduled, preventive walk-around checklist for machines you already own. Coming after Repair Diagnosis and Pre-Purchase Inspection are solid.',
  },
}

export function ModeStubPage() {
  const { id, mode = 'pre-purchase' } = useParams<{ id: string; mode: string }>()
  const copy = COPY[mode] ?? COPY['pre-purchase']

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={`/machines/${id}`} className="mb-4 inline-block text-sm text-steel-400 hover:text-steel-200">
        &larr; Back to machine
      </Link>
      <Card className="p-6">
        <p className="font-mono text-[11px] font-semibold tracking-widest text-steel-500 uppercase">Diagnostic mode</p>
        <h1 className="text-2xl font-semibold text-steel-50">{copy.title}</h1>
        <p className="mt-2 text-steel-400">{copy.body}</p>
        <div className="mt-6">
          <Link to={`/machines/${id}`}>
            <Button variant="secondary">Back to machine</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
