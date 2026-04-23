import type { OpcaoCadastro } from '@/types/database'

/** Resumo vindo de join no Supabase ou `OpcaoCadastro` completo. */
export type OpcaoLike =
  | (Partial<Pick<OpcaoCadastro, 'rotulo' | 'slug' | 'cor' | 'ordem'>> & { rotulo?: string | null })
  | null
  | undefined

export function opcaoRotulo(o: OpcaoLike): string {
  return o?.rotulo ?? '—'
}

export function corAreaHex(o: OpcaoLike): string {
  const c = o?.cor
  if (c && c.startsWith('#')) return c
  return '#6b7280'
}

const PRIORIDADE_BORDA_POR_SLUG: Record<string, string> = {
  p1: 'border-l-destructive',
  p2: 'border-l-primary',
  p3: 'border-l-border',
}

export function prioridadeBarLeftClass(o: OpcaoLike): string {
  if (!o?.slug) return 'border-l-gray-200'
  return PRIORIDADE_BORDA_POR_SLUG[o.slug] ?? 'border-l-gray-200'
}

export function prioridadeBadgeClass(o: OpcaoLike): string {
  const c = o?.cor
  if (c && c.startsWith('badge-')) return c
  if (o?.slug && PRIORIDADE_BORDA_POR_SLUG[o.slug]) {
    if (o.slug === 'p1') return 'badge-danger'
    if (o.slug === 'p2') return 'badge-primary'
    if (o.slug === 'p3') return 'badge-muted'
  }
  return 'badge-primary'
}

export function isPrioridadeAlta(o: OpcaoLike): boolean {
  return o?.slug === 'p1' || o?.ordem === 1
}

const PRIORIDADE_DOT_POR_SLUG: Record<string, string> = {
  p1: 'bg-destructive',
  p2: 'bg-primary',
  p3: 'bg-muted',
}

export function prioridadeDotClass(o: OpcaoLike): string {
  if (!o?.slug) return 'bg-muted'
  return PRIORIDADE_DOT_POR_SLUG[o.slug] ?? 'bg-muted'
}
