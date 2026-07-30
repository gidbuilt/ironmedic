import type { ReactNode } from 'react'
import { GUS_AVATAR_URL } from '../lib/gusAssets'

export function MessageBubble({
  role,
  children,
  streaming,
}: {
  role: 'user' | 'assistant'
  children: ReactNode
  streaming?: boolean
}) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-safety-400 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-steel-950">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-start gap-2">
      <img src={GUS_AVATAR_URL} alt="Gus" className="mb-1 h-7 w-7 shrink-0 rounded-full object-cover" />
      <div
        className={`relative max-w-[85%] overflow-hidden rounded-2xl rounded-bl-sm border bg-steel-900 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-steel-100
          ${streaming ? 'border-tech-400/50' : 'border-steel-700'}`}
      >
        {streaming && <div className="scan-sweep" />}
        {children}
        {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-tech-400 align-middle" />}
      </div>
    </div>
  )
}
