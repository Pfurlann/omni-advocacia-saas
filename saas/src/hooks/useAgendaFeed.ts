'use client'
import { useQuery } from '@tanstack/react-query'

export type OmniAgendaItem = {
  id: string
  source: 'omni'
  titulo: string
  tipo: string
  dataPrazo: string
  horaPrazo: string | null
  processoId: string | null
  processoTitulo: string | null
  clienteNome: string | null
  processoUrl: string | null
  responsavelId?: string
  responsavelNome?: string | null
}

export type GoogleAgendaEvent = {
  id: string
  summary: string | null
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  htmlLink: string | null
  allDay: boolean
}

export type AgendaFeedResponse = {
  from: string
  to: string
  omni: OmniAgendaItem[]
  google: { calendarId: string; events: GoogleAgendaEvent[] }[]
  connected: boolean
}

export function useAgendaFeed(from: string, to: string) {
  return useQuery({
    queryKey: ['agendaFeed', from, to],
    queryFn: async (): Promise<AgendaFeedResponse> => {
      const u = new URL('/api/google-calendar/feed', window.location.origin)
      u.searchParams.set('from', from)
      u.searchParams.set('to', to)
      const r = await fetch(u.toString(), { credentials: 'include' })
      if (!r.ok) {
        const t = await r.text()
        throw new Error(t || `HTTP ${r.status}`)
      }
      return r.json()
    },
    enabled: Boolean(from && to),
    staleTime: 3 * 60 * 1000,      // dados frescos por 3 min — sem refetch ao navegar
    gcTime:    10 * 60 * 1000,     // mantém no cache por 10 min
    refetchOnWindowFocus: false,    // não refetch ao voltar para a aba
    refetchOnMount: false,          // reutiliza cache se ainda fresco
  })
}
