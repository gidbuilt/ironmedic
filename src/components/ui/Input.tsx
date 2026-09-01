import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | null
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-steel-400 uppercase">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`im-field ${error ? '!border-danger-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-danger-500">{error}</span>}
    </label>
  )
})
