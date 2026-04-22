'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { format } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgendaFeed, type GoogleAgendaEvent, type OmniAgendaItem } from '@/hooks/useAgendaFeed'
import { useEscritorioMembros } from '@/hooks/useEscritorioMembros'
import { Button } from '@/components/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import { agendaColorForUserId } from '@/lib/agenda/memberColors'
import { AgendaSidebar } from '@/components/agenda/AgendaSidebar'
import { AgendaDayView, AgendaWeekView, AgendaMonthView, type CellItem } from '@/components/agenda/AgendaViews'
import {
  type AgendaViewMode,
  formatAgendaRangeLabel,
  getAgendaDateRange,
  goNext,
  goPrev,
} from '@/lib/agenda/range'

function AgendaPageInner() {
  const qc = useQueryClient()
  const sp = useSearchParams()
  const [anchor, setAnchor] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<AgendaViewMode>('week')
  const [prazoRespSel, setPrazoRespSel] = useState<Set<string>>(new Set())

  const { data: membros = [] } = useEscritorioMembros()

  useEffect(() => {
    const g = sp.get('google')
    if (g) {
      window.history.replaceState({}, '', '/agenda')
      if (g === 'ok') {
        toast.success('Ligação Google concluída. Configura em Configurações → Integrações.')
        void qc.invalidateQueries({ queryKey: ['agendaFeed'] })
        void qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
      } else {
        toast.error('Não foi possível ligar o Google: ' + g)
      }
    }
  }, [sp, qc])

  useEffect(() => {
    if (!membros.length) return
    setPrazoRespSel(prev => {
      if (prev.size === 0) return new Set(membros.map(m => m.user_id))
      const n = new Set(prev)
      for (const m of membros) n.add(m.user_id)
      return n
    })
  }, [membros])

  const { from, to, days, monthAnchor } = useMemo(() => getAgendaDateRange(anchor, viewMode), [anchor, viewMode])

  const { data: feed, isLoading, isFetching, error, refetch } = useAgendaFeed(from, to)
  const { data: st } = useQuery({
    queryKey: ['googleCalStatus'],
    queryFn: async () => {
      const r = await fetch('/api/google-calendar/status', { credentials: 'include' })
      if (r.status === 401) return { connected: false as const }
      if (!r.ok) return { connected: false as const, err: true as const }
      return r.json() as Promise<{
        connected: boolean
        showOmniLayer?: boolean
        visibleCalendarIds?: string[]
        defaultCalendarId?: string
        omniSyncCalendarId?: string | null
        omniSyncCalendarName?: string | null
        omniSyncCalendarColorId?: string | null
      }>
    },
  })

  const stNorm = useMemo(() => {
    if (!st || !st.connected) return null
    if ('err' in st && st.err) return null
    return st
  }, [st])

  const [localOmni, setLocalOmni] = useState(true)
  const [localVisible, setLocalVisible] = useState<string[] | null>(null)

  useEffect(() => {
    if (stNorm && Array.isArray(stNorm.visibleCalendarIds)) {
      setLocalVisible(stNorm.visibleCalendarIds)
    }
  }, [stNorm?.connected, stNorm?.visibleCalendarIds?.join?.(',')])

  useEffect(() => {
    if (stNorm) {
      setLocalOmni(stNorm.showOmniLayer !== false)
    } else {
      setLocalOmni(true)
    }
  }, [stNorm, stNorm?.showOmniLayer])

  const savePreferences = useCallback(
    async (body: { showOmniLayer?: boolean; visibleCalendarIds?: string[]; defaultCalendarId?: string }) => {
      const r = await fetch('/api/google-calendar/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showOmniLayer: body.showOmniLayer,
          visibleCalendarIds: body.visibleCalendarIds,
          defaultCalendarId: body.defaultCalendarId,
        }),
        credentials: 'include',
      })
      if (!r.ok) {
        const t = await r.text()
        toast.error(t || 'Falha ao guardar')
        return
      }
      await qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      await qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
    },
    [qc],
  )

  const toggleResponsavel = useCallback(
    (userId: string) => {
      setPrazoRespSel(prev => {
        if (!membros.length) return prev
        const allIds = new Set(membros.map(m => m.user_id))
        const tudo = membros.every(m => prev.has(m.user_id)) && prev.size === membros.length
        if (tudo) {
          const n = new Set(allIds)
          n.delete(userId)
          if (n.size === 0) return allIds
          return n
        }
        const n = new Set(prev)
        if (n.has(userId)) n.delete(userId)
        else n.add(userId)
        if (n.size === 0) return allIds
        return n
      })
    },
    [membros],
  )

  const selecionarTodosResponsaveis = useCallback(() => {
    setPrazoRespSel(new Set(membros.map(m => m.user_id)))
  }, [membros])

  const membroById = useMemo(() => {
    const m = new Map(membros.map(x => [x.user_id, x] as const))
    return m
  }, [membros])

  const colorForUser = useCallback((id: string | undefined) => agendaColorForUserId(id), [])

  const cellsByDay = useMemo(() => {
    const map: Record<string, CellItem[]> = {}
    for (const d of days) {
      map[format(d, 'yyyy-MM-dd')] = []
    }
    if (!feed) return map

    const omniBase: OmniAgendaItem[] = stNorm ? feed.omni : (localOmni ? feed.omni : [])
    const filtraResp = (o: OmniAgendaItem) => {
      if (prazoRespSel.size === 0) return true
      const rid = o.responsavelId
      if (!rid) return true
      return prazoRespSel.has(rid)
    }
    for (const o of omniBase) {
      if (!filtraResp(o)) continue
      const k = o.dataPrazo.slice(0, 10)
      if (map[k]) map[k]!.push({ kind: 'omni', o })
    }
    const vis = localVisible ?? stNorm?.visibleCalendarIds ?? ['primary']
    for (const block of feed.google) {
      if (vis && !vis.includes(block.calendarId)) continue
      for (const e of block.events) {
        const g = e as GoogleAgendaEvent
        let k = g.start?.date
        if (!k && g.start?.dateTime) k = g.start.dateTime.slice(0, 10)
        if (k && map[k]) map[k]!.push({ kind: 'google', g, calendarId: block.calendarId })
      }
    }
    for (const k of Object.keys(map)) {
      map[k]!.sort((a, b) => {
        const ta = a.kind === 'omni' ? a.o.titulo : (a.g.summary ?? '')
        const tb = b.kind === 'omni' ? b.o.titulo : (b.g.summary ?? '')
        return ta.localeCompare(tb, 'pt-BR')
      })
    }
    return map
  }, [days, feed, stNorm, localOmni, localVisible, prazoRespSel])

  const rangeLabel = useMemo(() => formatAgendaRangeLabel(anchor, viewMode), [anchor, viewMode])

  return (
    <div className="flex w-full min-h-0 flex-1 -m-6">
      <h1 className="sr-only">Agenda</h1>

      <AgendaSidebar
        canPersistOmniLayer={Boolean(stNorm)}
        localOmni={localOmni}
        setLocalOmni={setLocalOmni}
        savePreferences={savePreferences}
        prazoResponsavelSelecionados={prazoRespSel}
        onToggleResponsavel={toggleResponsavel}
        onSelecionarTodosResponsaveis={selecionarTodosResponsaveis}
        membros={membros}
        viewMode={viewMode}
        setViewMode={setViewMode}
        mostrarLegendaGoogle={Boolean(stNorm)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-r-xl border border-l-0 border-border/50 bg-white shadow-sm">
        <div className="shrink-0 border-b border-border/60 bg-white px-4 py-3 flex flex-wrap items-center gap-3 md:px-5">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-9 p-0 rounded-lg"
              onClick={() => setAnchor(a => goPrev(a, viewMode))}
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-9 p-0 rounded-lg"
              onClick={() => setAnchor(a => goNext(a, viewMode))}
              aria-label="Período seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground capitalize leading-none mb-0.5">
              {viewMode === 'day' ? 'Dia' : viewMode === 'week' ? 'Semana' : 'Mês'}
            </p>
            <p className="text-base font-semibold text-foreground truncate capitalize">{rangeLabel}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-9 text-xs rounded-lg"
            onClick={() => setAnchor(new Date())}
          >
            Hoje
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => refetch()}>
            Atualizar
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-0 md:px-4">
          {isLoading && !feed && (
            <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
              <OmniSpinner size="md" />
              <span className="text-sm font-medium">Carregando agenda…</span>
            </div>
          )}
          {isFetching && feed && (
            <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 shadow-sm">
              <OmniSpinner size="xs" />
              <span className="text-xs text-muted-foreground">Atualizando…</span>
            </div>
          )}
          {error && <p className="text-sm text-destructive p-2">{(error as Error).message}</p>}

          {(feed || isFetching) && !isLoading && viewMode === 'day' && days[0] && (
            <AgendaDayView
              day={days[0]}
              cellsByDay={cellsByDay}
              membroById={membroById}
              colorForUser={colorForUser}
            />
          )}
          {(feed || isFetching) && !isLoading && viewMode === 'week' && (
            <AgendaWeekView
              days={days}
              cellsByDay={cellsByDay}
              membroById={membroById}
              colorForUser={colorForUser}
            />
          )}
          {(feed || isFetching) && !isLoading && viewMode === 'month' && monthAnchor && (
            <AgendaMonthView
              days={days}
              monthAnchor={monthAnchor}
              cellsByDay={cellsByDay}
              membroById={membroById}
              colorForUser={colorForUser}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgendaPage() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <Suspense fallback={(
        <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground gap-2">
          <OmniSpinner size="sm" variant="dark" /> A carregar…
        </div>
      )}
      >
        <AgendaPageInner />
      </Suspense>
    </div>
  )
}
