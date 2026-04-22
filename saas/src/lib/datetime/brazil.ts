import { formatInTimeZone } from 'date-fns-tz'

/** Fuso usado para “hoje”, lembretes de prazo e comparação de datas civis. */
export const FUSO_BR = 'America/Sao_Paulo'

/** Data civil atual (yyyy-MM-dd) em horário de Brasília. */
export function hojeIsoEmBrasil(date: Date = new Date()): string {
  return formatInTimeZone(date, FUSO_BR, 'yyyy-MM-dd')
}

/**
 * Diferença em dias entre duas datas civis (strings yyyy-MM-dd).
 * Positivo = dataFim é depois de dataIni (ex.: prazo − hoje = dias até o vencimento).
 */
export function diffDiasCivis(dataFim: string, dataIni: string): number {
  const [yf, mf, df] = dataFim.split('-').map(Number)
  const [yi, mi, di] = dataIni.split('-').map(Number)
  if ([yf, mf, df, yi, mi, di].some(Number.isNaN)) return NaN
  const f = Date.UTC(yf, mf - 1, df)
  const i = Date.UTC(yi, mi - 1, di)
  return Math.round((f - i) / 86400000)
}

/** Soma dias a uma data civil `yyyy-MM-dd` (calendário gregoriano, sem fuso). */
export function addDiasCivis(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  if ([y, m, d].some(Number.isNaN)) return iso
  const t = new Date(Date.UTC(y, m - 1, d + delta))
  const yy = t.getUTCFullYear()
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(t.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Normaliza retorno do Postgres `date` / string para `yyyy-MM-dd`. */
export function isoDiaPrazo(dataPrazo: string): string {
  return String(dataPrazo).slice(0, 10)
}
