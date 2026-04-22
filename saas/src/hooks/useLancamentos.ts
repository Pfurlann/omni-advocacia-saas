'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Lancamento, TipoLancamento, StatusLancamento } from '@/types/database'
import { invalidateModuloFinanceiro } from '@/lib/financeiro/invalidate-caches'

interface LancamentosFiltros {
  tipo?: TipoLancamento
  status?: StatusLancamento
  mes?: number
  ano?: number
  processo_id?: string
  cliente_id?: string
}

export function useLancamentos(filtros: LancamentosFiltros = {}) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['lancamentos', filtros],
    queryFn: async () => {
      let q = supabase
        .from('lancamentos')
        .select(`*, cliente:clientes(id,nome), processo:processos(id,titulo,numero_processo)`)
        .order('data_vencimento', { ascending: false })
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
      if (filtros.status) q = q.eq('status', filtros.status)
      if (filtros.processo_id) q = q.eq('processo_id', filtros.processo_id)
      if (filtros.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
      if (filtros.mes && filtros.ano) {
        const inicio = `${filtros.ano}-${String(filtros.mes).padStart(2,'0')}-01`
        const fim = new Date(filtros.ano, filtros.mes, 0).toISOString().split('T')[0]
        q = q.gte('data_vencimento', inicio).lte('data_vencimento', fim)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as (Lancamento & {
        cliente?: { id: string; nome: string }
        processo?: { id: string; titulo: string; numero_processo: string | null }
      })[]
    },
  })
}

export function useCreateLancamento() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('lancamentos').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateModuloFinanceiro(qc)
    },
  })
}

export function useCreateLancamentosLote() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>[]) => {
      if (rows.length === 0) return []
      const { data, error } = await supabase.from('lancamentos').insert(rows).select()
      if (error) throw error
      return (data ?? []) as Lancamento[]
    },
    onSuccess: () => {
      invalidateModuloFinanceiro(qc)
    },
  })
}

export function useMarcarPago() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lancamentos')
        .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateModuloFinanceiro(qc)
    },
  })
}

export function useDeleteLancamento() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateModuloFinanceiro(qc)
    },
  })
}
