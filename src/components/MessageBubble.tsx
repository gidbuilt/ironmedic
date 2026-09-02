import type { ReactNode } from 'react'
import { GUS_AVATAR_URL } from '../lib/gusAssets'
import type { DifferentialEntry } from '../types/database'
import { AssistantMessageBody } from './AssistantMessageBody'

export function MessageBubble({
  role,
  children,
  content,
  streaming,
  onSelectCheck,
  differential,
  diagnosisReportMode,
}: {
  role: 'user' | 'assistant'
  children?: ReactNode
  content?: string
  streaming?: boolean
  onSelectCheck?: (item: string) => void
  differential?: DifferentialEntry[] | null
  diagnosisReportMode?: boolean
}) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[1.25rem] rounded-tr-md bg-safety-400 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-steel-950 shadow-[0_4px_20px_rgba(255,199,44,0.18)]">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-start gap-2.5">
      <img
        src={GUS_AVATAR_URL}
        alt="Gus"
        className="mb-0.5 h-8 w-8 shrink-0 rounded-full border border-steel-700/80 object-cover shadow-md"
      />
      <div
        className={`relative max-w-[85%] overflow-hidden rounded-[1.25rem] rounded-bl-md border bg-steel-900/92 px-4 py-3 text-[15px] leading-relaxed text-steel-100 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md
          ${streaming ? 'border-tech-400/45' : 'border-steel-700/60'}`}
      >
        {streaming && <div className="scan-sweep" />}
        {children}
        {content != null && content !== '' && (
          <AssistantMessageBody
            content={content}
            onSelectCheck={onSelectCheck}
            checksDisabled={streaming}
            differential={differential}
            diagnosisReportMode={diagnosisReportMode}
          />
        )}
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-tech-400 align-middle" />
        )}
      </div>
    </div>
  )
}
