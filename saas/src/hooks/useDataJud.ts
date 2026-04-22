'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { countCnjDigits } from '@/lib/datajud/normalize'
import type { DataJudMovimentacao, Processo } from '@/types/database'

export function useDataJudMovimentos(processoId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['datajud_movimentos', processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('datajud_movimentacoes')
        .select('*')
        .eq('processo_id', processoId)
        .order('ocorrido_em', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as DataJudMovimentacao[]
    },
    enabled: !!processoId,
  })
}

export function useSyncDataJud(processoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/processos/${processoId}/datajud/sync`, {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await res.json()) as { error?: string; total?: number }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao sincronizar')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datajud_movimentos', processoId] })
      qc.invalidateQueries({ queryKey: ['processos', processoId] })
    },
  })
}

const STALE_SYNC_MS = 5 * 60 * 1000

/** Dispara POST /sync ao carregar a ficha, se CNJ e tribunal ok e a última sync for antiga ou inexistente. */
export function useDataJudAutoSync(processo: Processo | null | undefined) {
  const qc = useQueryClient()
  const id = processo?.id
  const cnjOk = countCnjDigits(processo?.numero_processo ?? null) === 20
  const temTribunal = Boolean(processo?.datajud_tribunal_sigla?.trim())
  const syncedAt = processo?.datajud_synced_at
  const freshEnough =
    !!syncedAt && Date.now() - new Date(syncedAt).getTime() < STALE_SYNC_MS

  return useQuery({
    queryKey: [
      'datajud_auto_sync',
      id,
      processo?.numero_processo,
      processo?.datajud_tribunal_sigla,
    ],
    queryFn: async () => {
      const res = await fetch(`/api/processos/${id}/datajud/sync`, {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await res.json()) as { error?: string; total?: number }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao sincronizar')
      await qc.invalidateQueries({ queryKey: ['datajud_movimentos', id] })
      await qc.invalidateQueries({ queryKey: ['processos', id] })
      return j
    },
    enabled: Boolean(id && processo && cnjOk && temTribunal && !freshEnough),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
