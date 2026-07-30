import { useEffect, type ReactNode } from 'react'
import { Card } from './Card'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="tech-grid fixed inset-0 z-50 flex items-center justify-center bg-steel-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        accent="tech"
        className="w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between border-b border-steel-800 pb-3">
          <h2 className="font-mono text-xs font-semibold tracking-widest text-tech-400 uppercase">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-steel-400 hover:bg-steel-800 hover:text-steel-100"
          >
            ✕
          </button>
        </div>
        {children}
      </Card>
    </div>
  )
}
