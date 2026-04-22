/**
 * Cores consistentes por utilizador (prazos Omni na agenda).
 * Separadas o suficiente para distinguir pessoas na legenda.
 */
function hash32(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export type AgendaResponsavelColor = {
  /** Fundo do cartão / legenda clara */
  bg: string
  /** Borda e traço do avatar */
  border: string
  /** Texto secundário */
  text: string
}

const FALLBACK: AgendaResponsavelColor = {
  bg: 'hsl(220 14% 96%)',
  border: 'hsl(220 13% 46%)',
  text: 'hsl(220 9% 30%)',
}

export function agendaColorForUserId(userId: string | undefined | null): AgendaResponsavelColor {
  if (!userId) return FALLBACK
  const h = hash32(userId) % 360
  return {
    bg: `hsl(${h} 48% 94%)`,
    border: `hsl(${h} 52% 40%)`,
    text: `hsl(${h} 32% 24%)`,
  }
}

export function iniciaisNome(n: string | null | undefined): string {
  const t = n?.trim()
  if (!t) return '—'
  const p = t.split(/\s+/).filter(Boolean)
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}
