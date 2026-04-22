'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EtapaKanban } from '@/types/database'
import { toast } from 'sonner'

// ─── Leitura ─────────────────────────────────────────────────────────────────

export function useEtapas() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['etapas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etapas_kanban')
        .select('*')
        .order('ordem')
      if (error) throw error
      return (data ?? []) as EtapaKanban[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Criar ───────────────────────────────────────────────────────────────────

export function useCreateEtapa() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      escritorio_id: string
      nome: string
      cor: string
      is_inicial?: boolean
      is_final?: boolean
    }) => {
      // Maior ordem só deste escritório (alinhado ao RLS)
      const { data: existentes } = await supabase
        .from('etapas_kanban')
        .select('ordem')
        .eq('escritorio_id', values.escritorio_id)
        .order('ordem', { ascending: false })
        .limit(1)

      const proxima_ordem = (existentes?.[0]?.ordem ?? -1) + 1

      const { data, error } = await supabase
        .from('etapas_kanban')
        .insert({ ...values, ordem: proxima_ordem, is_inicial: values.is_inicial ?? false, is_final: values.is_final ?? false })
        .select()
        .single()
      if (error) throw error
      return data as EtapaKanban
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etapas'] })
      toast.success('Etapa criada!')
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Erro ao criar etapa'),
  })
}

// ─── Atualizar ────────────────────────────────────────────────────────────────

export function useUpdateEtapa() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<EtapaKanban> & { id: string }) => {
      const { data, error } = await supabase
        .from('etapas_kanban')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as EtapaKanban
    },
    // Optimistic update
    onMutate: async ({ id, ...values }) => {
      await qc.cancelQueries({ queryKey: ['etapas'] })
      const anterior = qc.getQueryData<EtapaKanban[]>(['etapas'])
      qc.setQueryData<EtapaKanban[]>(['etapas'], old =>
        old?.map(e => e.id === id ? { ...e, ...values } : e) ?? []
      )
      return { anterior }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(['etapas'], ctx.anterior)
      toast.error(err.message || 'Erro ao atualizar etapa')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  })
}

// ─── Reordenar (drag & drop) ──────────────────────────────────────────────────

export function useReordenarEtapas() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (etapas: Pick<EtapaKanban, 'id' | 'ordem'>[]) => {
      for (const { id, ordem } of etapas) {
        const { error } = await supabase.from('etapas_kanban').update({ ordem }).eq('id', id)
        if (error) throw error
      }
    },
    // Optimistic: aplica nova ordem imediatamente na UI
    onMutate: async (etapas) => {
      await qc.cancelQueries({ queryKey: ['etapas'] })
      const anterior = qc.getQueryData<EtapaKanban[]>(['etapas'])
      qc.setQueryData<EtapaKanban[]>(['etapas'], old => {
        if (!old) return old
        const mapaOrdem = new Map(etapas.map(e => [e.id, e.ordem]))
        return [...old]
          .map(e => ({ ...e, ordem: mapaOrdem.get(e.id) ?? e.ordem }))
          .sort((a, b) => a.ordem - b.ordem)
      })
      return { anterior }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.anterior) qc.setQueryData(['etapas'], ctx.anterior)
      toast.error(err.message || 'Erro ao reordenar')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['etapas'] }),
  })
}

// ─── Deletar ──────────────────────────────────────────────────────────────────

export function useDeleteEtapa() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Verifica se há processos nesta etapa antes de deletar
      const { count } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .eq('etapa_id', id)

      if ((count ?? 0) > 0) {
        throw new Error(`Esta etapa tem ${count} processo(s). Mova-os antes de excluir.`)
      }

      const { error } = await supabase.from('etapas_kanban').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etapas'] })
      toast.success('Etapa removida!')
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao remover etapa'),
  })
}
