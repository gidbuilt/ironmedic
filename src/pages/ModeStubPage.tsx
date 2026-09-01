import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const COPY: Record<string, { title: string; body: string }> = {
  'pre-purchase': {
    title: 'Pre-Purchase Inspection',
    body: "A checklist-driven walk-around for a machine you're considering buying — pass/fail/notes/photo per item, then a summary report. Coming after Repair Diagnosis is solid.",
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
    <div className="fade-up mx-auto max-w-2xl space-y-5 pb-10">
      <Link to={`/machines/${id}`} className="im-pill !px-2.5">
        ← Back to machine
      </Link>
      <Card className="p-6 sm:p-7">
        <div className="mb-3 inline-flex rounded-full bg-steel-800 px-2.5 py-1 font-mono text-[10px] tracking-wide text-steel-400 uppercase">
          Coming soon
        </div>
        <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-steel-500 uppercase">
          Diagnostic mode
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-steel-50">{copy.title}</h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-steel-400">{copy.body}</p>
        <div className="mt-6">
          <Link to={`/machines/${id}`}>
            <Button variant="secondary" size="sm">
              Back to machine
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
