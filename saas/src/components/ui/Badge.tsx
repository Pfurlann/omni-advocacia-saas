import { cn } from '@/lib/utils'

type BadgeVariant = 'primary' | 'gold' | 'muted' | 'success' | 'danger' | 'warning'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

const variantClass: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  gold:    'badge-gold',
  muted:   'badge-muted',
  success: 'badge-success',
  danger:  'badge-danger',
  warning: 'badge-warning',
}

export function Badge({ variant = 'muted', className, children }: BadgeProps) {
  return (
    <span className={cn(variantClass[variant], className)}>
      {children}
    </span>
  )
}
