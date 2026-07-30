import { useState } from 'react'
import type { DifferentialEntry } from '../types/database'
import { Card } from './ui/Card'

function textColor(confidence: number): string {
  if (confidence >= 65) return 'text-safety-400'
  if (confidence >= 35) return 'text-tech-300'
  return 'text-steel-400'
}

function barColor(confidence: number): string {
  if (confidence >= 65) return 'bg-safety-400'
  if (confidence >= 35) return 'bg-tech-400'
  return 'bg-steel-500'
}

/**
 * Live, continuously-updated ranked differential — Gus's "current
 * thinking." Collapsed to a single compact line by default (just the top
 * hypothesis) since the full bar list was taking up too much of the
 * screen; expand for the rest. Dismissible with the × — reappears
 * collapsed the next time Gus actually updates his thinking (new content
 * remounts this component via the `key` passed from the parent), but
 * won't pop back open just because of a re-render.
 */
export function DifferentialPanel({ entries }: { entries: DifferentialEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!entries || entries.length === 0 || dismissed) return null

  const top = entries[0]
  const rest = entries.slice(1)

  return (
    <Card accent="tech" className="overflow-hidden p-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="status-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-tech-400" />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="shrink-0 font-mono text-[10px] font-semibold tracking-widest text-tech-400 uppercase">
            Thinking
          </span>
          <span className="truncate text-sm text-steel-200">{top.cause}</span>
          <span className={`ml-auto shrink-0 font-mono text-xs font-semibold ${textColor(top.confidence)}`}>
            {top.confidence}%
          </span>
          <span className="shrink-0 text-steel-500">{expanded ? '\u25B4' : '\u25BE'}</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded px-1 text-steel-500 hover:text-steel-200"
        >
          ×
        </button>
      </div>

      {expanded && (
        <ul className="flex flex-col gap-2.5 border-t border-steel-800 px-3 py-3">
          {entries.map((entry, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-steel-100">{entry.cause}</span>
                <span className={`shrink-0 font-mono text-xs font-semibold ${textColor(entry.confidence)}`}>
                  {entry.confidence}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-steel-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(entry.confidence)}`}
                  style={{ width: `${entry.confidence}%` }}
                />
              </div>
              {entry.rationale && <p className="mt-1 text-xs text-steel-500">{entry.rationale}</p>}
            </li>
          ))}
          {rest.length === 0 && <li className="text-xs text-steel-500">No other live hypotheses right now.</li>}
        </ul>
      )}
    </Card>
  )
}
