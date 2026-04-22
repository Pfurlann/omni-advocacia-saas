'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TIPO_PRAZO_LABELS } from '@/lib/constants'
import { isSameMonth, isToday } from '@/lib/agenda/range'
import type { GoogleAgendaEvent, OmniAgendaItem } from '@/hooks/useAgendaFeed'
import type { MembroComNome } from '@/hooks/useEscritorioMembros'
import { agendaColorForUserId, iniciaisNome, type AgendaResponsavelColor } from '@/lib/agenda/memberColors'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function omniPrazoHoverTitle(o: OmniAgendaItem): string | undefined {
  const p = o.processoTitulo?.trim()
  const c = o.clienteNome?.trim()
  if (!p && !c) return undefined
  const parts: string[] = []
  if (p) parts.push(`Processo: ${p}`)
  if (c) parts.push(`Cliente: ${c}`)
  return parts.join(' · ')
}

export type CellItem =
  | { kind: 'omni'; o: OmniAgendaItem }
  | { kind: 'google'; g: GoogleAgendaEvent; calendarId: string }

type ViewContext = {
  membroById: Map<string, MembroComNome>
  colorForUser: (id: string | undefined) => AgendaResponsavelColor
}

function ResponsavelFace({
  userId,
  className,
  membroById,
  colorForUser,
  compact,
  nomeFallback,
}: {
  userId: string | undefined
  className?: string
  membroById: Map<string, MembroComNome>
  colorForUser: (id: string | undefined) => AgendaResponsavelColor
  compact?: boolean
  /** Quando a equipa ainda não tem cartão (perfil) em cache */
  nomeFallback?: string | null
}) {
  const m = userId ? membroById.get(userId) : undefined
  const label = m?.full_name?.trim() || nomeFallback?.trim() || 'Advogado'
  const col = colorForUser(userId)
  const s = compact ? 'w-3.5 h-3.5 min-w-3.5 min-h-3.5 text-[6px]' : 'w-5 h-5 min-w-5 min-h-5 text-[8px]'

  return (
    <span
      className={cn('shrink-0 rounded-full overflow-hidden block border', s, className)}
      style={{ borderColor: col.border }}
      title={label}
    >
      {m?.avatar_url ? (
        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center font-bold text-white leading-none"
          style={{ background: col.border }}
        >
          {iniciaisNome(m?.full_name ?? nomeFallback ?? label)}
        </span>
      )}
    </span>
  )
}

