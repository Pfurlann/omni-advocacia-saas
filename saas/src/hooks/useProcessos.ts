'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { diffDiasCivis, hojeIsoEmBrasil, isoDiaPrazo } from '@/lib/datetime/brazil'
import type { Processo, ProcessoComCliente, EtapaKanban, AreaDireito, TipoPrazo } from '@/types/database'

export type KanbanFiltroVencimento = 'todos' | '7d' | '15d' | 'atrasados' | 'sem_pendente'
export type KanbanFiltroTipoPrazo = 'todos' | TipoPrazo

interface ProcessosFiltros {
  etapa_id?: string
  area?: AreaDireito
  cliente_id?: string
  search?: string
  /** Título ou número do processo (ilike) — use com `limit` curto no UI */
  buscaLivre?: string
  arquivado?: boolean
  responsavel_id?: string
  prioridade?: 1 | 2 | 3
  prazo_vencimento?: KanbanFiltroVencimento
  tipo_prazo?: KanbanFiltroTipoPrazo
}

export function processoMatchesKanbanPrazoFiltros(
  p: ProcessoComCliente,
  fv: KanbanFiltroVencimento,
  ft: KanbanFiltroTipoPrazo,
) {
  const allPend = (p.prazos ?? []).filter(z => z.status === 'pendente')
  let pend = allPend
  if (ft !== 'todos') pend = pend.filter(z => z.tipo === ft)

  if (fv === 'todos' && ft === 'todos') return true

  if (fv === 'todos') {
    return pend.length > 0
  }

  if (fv === 'sem_pendente') {
    if (ft === 'todos') return allPend.length === 0
    return pend.length === 0
  }

  const hoje = hojeIsoEmBrasil()
  if (fv === 'atrasados') {
    return pend.some(z => diffDiasCivis(isoDiaPrazo(z.data_prazo), hoje) < 0)
  }
  if (fv === '7d') {
    return pend.some(z => {
      const d = diffDiasCivis(isoDiaPrazo(z.data_prazo), hoje)
      return d >= 0 && d <= 7
    })
  }
  if (fv === '15d') {
    return pend.some(z => {
      const d = diffDiasCivis(isoDiaPrazo(z.data_prazo), hoje)
      return d >= 0 && d <= 15
    })
  }
  return true
}

export function useEtapasKanban() {
  return useQuery({
    queryKey: ['etapas'],
    queryFn: async () => {
      const supabase = createClient()
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

export function useProcessos(filtros: ProcessosFiltros = {}) {
  const fv = filtros.prazo_vencimento ?? 'todos'
  const ft = filtros.tipo_prazo ?? 'todos'
  const buscandoLivre = filtros.buscaLivre !== undefined
  const buscaLivreOk = !buscandoLivre || (filtros.buscaLivre?.trim().length ?? 0) >= 2
  return useQuery({
    queryKey: ['processos', filtros],
    enabled: buscaLivreOk,
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('processos')
        .select(`
          *,
          cliente:clientes(id,nome,tipo),
          etapa:etapas_kanban(id,nome,cor,ordem),
          prazos(id,data_prazo,status,tipo)
        `)
        .eq('arquivado', filtros.arquivado ?? false)
      if (filtros.etapa_id) q = q.eq('etapa_id', filtros.etapa_id)
      if (filtros.area) q = q.eq('area', filtros.area)
      if (filtros.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
      if (filtros.search) q = q.ilike('titulo', `%${filtros.search}%`)
      if (filtros.buscaLivre !== undefined && filtros.buscaLivre.trim().length >= 2) {
        const t = filtros.buscaLivre.trim().replace(/%/g, '\\%')
        q = q.or(`titulo.ilike.%${t}%,numero_processo.ilike.%${t}%`)
        q = q.limit(40)
      }
      if (filtros.responsavel_id) q = q.eq('responsavel_id', filtros.responsavel_id)
      if (filtros.prioridade) q = q.eq('prioridade', filtros.prioridade)
      const { data, error } = await q
      if (error) throw error
      let rows = (data ?? []) as ProcessoComCliente[]
      if (fv !== 'todos' || ft !== 'todos') {
        rows = rows.filter(p => processoMatchesKanbanPrazoFiltros(p, fv, ft))
      }
      // Ordenar por coluna (ordem da etapa) e posição no kanban — um único order('kanban_ordem') misturava as colunas
      rows.sort((a, b) => {
        const oa = a.etapa?.ordem ?? 0
        const ob = b.etapa?.ordem ?? 0
        if (oa !== ob) return oa - ob
        return (a.kanban_ordem ?? 0) - (b.kanban_ordem ?? 0)
      })
      return rows
    },
  })
}

export function useProcesso(id: string) {
  return useQuery({
    queryKey: ['processos', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('processos')
        .select(`
          *,
          cliente:clientes(id,nome,tipo,email,telefone),
          etapa:etapas_kanban(id,nome,cor),
          movimentacoes(*),
          tarefas(*),
          prazos(*),
          documentos(*),
          honorarios(*),
          lancamentos(*)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateProcesso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Processo, 'id' | 'created_at' | 'updated_at'>) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('processos').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['processos'] }),
  })
}

export function useUpdateProcesso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Processo> & { id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase.from('processos').update(values).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['processos'] })
      qc.invalidateQueries({ queryKey: ['processos', vars.id] })
    },
  })
}

export function useMoverProcesso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, etapa_id, kanban_ordem }: { id: string; etapa_id: string; kanban_ordem: number }) => {
      const supabase = createClient()
      const { error } = await supabase.from('processos').update({ etapa_id, kanban_ordem }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['processos'] }),
  })
}

/** Persiste etapa + ordem de todos os cards do layout (após drag). */
export function usePersistirLayoutKanban() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: { id: string; etapa_id: string; kanban_ordem: number }[]) => {
      const supabase = createClient()
      for (const r of rows) {
        const { error } = await supabase
          .from('processos')
          .update({ etapa_id: r.etapa_id, kanban_ordem: r.kanban_ordem })
          .eq('id', r.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['processos'] }),
  })
}
