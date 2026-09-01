import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string | null
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className = '', id, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="font-mono text-[11px] font-medium tracking-wider text-steel-400 uppercase">
          {label}
        </span>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`im-field min-h-24 ${error ? '!border-danger-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-danger-500">{error}</span>}
    </label>
  )
})
