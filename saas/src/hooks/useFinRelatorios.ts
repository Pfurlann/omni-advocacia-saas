'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { endOfMonth, format, startOfMonth, subMonths, eachDayOfInterval } from 'date-fns'
import type { TipoDfc, TipoLancamento } from '@/types/database'
import { ptBR } from 'date-fns/locale'

type RowPlano = { natureza_dfc: TipoDfc | null; e_sintetica: boolean } | null

type LancDfc = {
  tipo: TipoLancamento
  valor: number
  data_pagamento: string
  plano_conta: RowPlano | RowPlano[]
}

function naturezaEfetiva(p: RowPlano | RowPlano[] | undefined): TipoDfc {
  if (!p) return 'operacional'
  const o = Array.isArray(p) ? p[0] : p
  if (!o || o.e_sintetica) return 'operacional'
  return o.natureza_dfc ?? 'operacional'
}

function zeroDfc(): Record<TipoDfc, number> {
  return { operacional: 0, investimento: 0, financiamento: 0 }
}

export type DfcMensalLinha = {
  mes: string
  mesId: string
} & Record<TipoDfc, number>

/**
 * DFC (regime de caixa): parcelas com status pago, por data de pagamento e natureza DFC do plano.
 */
export function useFinDfcMensal(meses = 12) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['fin-dfc', meses],
    queryFn: async () => {
      const fim = endOfMonth(new Date())
      const inicio = startOfMonth(subMonths(fim, meses - 1))
      const de = format(inicio, 'yyyy-MM-dd')
      const ate = format(fim, 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('lancamentos')
        .select('tipo, valor, data_pagamento, plano_conta:plano_contas(natureza_dfc, e_sintetica)')
        .eq('status', 'pago')
        .not('data_pagamento', 'is', null)
        .gte('data_pagamento', de)
        .lte('data_pagamento', ate)
      if (error) throw error
      const rows = (data ?? []) as unknown as LancDfc[]

      const byMonth = new Map<string, Record<TipoDfc, number>>()
      for (const r of rows) {
        if (!r.data_pagamento) continue
        const mKey = r.data_pagamento.slice(0, 7)
        if (!byMonth.has(mKey)) byMonth.set(mKey, zeroDfc())
        const b = byMonth.get(mKey)!
        const n = naturezaEfetiva(r.plano_conta)
        const s = r.tipo === 'receita' ? 1 : -1
        b[n] += s * (Number(r.valor) || 0)
      }

      const linhas: DfcMensalLinha[] = []
      for (let i = meses - 1; i >= 0; i--) {
        const m = startOfMonth(subMonths(fim, i))
        const mKey = format(m, 'yyyy-MM')
        const b = byMonth.get(mKey) ?? zeroDfc()
        const mesId = mKey
        const mes = format(m, 'LLL/yy', { locale: ptBR })
        linhas.push({
          mes,
          mesId,
          operacional: b.operacional,
          investimento: b.investimento,
          financiamento: b.financiamento,
        })
      }
      return { de, ate, linhas } as { de: string; ate: string; linhas: DfcMensalLinha[] }
    },
    staleTime: 2 * 60 * 1000,
  })
}

export type PontoFluxoDia = {
  data: string
  label: string
  entradas: number
  saidas: number
  saldoDia: number
  acumulado: number
}

/**
 * Fluxo de caixa diário (caixa) no mês, por data de pagamento.
 */
export function useFinFluxoMensal(mes: Date) {
  const supabase = createClient()
  const inicio = startOfMonth(mes)
  const fim = endOfMonth(mes)
  const de = format(inicio, 'yyyy-MM-dd')
  const ate = format(fim, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['fin-fluxo', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, tipo, valor, data_pagamento, descricao, cliente:clientes(nome)')
        .eq('status', 'pago')
        .not('data_pagamento', 'is', null)
        .gte('data_pagamento', de)
        .lte('data_pagamento', ate)
      if (error) throw error
      const rows = data ?? []
      const byDay = new Map<string, { e: number; s: number }>()
      for (const r of rows) {
        if (!r.data_pagamento) continue
        const d = r.data_pagamento
        if (!byDay.has(d)) byDay.set(d, { e: 0, s: 0 })
        const b = byDay.get(d)!
        const v = Number(r.valor) || 0
        if (r.tipo === 'receita') b.e += v
        else b.s += v
      }
      const dias = eachDayOfInterval({ start: inicio, end: fim })
      let acc = 0
      const serie: PontoFluxoDia[] = []
      for (const d of dias) {
        const key = format(d, 'yyyy-MM-dd')
        const b = byDay.get(key) ?? { e: 0, s: 0 }
        const saldoDia = b.e - b.s
        acc += saldoDia
        serie.push({
          data: key,
          label: format(d, 'd/M', { locale: ptBR }),
          entradas: b.e,
          saidas: b.s,
          saldoDia,
          acumulado: acc,
        })
      }
      return {
        de,
        ate,
        resumo: {
          entradas: Array.from(byDay.values()).reduce((a, b) => a + b.e, 0),
          saidas: Array.from(byDay.values()).reduce((a, b) => a + b.s, 0),
        },
        serie,
        detalhe: rows,
      }
    },
    staleTime: 60 * 1000,
  })
}

type FinApItem = {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data_vencimento: string
  status: string
  data_pagamento: string | null
  categoria: string
  cliente?: { nome: string } | null
  processo?: { titulo: string; numero_processo: string | null } | null
  plano_conta_id: string | null
}

/**
 * Contas a receber / a pagar: títulos em aberto, ordenados por vencimento.
 */
export function useFinContasPagarReceber() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['fin-ap-ar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, tipo, descricao, valor, data_vencimento, data_pagamento, status, categoria, plano_conta_id, cliente:clientes(nome), processo:processos(titulo, numero_processo)')
        .in('status', ['pendente', 'inadimplente'])
        .order('data_vencimento', { ascending: true })
        .limit(2000)
      if (error) throw error
      const raw = (data ?? []) as Record<string, unknown>[]
      const rows: FinApItem[] = raw.map(r => {
        const c = r.cliente as { nome?: string } | { nome?: string }[] | null | undefined
        const p = r.processo as { titulo?: string; numero_processo?: string | null } | { titulo?: string; numero_processo?: string | null }[] | null | undefined
        const cliente = Array.isArray(c) ? c[0] : c
        const processo = Array.isArray(p) ? p[0] : p
        return {
          id: r.id as string,
          tipo: r.tipo as FinApItem['tipo'],
          descricao: r.descricao as string,
          valor: Number(r.valor),
          data_vencimento: r.data_vencimento as string,
          status: r.status as string,
          data_pagamento: r.data_pagamento as string | null,
          categoria: r.categoria as string,
          plano_conta_id: r.plano_conta_id as string | null,
          cliente: cliente ? { nome: cliente.nome ?? '' } : undefined,
          processo: processo ? { titulo: processo.titulo ?? '', numero_processo: processo.numero_processo ?? null } : undefined,
        }
      })
      const aReceber = rows.filter(r => r.tipo === 'receita')
      const aPagar = rows.filter(r => r.tipo === 'despesa')
      const tot = (l: FinApItem[]) => l.reduce((a, b) => a + b.valor, 0)
      return {
        aReceber,
        aPagar,
        totReceber: tot(aReceber),
        totPagar: tot(aPagar),
      }
    },
    staleTime: 60 * 1000,
  })
}
