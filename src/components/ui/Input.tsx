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
        <span className="font-mono text-xs font-medium tracking-wide text-steel-400 uppercase">{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`min-h-12 rounded-xl border border-steel-600 bg-steel-800 px-4 py-3 text-base
          text-steel-50 placeholder:text-steel-500 outline-none transition-colors
          focus:border-tech-400 ${error ? 'border-danger-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-danger-500">{error}</span>}
    </label>
  )
})
