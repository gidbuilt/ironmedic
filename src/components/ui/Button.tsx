import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-safety-400 text-steel-950 hover:bg-safety-300 active:bg-safety-500 shadow-[0_2px_16px_rgba(255,199,44,0.25)]',
  secondary: 'bg-steel-800 text-steel-100 hover:bg-steel-700 border border-steel-600',
  ghost: 'bg-transparent text-steel-200 hover:bg-steel-800',
  danger: 'bg-transparent text-danger-500 hover:bg-danger-500/10 border border-danger-500/40',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold
        transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 min-h-12
        ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
