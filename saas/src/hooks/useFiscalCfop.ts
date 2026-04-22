'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { FiscalCfop, TipoCfopMov } from '@/types/database'
import { invalidateModuloFinanceiro } from '@/lib/financeiro/invalidate-caches'

export function useFiscalCfop() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['fiscal-cfop'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_cfop')
        .select('*, plano_conta:plano_contas(id, codigo, nome)')
        .order('codigo')
      if (error) throw error
      return (data ?? []) as (FiscalCfop & { plano_conta?: { id: string; codigo: string; nome: string } | null })[]
    },
  })
}

export function useUpsertFiscalCfop() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      escritorioId: string
      codigo: string
      descricao: string
      tipo_mov: TipoCfopMov
      plano_conta_id?: string | null
    }) => {
      const cod = input.codigo.replace(/\D/g, '').padStart(4, '0').slice(0, 4)
      const base = {
        codigo: cod,
        descricao: input.descricao.trim(),
        tipo_mov: input.tipo_mov,
        plano_conta_id: input.plano_conta_id ?? null,
      }
      if (input.id) {
        const { data, error } = await supabase
          .from('fiscal_cfop')
          .update(base)
          .eq('id', input.id)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('fiscal_cfop')
        .insert({ ...base, escritorio_id: input.escritorioId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}

export function useDeleteFiscalCfop() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fiscal_cfop').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}
