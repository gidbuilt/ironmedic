import type { Diagnosis } from '../types/database'
import { Card } from './ui/Card'
import { Button } from './ui/Button'

const SAFE_STYLES: Record<Diagnosis['safe_to_operate'], string> = {
  yes: 'bg-safe-500/15 text-safe-500 border-safe-500/40',
  caution: 'bg-caution-500/15 text-caution-500 border-caution-500/40',
  no: 'bg-danger-500/15 text-danger-500 border-danger-500/40',
  unknown: 'bg-steel-800 text-steel-300 border-steel-600',
}

const SAFE_LABEL: Record<Diagnosis['safe_to_operate'], string> = {
  yes: 'Safe to operate',
  caution: 'Operate with caution',
  no: 'Not safe to operate',
  unknown: 'Safety unclear',
}

function buildReportText(d: Diagnosis, machineLabel: string): string {
  const lines = [
    `IronMedic Diagnosis Report — ${d.tag_number}`,
    machineLabel,
    '',
    `Summary: ${d.summary}`,
    `Safe to operate: ${SAFE_LABEL[d.safe_to_operate]}`,
    `Confidence: ${d.confidence}`,
    '',
  ]
  if (d.outcome === 'no_fault_found') {
    lines.push('Outcome: Verified normal operation — no fault found.')
  } else {
    if (d.ranked_causes?.length) {
      lines.push('Ranked likely causes:')
      d.ranked_causes.forEach((c, i) =>
        lines.push(
          `  ${i + 1}. ${c.cause} (${c.likelihood}${c.confidence != null ? `, ${c.confidence}%` : ''}${c.reasoning ? ` — ${c.reasoning}` : ''})`,
        ),
      )
      lines.push('')
    }
    if (d.likely_parts?.length) {
      lines.push('Likely parts needed:')
      d.likely_parts.forEach((p) => lines.push(`  - ${p.name}${p.part_number ? ` (${p.part_number})` : ''}`))
      lines.push('')
    }
    if (d.repair_steps?.length) {
      lines.push('Repair procedure:')
      d.repair_steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`))
      lines.push('')
    }
  }
  if (d.verification_steps?.length) {
    lines.push('Verify the fix:')
    d.verification_steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`))
    lines.push('')
  }
  lines.push('This is AI-assisted guidance from IronMedic, not a substitute for a qualified in-person inspection.')
  return lines.join('\n')
}

export function DiagnosisCard({
  diagnosis,
  machineLabel,
  onCopied,
}: {
  diagnosis: Diagnosis
  machineLabel: string
  onCopied?: () => void
}) {
  const isNoFault = diagnosis.outcome === 'no_fault_found'

  async function handleCopy() {
    await navigator.clipboard.writeText(buildReportText(diagnosis, machineLabel))
    onCopied?.()
  }

  return (
    <Card accent="yellow" className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-steel-800 pb-3">
        <span className="font-mono text-xs font-semibold tracking-widest text-safety-400 uppercase">
          Diagnosis Report
        </span>
        <span className="font-mono text-xs text-steel-500">{diagnosis.tag_number}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${SAFE_STYLES[diagnosis.safe_to_operate]}`}>
          {SAFE_LABEL[diagnosis.safe_to_operate]}
        </span>
        <span className="rounded-xl border border-steel-600 bg-steel-800 px-2.5 py-1 font-mono text-xs text-steel-300">
          Confidence: {diagnosis.confidence}
        </span>
      </div>

      <p className="font-semibold text-steel-50">{diagnosis.summary}</p>

      {isNoFault ? (
        <p className="mt-3 text-steel-300">
          Verified normal operation — no fault found. Sometimes the machine really is working the way it's supposed to.
        </p>
      ) : (
        <>
          {diagnosis.ranked_causes?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-steel-300">Ranked likely causes</p>
              <ol className="mt-1.5 flex flex-col gap-1.5">
                {diagnosis.ranked_causes.map((c, i) => (
                  <li key={i} className="text-sm text-steel-200">
                    <span className="font-medium">{c.cause}</span>{' '}
                    <span className="text-steel-400">
                      ({c.likelihood}
                      {c.confidence != null ? `, ${c.confidence}%` : ''})
                    </span>
                    {c.reasoning && <span className="text-steel-400"> — {c.reasoning}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {diagnosis.likely_parts?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-steel-300">Likely parts</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {diagnosis.likely_parts.map((p, i) => (
                  <li key={i} className="text-sm text-steel-200">
                    {p.name}
                    {p.part_number && <span className="text-steel-400"> ({p.part_number})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diagnosis.repair_steps?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-steel-300">Repair procedure</p>
              <ol className="mt-1.5 flex flex-col gap-1.5">
                {diagnosis.repair_steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-steel-200">
                    <span className="shrink-0 font-mono text-tech-400">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {diagnosis.verification_steps?.length > 0 && (
        <div className="mt-4 rounded-xl border border-tech-400/30 bg-tech-400/5 p-3">
          <p className="text-sm font-semibold text-tech-300">Verify the fix</p>
          <ol className="mt-1.5 flex flex-col gap-1.5">
            {diagnosis.verification_steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-steel-200">
                <span className="shrink-0 font-mono text-tech-400">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-4 text-xs text-steel-500">
        This is AI-assisted guidance, not a substitute for a qualified in-person inspection. Default to caution.
      </p>

      <div className="mt-4">
        <Button variant="secondary" className="min-h-9 px-3 py-2 text-sm" onClick={handleCopy}>
          Copy / share report
        </Button>
      </div>
    </Card>
  )
}
