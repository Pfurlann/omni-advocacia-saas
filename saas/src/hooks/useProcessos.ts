'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { diffDiasCivis, hojeIsoEmBrasil, isoDiaPrazo } from '@/lib/datetime/brazil'
import type { Processo, ProcessoComCliente, ProcessoDetalhado, EtapaKanban } from '@/types/database'

export type KanbanFiltroVencimento = 'todos' | '7d' | '15d' | 'atrasados' | 'sem_pendente'
export type KanbanFiltroTipoPrazo = 'todos' | string

interface ProcessosFiltros {
  etapa_id?: string
  /** ID em opcoes_cadastro (categoria area) */
  area?: string
  cliente_id?: string
  search?: string
  /** Título ou número do processo (ilike) — use com `limit` curto no UI */
  buscaLivre?: string
  arquivado?: boolean
  responsavel_id?: string
  /** ID em opcoes_cadastro (categoria prioridade_processo) */
  prioridade?: string
  prazo_vencimento?: KanbanFiltroVencimento
  /** ID em opcoes_cadastro (categoria tipo_prazo) */
  tipo_prazo?: KanbanFiltroTipoPrazo
  /** Quando `false`, não executa a query (ex.: modal de busca fechado). */
  enabled?: boolean
}

export function processoMatchesKanbanPrazoFiltros(
  p: ProcessoComCliente,
  fv: KanbanFiltroVencimento,
  ft: KanbanFiltroTipoPrazo,
) {
  const allPend = (p.prazos ?? []).filter(z => z.status === 'pendente')
  let pend = allPend
  if (ft !== 'todos') pend = pend.filter(z => z.tipo_prazo_id === ft)

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
  const enabledFlag = filtros.enabled !== false
  return useQuery({
    queryKey: ['processos', filtros],
    enabled: enabledFlag && buscaLivreOk,
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('processos')
        .select(`
          *,
          cliente:clientes(id,nome,tipo),
          etapa:etapas_kanban(id,nome,cor,ordem),
          area:opcoes_cadastro!area_id(id,slug,rotulo,ordem,cor),
          prioridade:opcoes_cadastro!prioridade_id(id,slug,rotulo,ordem,cor),
          prazos(
            id,data_prazo,status,tipo_prazo_id,
            tipo_prazo:opcoes_cadastro!tipo_prazo_id(id,slug,rotulo,ordem,cor)
          )
        `)
        .eq('arquivado', filtros.arquivado ?? false)
      if (filtros.etapa_id) q = q.eq('etapa_id', filtros.etapa_id)
      if (filtros.area) q = q.eq('area_id', filtros.area)
      if (filtros.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
      if (filtros.search) q = q.ilike('titulo', `%${filtros.search}%`)
      if (filtros.buscaLivre !== undefined && filtros.buscaLivre.trim().length >= 2) {
        const t = filtros.buscaLivre.trim().replace(/%/g, '\\%')
        q = q.or(`titulo.ilike.%${t}%,numero_processo.ilike.%${t}%`)
        q = q.limit(40)
      }
      if (filtros.responsavel_id) q = q.eq('responsavel_id', filtros.responsavel_id)
      if (filtros.prioridade) q = q.eq('prioridade_id', filtros.prioridade)
      const { data, error } = await q
      if (error) throw error
      const raw = (data ?? []) as ProcessoComCliente[]
      const norm = (v: unknown) => (Array.isArray(v) ? v[0] : v)
      let rows = raw.map(p => {
        const prazos = (p.prazos ?? []).map(z => ({
          ...z,
          tipo_prazo: norm((z as { tipo_prazo?: unknown }).tipo_prazo),
        }))
        return {
          ...p,
          area: norm(p.area),
          prioridade: norm(p.prioridade),
          prazos,
        } as ProcessoComCliente
      })
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
          area:opcoes_cadastro!area_id(id,slug,rotulo,ordem,cor),
          prioridade:opcoes_cadastro!prioridade_id(id,slug,rotulo,ordem,cor),
          movimentacoes(*),
          tarefas(*),
          prazos(
            *,
            tipo_prazo:opcoes_cadastro!tipo_prazo_id(id,slug,rotulo,ordem,cor)
          ),
          documentos(*),
          honorarios(*),
          lancamentos(*)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      const d = data as Record<string, unknown>
      const norm = (v: unknown) => (Array.isArray(v) ? v[0] : v)
      const prs = ((d.prazos as unknown[]) ?? []).map(z => {
        const row = z as { tipo_prazo?: unknown }
        return { ...row, tipo_prazo: norm(row.tipo_prazo) }
      })
      return {
        ...d,
        area: norm(d.area),
        prioridade: norm(d.prioridade),
        prazos: prs,
      } as unknown as ProcessoDetalhado
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

/** Uma linha p/ rótulo em pickers (evita puxar o processo completo). */
export function useProcessoResumo(id: string | undefined) {
  return useQuery({
    queryKey: ['processos', 'resumo', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('processos')
        .select('id, titulo, numero_processo, cliente_id')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as { id: string; titulo: string; numero_processo: string | null; cliente_id: string }
    },
    staleTime: 60_000,
  })
}

/** Lista leve para selects (lançamentos): não filtra por prazos do Kanban. */
export function useProcessosSelectLancamento(clienteId?: string | null, queryEnabled: boolean = true) {
  return useQuery({
    queryKey: ['processos-lanc-select', clienteId ?? 'all'],
    enabled: queryEnabled,
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('processos')
        .select('id, titulo, numero_processo, cliente_id')
        .eq('arquivado', false)
        .order('updated_at', { ascending: false })
        .limit(500)
      if (clienteId) q = q.eq('cliente_id', clienteId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        titulo: string
        numero_processo: string | null
        cliente_id: string
      }>
    },
    staleTime: 60_000,
  })
}
