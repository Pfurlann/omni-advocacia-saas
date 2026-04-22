import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type AgendaViewMode = 'day' | 'week' | 'month'

export type AgendaDateRange = {
  from: string
  to: string
  days: Date[]
  /** Só mês: primeiro dia do mês (para título e células “fora do mês”) */
  monthAnchor: Date | null
}

/**
 * `from`/`to` cobrem o intervalo para o API feed; `days` é o que a grelha desenha.
 */
export function getAgendaDateRange(anchor: Date, mode: AgendaViewMode): AgendaDateRange {
  if (mode === 'day') {
    const d = startOfDay(anchor)
    const ymd = format(d, 'yyyy-MM-dd')
    return { from: ymd, to: ymd, days: [d], monthAnchor: null }
  }
  if (mode === 'week') {
    const s = startOfWeek(anchor, { weekStartsOn: 1 })
    const e = addDays(s, 6)
    return {
      from: format(s, 'yyyy-MM-dd'),
      to: format(e, 'yyyy-MM-dd'),
      days: Array.from({ length: 7 }, (_, i) => addDays(s, i)),
      monthAnchor: null,
    }
  }
  const m0 = startOfMonth(anchor)
  const m1 = endOfMonth(anchor)
  const gridStart = startOfWeek(m0, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(m1, { weekStartsOn: 1 })
  return {
    from: format(gridStart, 'yyyy-MM-dd'),
    to: format(gridEnd, 'yyyy-MM-dd'),
    days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
    monthAnchor: m0,
  }
}

export function formatAgendaRangeLabel(anchor: Date, mode: AgendaViewMode): string {
  if (mode === 'day') {
    return format(anchor, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
  }
  if (mode === 'week') {
    const s = startOfWeek(anchor, { weekStartsOn: 1 })
    const e = addDays(s, 6)
    if (s.getFullYear() !== e.getFullYear()) {
      return `${format(s, 'd MMM', { locale: ptBR })} – ${format(e, 'd MMM yyyy', { locale: ptBR })}`
    }
    if (s.getMonth() !== e.getMonth()) {
      return `${format(s, 'd MMM', { locale: ptBR })} – ${format(e, 'd MMM yyyy', { locale: ptBR })}`
    }
    return `${format(s, 'd', { locale: ptBR })} – ${format(e, 'd MMM yyyy', { locale: ptBR })}`
  }
  return format(anchor, 'MMMM yyyy', { locale: ptBR })
}

export function goPrev(anchor: Date, mode: AgendaViewMode): Date {
  if (mode === 'day') return addDays(anchor, -1)
  if (mode === 'week') return addWeeks(anchor, -1)
  return addMonths(anchor, -1)
}

export function goNext(anchor: Date, mode: AgendaViewMode): Date {
  if (mode === 'day') return addDays(anchor, 1)
  if (mode === 'week') return addWeeks(anchor, 1)
  return addMonths(anchor, 1)
}

export { isSameMonth, isToday }
