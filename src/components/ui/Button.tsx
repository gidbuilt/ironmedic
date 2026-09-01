import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-safety-400 text-steel-950 hover:bg-safety-300 active:bg-safety-500 shadow-[0_2px_20px_rgba(255,199,44,0.22)]',
  secondary: 'bg-steel-800/90 text-steel-100 hover:bg-steel-700 border border-steel-600/80',
  ghost: 'bg-transparent text-steel-200 hover:bg-steel-800/80',
  danger: 'bg-transparent text-danger-500 hover:bg-danger-500/10 border border-danger-500/40',
}

const sizes: Record<Size, string> = {
  md: 'min-h-12 px-5 py-3 text-sm',
  sm: 'min-h-10 px-3.5 py-2 text-sm',
  icon: 'min-h-12 min-w-12 !gap-0 !p-0',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold
        transition-[color,background-color,border-color,transform,box-shadow] duration-150
        active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
