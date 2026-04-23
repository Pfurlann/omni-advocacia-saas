'use client'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  useEtapasKanban,
  useProcessos,
  usePersistirLayoutKanban,
  type KanbanFiltroTipoPrazo,
  type KanbanFiltroVencimento,
} from '@/hooks/useProcessos'
import {
  colisaoKanban,
  inserirProcessoAposMover,
  layoutParaAtualizacoes,
  moverParaFimDaColuna,
  reordenarMesmaColuna,
} from '@/lib/kanban-dnd'
import { useMeuPapelEscritorio, useEscritorioMembros } from '@/hooks/useEscritorioMembros'
import { KanbanColuna } from './KanbanColuna'
import { KanbanCard, KanbanCardArrastarPreview } from './KanbanCard'
import { ProcessoPanel } from './ProcessoPanel'
import type { ProcessoComCliente } from '@/types/database'
import { toast } from 'sonner'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { FormProcesso } from '@/components/processos/FormProcesso'
import { useOpcoesCadastro } from '@/hooks/useOpcoesCadastro'

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0' } },
  }),
}

export function KanbanBoard() {
  const { data: etapas = [], isLoading: loadingEtapas } = useEtapasKanban()
  const { data: me } = useMeuPapelEscritorio()
  const { data: membros = [] } = useEscritorioMembros()
  const { data: opcoes = [] } = useOpcoesCadastro()
  const opAreas = opcoes.filter(o => o.categoria === 'area' && o.ativo)
  const opPri = opcoes.filter(o => o.categoria === 'prioridade_processo' && o.ativo)
  const opTiposPrazo = opcoes.filter(o => o.categoria === 'tipo_prazo' && o.ativo)

  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroVencimento, setFiltroVencimento] = useState<KanbanFiltroVencimento>('todos')
  const [filtroTipoPrazo, setFiltroTipoPrazo] = useState<KanbanFiltroTipoPrazo>('todos')

  const { data: processos = [], isLoading: loadingProcessos } = useProcessos({
    responsavel_id: filtroResponsavel || undefined,
    prioridade: filtroPrioridade || undefined,
    area: filtroArea || undefined,
    prazo_vencimento: filtroVencimento,
    tipo_prazo: filtroTipoPrazo,
  })
  const persistirLayout = usePersistirLayoutKanban()
  const listagemDuranteArraste = useRef<ProcessoComCliente[] | null>(null)

  const nomesResponsaveis = useMemo(
    () => Object.fromEntries(membros.map(m => [m.user_id, m.full_name ?? ''])),
    [membros],
  )
  const fotosResponsaveis = useMemo(
    () => Object.fromEntries(membros.map(m => [m.user_id, m.avatar_url ?? null])),
    [membros],
  )

  // ── UI state ──
  const [activeId, setActiveId]                 = useState<string | null>(null)
  const [showForm, setShowForm]                 = useState(false)
  const [etapaInicial, setEtapaInicial]         = useState<string>()
  const [panelProcessoId, setPanelProcessoId]   = useState<string | null>(null)

  // Optimistic local state durante drag
  const [localProcessos, setLocalProcessos] = useState<ProcessoComCliente[] | null>(null)
  const lista = localProcessos ?? processos

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeProcesso = activeId ? lista.find(p => p.id === activeId) ?? null : null

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setLocalProcessos(prev => {
      const b = prev ?? processos
      listagemDuranteArraste.current = b
      return b
    })
  }

  useEffect(() => {
    if (localProcessos) listagemDuranteArraste.current = localProcessos
  }, [localProcessos])

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return
      const activeId = String(active.id)
      const overId = String(over.id)
      if (activeId === overId) return

      setLocalProcessos(prev => {
        const base = prev ?? processos
        const activeProcesso = base.find(p => p.id === activeId)
        if (!activeProcesso) return base

        const isOverColumn = etapas.some(e => e.id === overId)
        const targetEtapaId = isOverColumn
          ? overId
          : (base.find(p => p.id === overId)?.etapa_id as string | undefined)
        if (!targetEtapaId) return base

        if (activeProcesso.etapa_id === targetEtapaId && isOverColumn) {
          return moverParaFimDaColuna(base, activeId, targetEtapaId)
        }
        if (activeProcesso.etapa_id !== targetEtapaId) {
          return inserirProcessoAposMover(base, activeId, overId, targetEtapaId, isOverColumn, etapas)
        }
        if (!isOverColumn) {
          return reordenarMesmaColuna(base, activeId, overId)
        }
        return base
      })
    },
    [processos, etapas],
  )

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const list = listagemDuranteArraste.current ?? localProcessos ?? processos
    listagemDuranteArraste.current = null

    if (!over) {
      setLocalProcessos(null)
      return
    }

    const updates = layoutParaAtualizacoes(list, etapas)
    const precisa =
      updates.length > 0
      && updates.some(u => {
        const o = processos.find(p => p.id === u.id)
        return !o || o.etapa_id !== u.etapa_id || o.kanban_ordem !== u.kanban_ordem
      })

    if (precisa) {
      try {
        await persistirLayout.mutateAsync(updates)
        const aId = String(active.id)
        const pAfter = list.find(p => p.id === aId)
        const pBefore = processos.find(p => p.id === aId)
        if (pAfter && pBefore && pAfter.etapa_id !== pBefore.etapa_id) {
          const etapaNova = etapas.find(e => e.id === pAfter.etapa_id)
          toast.success(`Movido para “${etapaNova?.nome ?? 'coluna'}”`)
        } else {
          toast.success('Ordem atualizada')
        }
      } catch {
        toast.error('Erro ao salvar o kanban')
        setLocalProcessos(null)
        return
      }
    }

    setLocalProcessos(null)
  }

  const onDragCancel = () => {
    setActiveId(null)
    setLocalProcessos(null)
  }

  const handleNovoProcesso = (etapa_id?: string) => {
    setEtapaInicial(etapa_id)
    setShowForm(true)
  }

  const handleOpenProcesso = (id: string) => {
    setPanelProcessoId(id)
  }

  if (loadingEtapas || loadingProcessos) {
    return (
      <div className="flex items-center justify-center h-full">
        <OmniSpinner size="lg" variant="dark" />
      </div>
    )
  }

  const mostrarFiltroAdvogado = me?.isGestor ?? false

  const arrastarHabilitado =
    !filtroResponsavel
    && !filtroPrioridade
    && !filtroArea
    && filtroVencimento === 'todos'
    && filtroTipoPrazo === 'todos'

  return (
    <>
      <p className="text-xs text-muted-foreground mb-3 shrink-0">
        Arraste os processos entre as etapas.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
        {mostrarFiltroAdvogado && (
          <select
            value={filtroResponsavel}
            onChange={e => setFiltroResponsavel(e.target.value)}
            className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os advogados</option>
            {membros.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name?.trim() || m.user_id.slice(0, 8) + '…'}
              </option>
            ))}
          </select>
        )}
        <select
          value={filtroPrioridade}
          onChange={e => setFiltroPrioridade(e.target.value)}
          className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Prioridade: todas</option>
          {opPri.map(p => (
            <option key={p.id} value={p.id}>{p.rotulo}</option>
          ))}
        </select>
        <select
          value={filtroArea}
          onChange={e => setFiltroArea(e.target.value)}
          className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Área: todas</option>
          {opAreas.map(a => (
            <option key={a.id} value={a.id}>{a.rotulo}</option>
          ))}
        </select>
        <select
          value={filtroVencimento}
          onChange={e => setFiltroVencimento(e.target.value as KanbanFiltroVencimento)}
          className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="todos">Prazos: qualquer</option>
          <option value="7d">Vence em até 7 dias</option>
          <option value="15d">Vence em até 15 dias</option>
          <option value="atrasados">Com prazo atrasado</option>
          <option value="sem_pendente">Sem prazo pendente</option>
        </select>
        <select
          value={filtroTipoPrazo}
          onChange={e => setFiltroTipoPrazo(e.target.value as KanbanFiltroTipoPrazo)}
          className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[200px]"
        >
          <option value="todos">Tipo de prazo: todos</option>
          {opTiposPrazo.map(t => (
            <option key={t.id} value={t.id}>{t.rotulo}</option>
          ))}
        </select>
      </div>

      {!arrastarHabilitado && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 mb-3">
          Filtros ativos: o arraste entre colunas está desativado. Limpe os filtros para reorganizar o quadro.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={colisaoKanban}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4 kanban-scroll">
          {etapas.map(etapa => (
            <KanbanColuna
              key={etapa.id}
              etapa={etapa}
              processos={lista.filter(p => p.etapa_id === etapa.id)}
              nomesResponsaveis={nomesResponsaveis}
              fotosResponsaveis={fotosResponsaveis}
              onNovoProcesso={() => handleNovoProcesso(etapa.id)}
              onOpenProcesso={handleOpenProcesso}
              arrastarHabilitado={arrastarHabilitado}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeProcesso
            ? (
                <KanbanCardArrastarPreview
                  processo={activeProcesso}
                  responsavelNome={nomesResponsaveis[activeProcesso.responsavel_id]?.trim() || null}
                  responsavelFotoUrl={fotosResponsaveis[activeProcesso.responsavel_id] ?? null}
                />
              )
            : null}
        </DragOverlay>
      </DndContext>

      {/* Slide-over panel */}
      <ProcessoPanel
        processoId={panelProcessoId}
        onClose={() => setPanelProcessoId(null)}
      />

      {showForm && (
        <FormProcesso
          etapaId={etapaInicial}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}
