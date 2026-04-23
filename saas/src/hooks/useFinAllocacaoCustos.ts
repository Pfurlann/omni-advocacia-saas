'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type BaseCusto = 'pagamento' | 'vencimento'

/**
 * Despesas alocadas a cliente/processos vs escritório (sem vínculo).
 * Base `pagamento`: só status pago e data_pagamento no intervalo (custo de caixa).
 * Base `vencimento`: data_vencimento no intervalo, exclui cancelados.
 */
export function useFinAllocacaoCustos(from: string, to: string, base: BaseCusto) {
  return useQuery({
    queryKey: ['fin-allocacao-custos', from, to, base],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('lancamentos')
        .select(`
          id, valor, tipo, status, cliente_id, processo_id, data_pagamento, data_vencimento,
          cliente:clientes(id,nome,papel_erp),
          processo:processos(id,titulo,numero_processo)
        `)
        .eq('tipo', 'despesa')
        .neq('status', 'cancelado')
      if (base === 'pagamento') {
        q = q
          .eq('status', 'pago')
          .not('data_pagamento', 'is', null)
          .gte('data_pagamento', from)
          .lte('data_pagamento', to)
      } else {
        q = q.gte('data_vencimento', from).lte('data_vencimento', to)
      }
      const { data, error } = await q
      if (error) throw error
      const rows = data ?? []

      type Agg = { id: string; nome: string; total: number; qtd: number }
      const porCliente = new Map<string, Agg>()
      const porProcesso = new Map<string, Agg & { numero: string | null }>()
      let escritorioFixo = 0
      let escritorioQtd = 0

      for (const r of rows) {
        const v = Number(r.valor) || 0
        const cid = r.cliente_id as string | null
        const pid = r.processo_id as string | null
        const rawC = r.cliente as { id: string; nome: string } | { id: string; nome: string }[] | null
        const rawP = r.processo as
          | { id: string; titulo: string; numero_processo: string | null }
          | { id: string; titulo: string; numero_processo: string | null }[]
          | null
        const cli = rawC == null ? null : Array.isArray(rawC) ? rawC[0] ?? null : rawC
        const proc = rawP == null ? null : Array.isArray(rawP) ? rawP[0] ?? null : rawP

        if (!cid && !pid) {
          escritorioFixo += v
          escritorioQtd += 1
          continue
        }
        if (cid && cli) {
          const cur = porCliente.get(cid) ?? { id: cid, nome: cli.nome, total: 0, qtd: 0 }
          cur.total += v
          cur.qtd += 1
          porCliente.set(cid, cur)
        }
        if (pid && proc) {
          const curP = porProcesso.get(pid) ?? {
            id: pid,
            nome: proc.titulo,
            numero: proc.numero_processo,
            total: 0,
            qtd: 0,
          }
          curP.total += v
          curP.qtd += 1
          porProcesso.set(pid, curP)
        }
      }

      const sortVal = (a: { total: number }, b: { total: number }) => b.total - a.total

      return {
        totalGeral: rows.reduce((s, r) => s + (Number(r.valor) || 0), 0),
        porCliente: [...porCliente.values()].sort(sortVal),
        porProcesso: [...porProcesso.values()].sort(sortVal),
        escritorioFixo,
        escritorioQtd,
        linhas: rows.length,
      }
    },
    enabled: Boolean(from && to && from <= to),
    staleTime: 60_000,
  })
}
