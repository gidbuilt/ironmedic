import { useMemo, useState } from 'react'
import { parseAssistantMessage } from '../lib/parseAssistantMessage'
import {
  buildNextStepAnswers,
  isDisclaimer,
  isUsableNextStepQuestion,
  nextStepDisplayText,
  type NextStepAnswers,
} from '../lib/nextStepAnswers'
import type { DifferentialEntry } from '../types/database'

function briefLabel(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function parseDiagnosisItem(raw: string): { label: string; confidence: number | null } {
  const trimmed = raw.trim()
  const m = trimmed.match(/^(.*?)(?:\s*[—\-–:·|(]+\s*|\s+)(\d{1,3})\s*%\s*\)?\s*$/)
  if (m) {
    const pct = Number(m[2])
    if (pct >= 1 && pct <= 99) {
      return { label: m[1].replace(/[\s(—\-–:·|]+$/, '').trim(), confidence: pct }
    }
  }
  return { label: trimmed, confidence: null }
}

function normalizeCause(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchConfidence(
  label: string,
  index: number,
  total: number,
  differential?: DifferentialEntry[] | null,
): number {
  const parsed = parseDiagnosisItem(label)
  if (parsed.confidence != null) return parsed.confidence

  if (differential && differential.length > 0) {
    const needle = normalizeCause(parsed.label)
    const exact = differential.find((d) => normalizeCause(d.cause) === needle)
    if (exact) return Math.round(exact.confidence)

    const partial = differential.find((d) => {
      const c = normalizeCause(d.cause)
      return c.includes(needle) || needle.includes(c)
    })
    if (partial) return Math.round(partial.confidence)

    if (differential[index]) return Math.round(differential[index].confidence)
  }

  if (total <= 1) return 70
  if (index === 0) return 65
  if (index === 1) return 40
  return Math.max(20, 55 - index * 15)
}

function DiagnosisList({
  items,
  differential,
}: {
  items: string[]
  differential?: DifferentialEntry[] | null
}) {
  const limited = items.slice(0, 3)
  if (!limited.length) return null

  return (
    <div className="rounded-xl border border-safe-500/45 bg-safe-500/15 px-3 py-3">
      <div className="font-mono text-[10px] font-semibold tracking-widest text-safe-500 uppercase">
        Possible diagnoses
      </div>
      <ul className="mt-2 space-y-2">
        {limited.map((item, i) => {
          const { label } = parseDiagnosisItem(item)
          const confidence = matchConfidence(item, i, limited.length, differential)
          return (
            <li
              key={`${i}-${label.slice(0, 24)}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-safe-500/25 bg-steel-950/35 px-2.5 py-2"
            >
              <span className="min-w-0 flex-1 text-[14px] leading-snug text-steel-50">
                {briefLabel(label)}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-safe-500 tabular-nums">
                {confidence}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function NextStepCard({
  body,
  answerBlock,
  onSelectAnswer,
  answersDisabled,
}: {
  body: string
  answerBlock: NextStepAnswers
  onSelectAnswer?: (text: string) => void
  answersDisabled?: boolean
}) {
  const [howToOpen, setHowToOpen] = useState(false)
  const text = useMemo(() => nextStepDisplayText(body, answerBlock), [body, answerBlock])
  const howTo = answerBlock.howTo
  const chips = answerBlock.answers

  return (
    <div className="rounded-2xl border border-tech-400/40 bg-tech-400/10 px-3.5 py-3">
      <div className="font-mono text-[10px] font-semibold tracking-[0.16em] text-tech-300 uppercase">
        Next step
      </div>
      <p className="mt-1.5 text-[15px] font-medium leading-snug text-steel-50">{text}</p>

      {howTo && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setHowToOpen((o) => !o)}
            className="text-left text-[12px] font-medium text-tech-300 underline decoration-tech-400/40 underline-offset-2 hover:text-tech-200"
          >
            {howToOpen ? 'Hide how-to' : 'How do I do this?'}
          </button>
          {howToOpen && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-steel-300">
              {howTo}
            </p>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {chips.map((a, i) => (
            <li key={`${i}-${a.label.slice(0, 24)}`}>
              {onSelectAnswer && !answersDisabled ? (
                <button
                  type="button"
                  onClick={() => onSelectAnswer(a.send)}
                  className="w-full whitespace-normal break-words rounded-xl border border-safety-400/35 bg-steel-950/50 px-3 py-2.5 text-left text-[14px] leading-snug text-steel-50 transition-colors hover:border-safety-400/65 hover:bg-safety-400/12 active:scale-[0.99]"
                >
                  {a.label}
                </button>
              ) : (
                <div className="whitespace-normal break-words rounded-xl border border-steel-600/70 bg-steel-800/70 px-3 py-2.5 text-[14px] leading-snug text-steel-200">
                  {a.label}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AssistantMessageBody({
  content,
  onSelectCheck,
  checksDisabled,
  differential,
  diagnosisReportMode,
}: {
  content: string
  /** Sends a tapped Next Step answer as the user's message. */
  onSelectCheck?: (item: string) => void
  checksDisabled?: boolean
  differential?: DifferentialEntry[] | null
  /** When a diagnosis report card follows, hide redundant probability / next-step UI. */
  diagnosisReportMode?: boolean
}) {
  const sections = useMemo(() => parseAssistantMessage(content), [content])

  if (!content.trim()) return null

  if (sections.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>
  }

  if (sections.length === 1 && sections[0].kind === 'summary') {
    return <span className="whitespace-pre-wrap">{sections[0].body}</span>
  }

  const summary = sections.find((s) => s.kind === 'summary')?.body
  const next = sections.find((s) => s.kind === 'next' && s.body)
  const checks = sections.find((s) => s.kind === 'checks')
  const diagnosis = sections.find((s) => s.kind === 'diagnosis')

  const diagnosisItems = (diagnosis?.items ?? []).slice(0, 3)
  const answerBlock = buildNextStepAnswers(next?.body, checks?.items ?? [], summary ?? '')
  const usableBlock =
    answerBlock && isUsableNextStepQuestion(answerBlock.question) && !isDisclaimer(answerBlock.question)
      ? answerBlock
      : null

  const nextBody =
    next?.body ||
    (usableBlock
      ? `${usableBlock.question} → ${usableBlock.answers.map((a) => a.label).join(' | ')}`
      : undefined)

  // If Next Step was only legalese, don't show a fake card — leave Summary/Diagnosis
  const showNextCard =
    !diagnosisReportMode && Boolean(usableBlock && nextBody && !isDisclaimer(nextBody))

  return (
    <div className="space-y-3 whitespace-normal">
      {summary && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-steel-100">{summary}</p>
      )}

      {!diagnosisReportMode && (
        <DiagnosisList items={diagnosisItems} differential={differential} />
      )}

      {showNextCard && usableBlock && (
        <NextStepCard
          body={nextBody!}
          answerBlock={usableBlock}
          onSelectAnswer={onSelectCheck}
          answersDisabled={checksDisabled}
        />
      )}
    </div>
  )
}