function OmniCard({
  o,
  compact,
  membroById,
  colorForUser,
}: { o: OmniAgendaItem; compact?: boolean; membroById: Map<string, MembroComNome>; colorForUser: (id: string | undefined) => AgendaResponsavelColor }) {
  const col = colorForUser(o.responsavelId)
  const hoverTip = omniPrazoHoverTitle(o)
  return (
    <div
      className={cn('rounded-md text-left border', compact && 'text-[10px] leading-tight', !compact && 'text-xs px-1.5 py-1')}
      style={{ backgroundColor: col.bg, borderColor: col.border, color: col.text }}
      title={hoverTip}
    >
      <div className="flex gap-1 items-start min-w-0">
        <ResponsavelFace
          userId={o.responsavelId}
          membroById={membroById}
          colorForUser={colorForUser}
          compact={compact}
          nomeFallback={o.responsavelNome}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium line-clamp-2 text-foreground', compact ? 'text-[10px]' : '')}>{o.titulo}</p>
          <p className="text-[10px] opacity-80 mt-0.5 line-clamp-1">
            {TIPO_PRAZO_LABELS[o.tipo as keyof typeof TIPO_PRAZO_LABELS] ?? o.tipo}
            {o.horaPrazo ? ` · ${o.horaPrazo.slice(0, 5)}` : ' · dia'}
          </p>
          {o.processoId && o.processoUrl && !compact ? (
            <Link
              href={o.processoUrl}
              className="text-[10px] underline underline-offset-2 opacity-90 block mt-0.5 truncate"
              onClick={e => e.stopPropagation()}
            >
              {o.processoTitulo}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function GoogleCard({ g, compact }: { g: GoogleAgendaEvent; compact?: boolean }) {
  return (
    <a
      href={g.htmlLink ?? '#'}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'block rounded-md px-1.5 py-1 border border-slate-300/90 bg-slate-50/95 hover:bg-slate-100/95 text-foreground shadow-sm',
        compact && 'text-[10px] leading-tight',
        !compact && 'text-xs',
      )}
      onClick={e => e.stopPropagation()}
      title="Google Calendar"
    >
      <div className="flex gap-1 items-start min-w-0">
        <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-slate-400 text-[7px] font-bold text-white flex items-center justify-center" aria-hidden>
          G
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium line-clamp-2">{g.summary}</p>
          <p className="text-[10px] text-muted-foreground">
            {g.allDay ? 'Dia inteiro' : (g.start?.dateTime && format(new Date(g.start.dateTime), 'HH:mm'))}
          </p>
        </div>
      </div>
    </a>
  )
}

function sortKey(it: CellItem): string {
  if (it.kind === 'omni') {
    return it.o.horaPrazo?.slice(0, 5) ?? '24:00'
  }
  if (it.g.start?.dateTime) return it.g.start.dateTime.slice(11, 16)
  return '00:00'
}

type BaseProps = {
  cellsByDay: Record<string, CellItem[]>
} & ViewContext

function pickItems(map: Record<string, CellItem[]>, key: string): CellItem[] {
  return [...(map[key] ?? [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
}

const defaultContext: ViewContext = {
  membroById: new Map(),
  colorForUser: id => agendaColorForUserId(id),
}

export function AgendaDayView({
  day,
  cellsByDay,
  membroById = defaultContext.membroById,
  colorForUser = defaultContext.colorForUser,
}: BaseProps & { day: Date }) {
  const key = format(day, 'yyyy-MM-dd')
  const items = pickItems(cellsByDay, key)
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-4xl flex-col">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border p-1 shadow-sm',
          isToday(day) ? 'border-primary/35 bg-primary/[0.04]' : 'border-border/90 bg-white',
        )}
      >
        <div className="flex shrink-0 items-baseline justify-between border-b border-border/50 px-4 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{format(day, 'EEEE', { locale: ptBR })}</p>
            <p className="text-2xl font-semibold text-foreground tabular-nums">{format(day, 'd MMMM yyyy', { locale: ptBR })}</p>
          </div>
          {isToday(day) && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">Hoje</span>
          )}
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground/80 py-12 text-center">Nada agendado neste dia</li>
          )}
          {items.map((item, i) => (
            <li key={item.kind === 'omni' ? `o-${item.o.id}-${i}` : `g-${item.g.id}-${i}`}>
              {item.kind === 'omni'
                ? <OmniCard o={item.o} membroById={membroById} colorForUser={colorForUser} />
                : <GoogleCard g={item.g} />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AgendaWeekView({
  days,
  cellsByDay,
  membroById = defaultContext.membroById,
  colorForUser = defaultContext.colorForUser,
}: BaseProps & { days: Date[] }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-7 gap-1.5 [grid-template-rows:minmax(0,1fr)] md:gap-2">
        {days.map(d => {
          const key = format(d, 'yyyy-MM-dd')
          const items = pickItems(cellsByDay, key)
          const tod = isToday(d)
          return (
            <div
              key={key}
              className={cn(
                'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border',
                tod ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/15' : 'border-border/80 bg-white shadow-sm',
              )}
            >
              <div className="shrink-0 border-b border-border/50 px-1.5 py-2 text-center">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{format(d, 'EEE', { locale: ptBR })}</p>
                <p className={cn('text-lg font-bold tabular-nums', tod && 'text-primary')}>{format(d, 'd')}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5 text-[11px]">
                {items.map((item, i) =>
                  item.kind === 'omni'
                    ? <OmniCard key={`o-${item.o.id}-${i}`} o={item.o} compact membroById={membroById} colorForUser={colorForUser} />
                    : <GoogleCard key={`g-${item.g.id}-${i}`} g={item.g} compact />,
                )}
                {items.length === 0 && <p className="text-[10px] text-muted-foreground/50 text-center py-2">—</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AgendaMonthView({
  days,
  monthAnchor,
  cellsByDay,
  membroById = defaultContext.membroById,
  colorForUser = defaultContext.colorForUser,
}: BaseProps & { days: Date[]; monthAnchor: Date }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="grid w-full min-w-0 grid-cols-7 gap-px overflow-hidden rounded-t-xl bg-border/50">
          {WEEKDAYS.map(wd => (
            <div key={wd} className="bg-muted/50 py-2 text-center text-[10px] font-semibold text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid w-full min-w-0 auto-rows-[minmax(5.5rem,auto)] grid-cols-7 gap-px overflow-hidden rounded-b-xl border border-t-0 border-border/50 bg-border/50">
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd')
            const items = pickItems(cellsByDay, key)
            const inMonth = isSameMonth(d, monthAnchor)
            const tod = isToday(d)
            const vis = items.slice(0, 3)
            const more = items.length - vis.length
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[88px] p-1 flex flex-col bg-white',
                  !inMonth && 'bg-muted/30',
                  tod && 'ring-inset ring-1 ring-primary/30',
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-semibold tabular-nums mb-0.5 w-6 h-6 flex items-center justify-center rounded-full',
                    tod && 'bg-primary text-primary-foreground',
                    !tod && inMonth && 'text-foreground',
                    !inMonth && 'text-muted-foreground/50',
                  )}
                >
                  {format(d, 'd')}
                </p>
                <div className="space-y-0.5 flex-1 min-h-0 overflow-hidden">
                  {vis.map((item, i) =>
                    item.kind === 'omni'
                      ? <OmniCard key={`o-${item.o.id}-${i}`} o={item.o} compact membroById={membroById} colorForUser={colorForUser} />
                      : <GoogleCard key={`g-${item.g.id}-${i}`} g={item.g} compact />,
                  )}
                  {more > 0 && <p className="text-[9px] text-muted-foreground pl-0.5">+{more} mais</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
