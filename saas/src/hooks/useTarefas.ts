'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Tarefa } from '@/types/database'

export function useTarefas(processo_id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['tarefas', processo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarefas')
        .select('*')
        .eq('processo_id', processo_id)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as Tarefa[]
    },
    enabled: !!processo_id,
  })
}

export function useCreateTarefa() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Tarefa, 'id' | 'created_at' | 'updated_at' | 'concluida_em'>) => {
      const { data, error } = await supabase.from('tarefas').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tarefas', vars.processo_id] })
      qc.invalidateQueries({ queryKey: ['processos'] })
    },
  })
}

export function useToggleTarefa() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, processo_id, concluida }: { id: string; processo_id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from('tarefas')
        .update({
          status: concluida ? 'done' : 'todo',
          concluida_em: concluida ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['tarefas', vars.processo_id] }),
  })
}

export function useDeleteTarefa() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, processo_id }: { id: string; processo_id: string }) => {
      const { error } = await supabase.from('tarefas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['tarefas', vars.processo_id] }),
  })
}
