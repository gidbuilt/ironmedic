import type { HTMLAttributes } from 'react'

type Accent = 'none' | 'yellow' | 'tech'

const accentBorder: Record<Accent, string> = {
  none: 'border-steel-700/70',
  yellow: 'border-safety-400/35',
  tech: 'border-tech-400/35',
}

const accentBar: Record<Accent, string> = {
  none: '',
  yellow: 'before:bg-safety-400',
  tech: 'before:bg-tech-400',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Soft top accent — use sparingly for key panels. */
  accent?: Accent
}

export function Card({ className = '', accent = 'none', ...props }: CardProps) {
  return (
    <div
      className={`relative rounded-2xl border bg-steel-900/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)]
        backdrop-blur-sm
        ${accentBorder[accent]}
        ${accent !== 'none' ? `before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-2xl ${accentBar[accent]}` : ''}
        ${className}`}
      {...props}
    />
  )
}
