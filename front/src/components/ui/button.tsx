import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/utils/cn.ts'

const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 font-semibold',
  secondary:
    'bg-raised text-ink border border-line hover:border-line-strong hover:bg-overlay',
  ghost: 'text-ink-soft hover:bg-raised hover:text-ink',
  danger: 'text-danger hover:bg-danger/10',
}
const SIZES = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8.5 px-3 gap-2 rounded-lg',
  icon: 'size-8 justify-center rounded-lg',
  xs: 'size-5 justify-center rounded [&_svg]:size-3.5',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'inline-flex shrink-0 items-center whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    {...props}
  />
)
