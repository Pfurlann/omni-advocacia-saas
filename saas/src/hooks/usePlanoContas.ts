'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PlanoConta, TipoDfc, TipoLancamento } from '@/types/database'
import { seedPlanoContasSugerido } from '@/lib/financeiro/plano-seed'
import { invalidateModuloFinanceiro } from '@/lib/financeiro/invalidate-caches'

export function usePlanoContas() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['plano-contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_contas')
        .select('*')
        .order('ordem', { ascending: true })
        .order('codigo', { ascending: true })
      if (error) throw error
      return (data ?? []) as PlanoConta[]
    },
  })
}

export function usePlanoContasAnaliticos(tipo: TipoLancamento) {
  const { data: all = [] } = usePlanoContas()
  return all.filter(
    a => !a.e_sintetica && a.ativo && a.tipo_razao === tipo,
  )
}

type InsertPlano = {
  parent_id: string | null
  codigo: string
  nome: string
  descricao?: string | null
  e_sintetica: boolean
  tipo_razao?: TipoLancamento | null
  natureza_dfc?: TipoDfc | null
  ordem?: number
}

export function useCreatePlanoConta() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { escritorioId: string } & InsertPlano) => {
      const { escritorioId, ...r } = input
      const { data, error } = await supabase
        .from('plano_contas')
        .insert({
          escritorio_id: escritorioId,
          parent_id: r.parent_id,
          codigo: r.codigo.trim(),
          nome: r.nome.trim(),
          descricao: r.descricao ?? null,
          e_sintetica: r.e_sintetica,
          tipo_razao: r.e_sintetica ? null : (r.tipo_razao ?? null),
          natureza_dfc: r.natureza_dfc ?? null,
          ordem: r.ordem ?? 0,
        })
        .select()
        .single()
      if (error) throw error
      return data as PlanoConta
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}

export function useDeletePlanoConta() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plano_contas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}

export function useSeedPlanoSugerido() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (escritorioId: string) => {
      await seedPlanoContasSugerido(supabase, escritorioId)
    },
    onSuccess: () => invalidateModuloFinanceiro(qc),
  })
}
