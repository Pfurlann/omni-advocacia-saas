'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { NotaFiscal, TipoNotaFiscal } from '@/types/database'
import { invalidateModuloFinanceiro } from '@/lib/financeiro/invalidate-caches'

export function useNotasFiscais(filtro?: { tipo?: TipoNotaFiscal }) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['notas-fiscais', filtro?.tipo],
    queryFn: async () => {
      let q = supabase
        .from('notas_fiscais')
        .select('*')
        .order('data_emissao', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (filtro?.tipo) q = q.eq('tipo', filtro.tipo)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as NotaFiscal[]
    },
  })
}

export function useUpsertNotaFiscal() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      escritorioId: string
      row: Partial<NotaFiscal> & Pick<NotaFiscal, 'tipo' | 'data_emissao' | 'valor_total'>
    }) => {
      const { escritorioId, id, row } = input
      if (id) {
        const { data, error } = await supabase
          .from('notas_fiscais')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('notas_fiscais')
        .insert({ ...row, escritorio_id: escritorioId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}

export function useDeleteNotaFiscal() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notas_fiscais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}
