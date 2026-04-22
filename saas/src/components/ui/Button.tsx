import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'md' | 'sm' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClass: Record<Variant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
}

const sizeClass: Record<Size, string> = {
  md:   '',
  sm:   'btn-sm',
  icon: 'btn-icon',
}

const loadingVariant: Record<Variant, 'light' | 'dark'> = {
  primary:   'light',   // fundo violeta → spinner branco
  secondary: 'dark',
  ghost:     'dark',
  danger:    'light',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(variantClass[variant], sizeClass[size], className)}
      {...props}
    >
      {loading
        ? <OmniSpinner size="xs" variant={loadingVariant[variant]} />
        : children}
    </button>
  ),
)
Button.displayName = 'Button'
