'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Movimentacao, TipoMovimentacao } from '@/types/database'

export function useMovimentacoes(processo_id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['movimentacoes', processo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes')
        .select('*')
        .eq('processo_id', processo_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Movimentacao[]
    },
    enabled: !!processo_id,
  })
}

export function useAddMovimentacao() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      processo_id: string
      escritorio_id: string
      tipo: TipoMovimentacao
      titulo?: string
      conteudo?: string
    }) => {
      const { data, error } = await supabase.from('movimentacoes').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['movimentacoes', vars.processo_id] }),
  })
}
