import { cn } from '@/lib/utils'

/**
 * Omni — Logo mark + wordmark
 *
 * O mark: anel incompleto (gap ~1h do relógio) — representa dinamismo e a
 * ideia de algo sempre em movimento, nunca estático; o interior tem uma linha
 * horizontal mínima evocando a balança da justiça.
 *
 * Variantes:
 *   "light"  — marca dark, texto dark  (fundo branco / cinza claro)
 *   "dark"   — marca branca, texto branco (sidebar escuro)
 *   "accent" — marca na cor primária    (landing, onboarding)
 */

type Variant = 'light' | 'dark' | 'accent'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

const MARK_SIZE: Record<Size, number>   = { xs: 20, sm: 24, md: 30, lg: 38 }
const TEXT_SIZE: Record<Size, string>   = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
}

interface Props {
  variant?: Variant
  size?: Size
  markOnly?: boolean
  className?: string
}

export function OmniLogo({
  variant  = 'light',
  size     = 'md',
  markOnly = false,
  className,
}: Props) {
  const dim = MARK_SIZE[size]

  const markColor =
    variant === 'dark'   ? '#FFFFFF' :
    variant === 'accent' ? 'hsl(245 82% 62%)' :
    '#0E0E1A'

  const scaleColor =
    variant === 'dark'
      ? 'rgba(255,255,255,0.22)'
      : 'rgba(14,14,26,0.16)'

  const goldDot =
    variant === 'dark'
      ? 'hsl(40 62% 54%)'   // dourado no dark
      : 'hsl(245 82% 62%)' // primário no light

  const wordmarkColor =
    variant === 'dark'  ? 'text-white'      :
    variant === 'accent'? 'text-[hsl(245_82%_62%)]' :
    'text-[#0E0E1A]'

  // Circunferência do anel: 2π × r  (r = dim*0.36)
  // O gap cobre ~18% da circunferência → 82% preenchido
  const r   = dim * 0.36
  const cx  = dim / 2
  const cy  = dim / 2
  const circ = 2 * Math.PI * r
  const dash = circ * 0.82   // arco preenchido
  const gap  = circ * 0.18   // abertura

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      {/* ── Mark ── */}
      <svg
        width={dim}
        height={dim}
        viewBox={`0 0 ${dim} ${dim}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Anel principal — incompleto, gap no canto superior-direito */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={markColor}
          strokeWidth={dim * 0.088}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          /*
           * rotate(-105deg) + offset pequeno posiciona o gap
           * entre ~12h e ~2h no relógio → visual de "seta apontando para frente"
           */
          transform={`rotate(-105 ${cx} ${cy})`}
        />

        {/* Linha de balança — sutilíssima, só percebida de perto */}
        <line
          x1={cx - r * 0.58}
          y1={cy}
          x2={cx + r * 0.58}
          y2={cy}
          stroke={scaleColor}
          strokeWidth={dim * 0.038}
          strokeLinecap="round"
        />

        {/* Ponto de acento — ouro / primário — no extremo do arco */}
        <circle
          cx={cx + r * Math.cos((-105 + 360 * 0.82 - 180) * (Math.PI / 180))}
          cy={cy + r * Math.sin((-105 + 360 * 0.82 - 180) * (Math.PI / 180))}
          r={dim * 0.065}
          fill={goldDot}
        />
      </svg>

      {/* ── Wordmark ── */}
      {!markOnly && (
        <span
          className={cn(
            'font-semibold tracking-[0.18em] uppercase leading-none',
            TEXT_SIZE[size],
            wordmarkColor,
          )}
        >
          Omni
        </span>
      )}
    </div>
  )
}
