import { addDays, format, parse } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import type { calendar_v3 } from 'googleapis'
import type { Prazo } from '@/types/database'

const BRAZIL = 'America/Sao_Paulo'

export function buildProcessoUrl(processoId: string | null, origin: string): string | null {
  if (!processoId) return null
  const base = origin.replace(/\/$/, '')
  return `${base}/processos/${processoId}`
}

/**
 * Mapeia prazo para recurso de evento Google.
 * Prazo sem hora = dia inteiro; com hora = instante em horário de Brasília.
 */
export function prazoToGoogleEventBody(
  prazo: Prazo & { processo?: { titulo?: string; numero_processo?: string } | null },
  appOrigin: string,
): calendar_v3.Schema$Event {
  const processoLine = prazo.processo
    ? `Processo: ${prazo.processo.titulo ?? '—'}` + (prazo.processo.numero_processo ? ` (${prazo.processo.numero_processo})` : '')
    : 'Sem processo vinculado'
  const link = buildProcessoUrl(prazo.processo_id, appOrigin)
  const desc = [processoLine, prazo.descricao, link ? `Abrir no Omni: ${link}` : null]
    .filter(Boolean)
    .join('\n\n')

  const ext: calendar_v3.Schema$Event = {
    summary: prazo.titulo,
    description: desc || undefined,
    extendedProperties: { private: { omniPrazoId: prazo.id, omniEscritorioId: prazo.escritorio_id } },
  }

  if (!prazo.hora_prazo) {
    const d = prazo.data_prazo.slice(0, 10)
    const day = parse(d, 'yyyy-MM-dd', new Date())
    ext.start = { date: d, timeZone: BRAZIL }
    ext.end = { date: format(addDays(day, 1), 'yyyy-MM-dd'), timeZone: BRAZIL }
  } else {
    const datePart = prazo.data_prazo.slice(0, 10)
    const t = prazo.hora_prazo.length >= 5 ? prazo.hora_prazo.slice(0, 5) : prazo.hora_prazo
    const local = parse(`${datePart} ${t}`, 'yyyy-MM-dd HH:mm', new Date())
    const startUtc = fromZonedTime(local, BRAZIL)
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000)
    ext.start = { dateTime: startUtc.toISOString(), timeZone: BRAZIL }
    ext.end = { dateTime: endUtc.toISOString(), timeZone: BRAZIL }
  }

  return ext
}
