import { cn } from '@/lib/utils'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light' | 'primary'
  className?: string
}

const SIZE: Record<string, number> = { xs: 20, sm: 28, md: 40, lg: 56 }

const RING_COLOR: Record<string, string> = {
  dark:    '#0E0E1A',
  light:   '#F8F8F5',
  primary: 'rgba(255,255,255,0.9)',
}

export function OmniSpinner({ size = 'md', variant = 'dark', className }: Props) {
  const px = SIZE[size]
  const stroke = RING_COLOR[variant]
  // viewBox center 26, r=18 → dasharray "99 14.1" = 315° arc
  return (
    <svg
      viewBox="0 0 52 52"
      width={px}
      height={px}
      fill="none"
      className={cn('animate-spin', className)}
      style={{ animationDuration: '0.9s', animationTimingFunction: 'linear' }}
      aria-label="Carregando…"
      role="status"
    >
      <circle
        cx="26" cy="26" r="18"
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="99 14.1"
        transform="rotate(-45 26 26)"
      />
      <circle cx="38.7" cy="13.3" r="2.1" fill="#C9A84C" />
    </svg>
  )
}
