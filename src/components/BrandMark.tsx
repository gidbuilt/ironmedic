import { GUS_AVATAR_URL } from '../lib/gusAssets'

type BrandMarkSize = 'nav' | 'hero'

const sizeStyles: Record<
  BrandMarkSize,
  { wrap: string; markWrap: string; mark: string; word: string; tag: string; showTag: boolean }
> = {
  nav: {
    wrap: 'gap-3',
    markWrap:
      'relative shrink-0 rounded-[0.85rem] p-[2px] bg-gradient-to-br from-safety-400/80 via-safety-400/25 to-tech-400/55 shadow-[0_0_24px_rgba(255,199,44,0.18)]',
    mark: 'h-9 w-9 rounded-[0.7rem] sm:h-10 sm:w-10 sm:rounded-[0.8rem]',
    word: 'text-[1.4rem] leading-none tracking-[0.05em] sm:text-[1.55rem]',
    tag: 'text-[9px] tracking-[0.18em]',
    showTag: true,
  },
  hero: {
    wrap: 'gap-3.5',
    markWrap:
      'relative shrink-0 rounded-[1.15rem] p-[2.5px] bg-gradient-to-br from-safety-400 via-safety-400/40 to-tech-400/70 shadow-[0_8px_32px_rgba(255,199,44,0.22)]',
    mark: 'h-14 w-14 rounded-2xl sm:h-16 sm:w-16',
    word: 'text-[2.35rem] leading-none tracking-[0.05em] sm:text-[2.75rem]',
    tag: 'text-[10px] tracking-[0.22em]',
    showTag: true,
  },
}

/**
 * App brand lockup: Gus mark + clean IRON/MEDIC wordmark.
 */
export function BrandMark({
  size = 'nav',
  className = '',
  showTagline,
}: {
  size?: BrandMarkSize
  className?: string
  showTagline?: boolean
}) {
  const s = sizeStyles[size]
  const tag = showTagline ?? s.showTag

  return (
    <div className={`inline-flex items-center ${s.wrap} ${className}`}>
      <div className={s.markWrap}>
        <img
          src={GUS_AVATAR_URL}
          alt=""
          className={`${s.mark} block border border-steel-950/80 object-cover bg-steel-900`}
          draggable={false}
        />
      </div>
      <div className="min-w-0">
        <p className={`font-display select-none ${s.word}`} aria-label="IronMedic">
          <span className="text-steel-50">IRON</span>
          <span className="text-safety-400">MEDIC</span>
        </p>
        {tag && (
          <p
            className={`mt-1 flex items-center gap-1.5 font-mono uppercase text-steel-400 ${s.tag}`}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-tech-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tech-400" />
            </span>
            <span className="text-tech-300/95">Ask Gus</span>
          </p>
        )}
      </div>
    </div>
  )
}
