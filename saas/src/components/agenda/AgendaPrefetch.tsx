'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAgendaFeed } from '@/hooks/useAgendaFeed'
import { getAgendaDateRange } from '@/lib/agenda/range'

const STALE_MS = 3 * 60 * 1000

/**
 * Ao entrar no dashboard, pré-carrega o feed da semana actual (o mesmo
 * intervalo por defeito na Agenda) — prazos Omni e, se houver, Google.
 */
export function AgendaPrefetch() {
  const qc = useQueryClient()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    let cancelled = false

    void (async () => {
      try {
        const { from, to } = getAgendaDateRange(new Date(), 'week')
        if (cancelled) return
        await qc.prefetchQuery({
          queryKey: ['agendaFeed', from, to],
          queryFn: () => fetchAgendaFeed(from, to),
          staleTime: STALE_MS,
        })
      } catch {
        // falha silenciosa — a página Agenda volta a pedir
      }
    })()

    return () => {
      cancelled = true
    }
  }, [qc])

  return null
}
