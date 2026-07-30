import type { DiagnosticStage } from '../types/database'

const STAGE_LABEL: Record<DiagnosticStage, string> = {
  verify: 'Asking the operator',
  theory: 'Knowing the system',
  narrow: 'Narrowing it down',
  inspect: 'Targeted check',
  diagnosis: 'Reaching a conclusion',
  test: 'Testing the conclusion',
  verify_fix: 'Confirming the fix',
}

/**
 * A quiet, single-line indicator of where Gus is at internally — not a
 * numbered wizard. The conversation itself is the primary UI now; this is
 * just a small ambient cue, not a gate the user has to watch progress bars
 * move through.
 */
export function StageStepper({ activeStage }: { activeStage?: DiagnosticStage | null }) {
  if (!activeStage) return null

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-steel-500 uppercase">
      <span className="status-pulse h-1.5 w-1.5 rounded-full bg-tech-400" />
      {STAGE_LABEL[activeStage]}
    </div>
  )
}
