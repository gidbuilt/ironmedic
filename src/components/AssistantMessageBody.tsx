import { useMemo, useState } from 'react'
import { parseAssistantMessage, type AssistantSection } from '../lib/parseAssistantMessage'

const SECTION_META: Record<
  AssistantSection['kind'],
  { title: string; icon: string; card?: 'diagnosis' | 'next' }
> = {
  summary: { title: 'Summary', icon: '💬' },
  checks: { title: 'Things to Check', icon: '☑' },
  diagnosis: { title: 'Possible Diagnosis', icon: '⚠', card: 'diagnosis' },
  next: { title: 'Next Step', icon: '🔧', card: 'next' },
}

function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  return (
    <ul className="mt-2 space-y-2">
      {items.map((item, i) => {
        const on = Boolean(checked[i])
        return (
          <li key={`${i}-${item.slice(0, 24)}`}>
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[14px] leading-snug transition-colors
                ${
                  on
                    ? 'border-tech-400/40 bg-tech-400/10 text-steel-300 line-through decoration-steel-500'
                    : 'border-safety-400/35 bg-safety-400/10 text-steel-50 hover:border-safety-400/55'
                }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-steel-500 bg-steel-900 text-tech-400 focus:ring-tech-400/40"
              />
              <span>{item}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function SectionBlock({ section, showDivider }: { section: AssistantSection; showDivider: boolean }) {
  const meta = SECTION_META[section.kind]
  const cardClass =
    meta.card === 'diagnosis'
      ? 'rounded-xl border border-safety-400/35 bg-safety-400/10 px-3 py-3'
      : meta.card === 'next'
        ? 'rounded-xl border border-tech-400/40 bg-tech-400/10 px-3 py-3'
        : ''

  return (
    <div className={showDivider ? 'mt-3 border-t border-steel-700/80 pt-3' : ''}>
      <div className={cardClass || undefined}>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-widest text-steel-400 uppercase">
          <span aria-hidden className="text-[12px] normal-case tracking-normal">
            {meta.icon}
          </span>
          {meta.title}
        </div>

        {section.kind === 'checks' && section.items && section.items.length > 0 && (
          <Checklist items={section.items} />
        )}

        {section.kind === 'diagnosis' && section.items && section.items.length > 0 && (
          <ul className="mt-2 space-y-1.5 text-[14px] leading-snug text-steel-100">
            {section.items.map((item, i) => (
              <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2">
                <span className="shrink-0 text-safety-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {(section.kind === 'summary' || section.kind === 'next') && section.body && (
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-steel-100">{section.body}</p>
        )}
      </div>
    </div>
  )
}

export function AssistantMessageBody({ content }: { content: string }) {
  const sections = useMemo(() => parseAssistantMessage(content), [content])

  if (!content.trim()) return null

  if (sections.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>
  }

  // Single plain summary with no other sections — no heading chrome
  if (sections.length === 1 && sections[0].kind === 'summary') {
    return <span className="whitespace-pre-wrap">{sections[0].body}</span>
  }

  return (
    <div className="space-y-0 whitespace-normal">
      {sections.map((section, i) => (
        <SectionBlock key={`${section.kind}-${i}`} section={section} showDivider={i > 0} />
      ))}
    </div>
  )
}
