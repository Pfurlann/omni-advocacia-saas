'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Prazo, StatusPrazo } from '@/types/database'
import { addDiasCivis, diffDiasCivis, hojeIsoEmBrasil, isoDiaPrazo } from '@/lib/datetime/brazil'
import { triggerSyncPrazo } from '@/lib/google-calendar/trigger-sync'

interface PrazosFiltros {
  processo_id?: string
  status?: StatusPrazo
  dias?: number // próximos N dias
  de?: string // YYYY-MM-DD (intervalo, inclusive)
  ate?: string
}

export function usePrazos(filtros: PrazosFiltros = {}) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['prazos', filtros],
    queryFn: async () => {
      let q = supabase
        .from('prazos')
        .select(`*, processo:processos(id,titulo,numero_processo,cliente:clientes(id,nome))`)
        .order('data_prazo')
      if (filtros.processo_id) q = q.eq('processo_id', filtros.processo_id)
      if (filtros.status) q = q.eq('status', filtros.status)
      if (filtros.dias) {
        const hoje = hojeIsoEmBrasil()
        const limite = addDiasCivis(hoje, filtros.dias)
        q = q.lte('data_prazo', limite).gte('data_prazo', hoje)
      }
      if (filtros.de) q = q.gte('data_prazo', filtros.de)
      if (filtros.ate) q = q.lte('data_prazo', filtros.ate)
      const { data, error } = await q
      if (error) throw error
      const hoje = hojeIsoEmBrasil()
      return (data ?? []).map(p => ({
        ...p,
        dias_restantes: diffDiasCivis(isoDiaPrazo(p.data_prazo as string), hoje),
      }))
    },
  })
}

export function usePrazosUrgentes() {
  return usePrazos({ status: 'pendente', dias: 7 })
}

export function useCreatePrazo() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Prazo, 'id' | 'created_at' | 'updated_at' | 'concluido_em' | 'ultimo_lembrete_em' | 'google_event_id' | 'google_calendar_id' | 'google_synced_at'>) => {
      const { data, error } = await supabase.from('prazos').insert(values as Record<string, unknown>).select().single()
      if (error) throw error
      return data
    },
    onSuccess: data => {
      void triggerSyncPrazo(data.id)
      qc.invalidateQueries({ queryKey: ['prazos'] })
      qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      qc.invalidateQueries({ queryKey: ['processos'] })
    },
  })
}

export function useConcluirPrazo() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('prazos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: async (_, prazoId) => {
      await triggerSyncPrazo(prazoId)
      qc.invalidateQueries({ queryKey: ['prazos'] })
      qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      qc.invalidateQueries({ queryKey: ['processos'] })
    },
  })
}

/** Atualiza prazo (ex.: data) e ressincroniza com o Google. */
export function useUpdatePrazo() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Prazo> & { id: string }) => {
      const { data, error } = await supabase.from('prazos').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Prazo
    },
    onSuccess: data => {
      void triggerSyncPrazo(data.id)
      qc.invalidateQueries({ queryKey: ['prazos'] })
      qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      qc.invalidateQueries({ queryKey: ['processos'] })
    },
  })
}
