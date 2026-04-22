'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { KpiDashboard, DreMensal, ProcessosPorEtapa } from '@/types/database'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { addDiasCivis, hojeIsoEmBrasil } from '@/lib/datetime/brazil'

export function useKpiDashboard() {
  const supabase = createClient()
  const agora = new Date()
  const inicioMes = startOfMonth(agora).toISOString().split('T')[0]
  const fimMes = endOfMonth(agora).toISOString().split('T')[0]

  return useQuery({
    queryKey: ['dashboard', 'kpi', inicioMes],
    queryFn: async () => {
      const [lancamentos, processos, prazos] = await Promise.all([
        supabase.from('lancamentos')
          .select('tipo, status, valor')
          .gte('data_vencimento', inicioMes)
          .lte('data_vencimento', fimMes),
        supabase.from('processos').select('id', { count: 'exact' }).eq('arquivado', false),
        supabase.from('prazos').select('id', { count: 'exact' })
          .eq('status', 'pendente')
          .lte('data_prazo', addDiasCivis(hojeIsoEmBrasil(), 7))
          .gte('data_prazo', hojeIsoEmBrasil()),
      ])

      const lancs = lancamentos.data ?? []
      const receita_mes = lancs.filter(l => l.tipo === 'receita' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0)
      const despesa_mes = lancs.filter(l => l.tipo === 'despesa' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0)

      const { data: inad } = await supabase.from('lancamentos').select('valor').eq('status', 'inadimplente')
      const inadimplencia_total = (inad ?? []).reduce((s, l) => s + l.valor, 0)

      return {
        receita_mes,
        despesa_mes,
        resultado_mes: receita_mes - despesa_mes,
        inadimplencia_total,
        processos_ativos: processos.count ?? 0,
        prazos_urgentes: prazos.count ?? 0,
      } as KpiDashboard
    },
    staleTime: 60 * 1000,
  })
}

export function useDreMensal(meses = 6) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['dashboard', 'dre', meses],
    queryFn: async () => {
      const resultado: DreMensal[] = []
      for (let i = meses - 1; i >= 0; i--) {
        const mes = subMonths(new Date(), i)
        const inicio = startOfMonth(mes).toISOString().split('T')[0]
        const fim = endOfMonth(mes).toISOString().split('T')[0]
        const { data } = await supabase.from('lancamentos')
          .select('tipo, valor, status')
          .gte('data_vencimento', inicio)
          .lte('data_vencimento', fim)
          .neq('status', 'cancelado')
        const lancs = data ?? []
        const receitas = lancs.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
        const despesas = lancs.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
        resultado.push({ mes: format(mes, 'MMM/yy', { locale: undefined }), receitas, despesas, resultado: receitas - despesas })
      }
      return resultado
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useProcessosPorEtapa() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['dashboard', 'etapas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_processos_por_etapa')
        .select('*')
        .order('ordem')
      if (error) throw error
      return (data ?? []) as ProcessosPorEtapa[]
    },
    staleTime: 60 * 1000,
  })
}
