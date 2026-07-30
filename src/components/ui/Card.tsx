import type { HTMLAttributes } from 'react'

type Accent = 'none' | 'yellow' | 'tech'

const accentBorder: Record<Accent, string> = {
  none: 'border-steel-700',
  yellow: 'border-safety-400/30',
  tech: 'border-tech-400/30',
}

const accentBar: Record<Accent, string> = {
  none: '',
  yellow: 'before:bg-safety-400',
  tech: 'before:bg-tech-400',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a soft top accent bar — use sparingly for the one or two most
   * important panels on a screen (e.g. a diagnosis report, a machine's
   * spec plate), not as a default. */
  accent?: Accent
}

export function Card({ className = '', accent = 'none', ...props }: CardProps) {
  return (
    <div
      className={`relative rounded-2xl border bg-steel-900 shadow-[0_4px_24px_rgba(0,0,0,0.45)]
        ${accentBorder[accent]}
        ${accent !== 'none' ? `before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-2xl ${accentBar[accent]}` : ''}
        ${className}`}
      {...props}
    />
  )
}
