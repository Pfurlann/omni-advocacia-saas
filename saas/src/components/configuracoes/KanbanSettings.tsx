'use client'
import { useState, useRef } from 'react'
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useEtapas, useCreateEtapa, useUpdateEtapa,
  useReordenarEtapas, useDeleteEtapa,
} from '@/hooks/useEtapas'
import { useEscritorio } from '@/hooks/useEscritorio'
import type { EtapaKanban } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  GripVertical, Plus, Trash2, Check, X,
  Flag, FlagOff, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

// ─── Paleta de cores rápidas ──────────────────────────────────────────────────
const CORES = [
  '#8b5cf6', '#f59e0b', '#3b82f6', '#f97316',
  '#06b6d4', '#ec4899', '#22c55e', '#ef4444',
  '#6366f1', '#14b8a6', '#84cc16', '#6b7280',
]

// ─── Item arrastável ──────────────────────────────────────────────────────────
function EtapaItem({
  etapa,
  onSave,
  onDelete,
}: {
  etapa: EtapaKanban
  onSave: (id: string, values: Partial<EtapaKanban>) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: etapa.id })

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(etapa.nome)
  const [cor, setCor] = useState(etapa.cor)
  const [showCores, setShowCores] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const style = { transform: CSS.Transform.toString(transform), transition }

  const salvar = () => {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    onSave(etapa.id, { nome: nome.trim(), cor })
    setEditando(false)
    setShowCores(false)
  }

  const cancelar = () => {
    setNome(etapa.nome)
    setCor(etapa.cor)
    setEditando(false)
    setShowCores(false)
  }

  const toggleFinal = () => onSave(etapa.id, { is_final: !etapa.is_final, is_inicial: false })
  const toggleInicial = () => onSave(etapa.id, { is_inicial: !etapa.is_inicial, is_final: false })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3 transition-shadow',
        isDragging && 'shadow-xl opacity-80 z-50',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition shrink-0"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Cor / color picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => { if (editando) setShowCores(v => !v) }}
          className={cn(
            'w-6 h-6 rounded-full border-2 border-white shadow ring-2 ring-offset-1 transition',
            editando ? 'cursor-pointer hover:scale-110' : 'cursor-default',
          )}
          style={{ backgroundColor: cor, '--tw-ring-color': cor } as React.CSSProperties}
          title={editando ? 'Mudar cor' : ''}
        />
        {showCores && editando && (
          <div className="absolute top-8 left-0 z-20 bg-white border border-border rounded-xl shadow-lg p-3 w-44">
            <div className="grid grid-cols-6 gap-1.5">
              {CORES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCor(c); setShowCores(false) }}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition hover:scale-110',
                    cor === c ? 'border-foreground/80' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-muted-foreground/70">Hex</label>
              <input
                type="color"
                value={cor}
                onChange={e => setCor(e.target.value)}
                className="w-full h-7 rounded cursor-pointer border border-border"
              />
            </div>
          </div>
        )}
      </div>

      {/* Nome (editável inline) */}
      <div className="flex-1 min-w-0">
        {editando ? (
          <input
            ref={inputRef}
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') cancelar() }}
            autoFocus
            className="w-full text-sm font-medium bg-secondary/60 border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <span className="text-sm font-medium text-foreground">{etapa.nome}</span>
        )}

        {/* Badges de papel */}
        <div className="flex items-center gap-1.5 mt-1">
          {etapa.is_inicial && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Etapa inicial</span>
          )}
          {etapa.is_final && (
            <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">Etapa final</span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className={cn('flex items-center gap-1 shrink-0', editando ? 'flex' : 'opacity-0 group-hover:opacity-100 transition-opacity')}>
        {editando ? (
          <>
            <button onClick={salvar} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition" title="Salvar"><Check className="h-4 w-4" /></button>
            <button onClick={cancelar} className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:bg-border transition" title="Cancelar"><X className="h-4 w-4" /></button>
          </>
        ) : (
          <>
            {/* Toggle inicial */}
            <button
              onClick={toggleInicial}
              title={etapa.is_inicial ? 'Remover como inicial' : 'Marcar como etapa inicial'}
              className={cn('p-1.5 rounded-lg transition', etapa.is_inicial ? 'bg-primary/10 text-primary' : 'text-muted-foreground/70 hover:bg-secondary hover:text-primary')}
            >
              <Flag className="h-3.5 w-3.5" />
            </button>

            {/* Toggle final */}
            <button
              onClick={toggleFinal}
              title={etapa.is_final ? 'Remover como final' : 'Marcar como etapa final'}
              className={cn('p-1.5 rounded-lg transition', etapa.is_final ? 'bg-green-100 text-green-600' : 'text-muted-foreground/70 hover:bg-secondary hover:text-green-500')}
            >
              <FlagOff className="h-3.5 w-3.5" />
            </button>

            {/* Editar */}
            <button
              onClick={() => setEditando(true)}
              className="p-1.5 rounded-lg text-muted-foreground/70 hover:bg-secondary hover:text-primary transition"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {/* Deletar */}
            <button
              onClick={() => onDelete(etapa.id)}
              className="p-1.5 rounded-lg text-muted-foreground/70 hover:bg-red-50 hover:text-red-500 transition"
              title="Remover etapa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function KanbanSettings() {
  const { data: escritorio, isLoading: loadingEscritorio } = useEscritorio()
  const { data: etapas = [], isLoading: loadingEtapas } = useEtapas()
  const create = useCreateEtapa()
  const update = useUpdateEtapa()
  const reordenar = useReordenarEtapas()
  const deletar = useDeleteEtapa()

  // Form nova etapa
  const [novaAberta, setNovaAberta] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState('#6366f1')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const ids = etapas.map(et => et.id)
    const oldIdx = ids.indexOf(String(active.id))
    const newIdx = ids.indexOf(String(over.id))
    const novaOrdem = arrayMove(etapas, oldIdx, newIdx)

    reordenar.mutate(novaOrdem.map((et, i) => ({ id: et.id, ordem: i })))
  }

  const handleSave = (id: string, values: Partial<EtapaKanban>) => {
    update.mutate({ id, ...values })
  }

  const handleDelete = (id: string) => {
    const etapa = etapas.find(e => e.id === id)
    if (confirm(`Remover a etapa "${etapa?.nome}"? Os processos devem ser movidos antes.`)) {
      deletar.mutate(id)
    }
  }

  const handleCreate = async () => {
    if (!novoNome.trim()) {
      toast.error('Digite um nome para a etapa')
      return
    }
    if (!escritorio) {
      toast.error('Escritório não carregado. Cadastre o escritório em Configurações.')
      return
    }
    try {
      await create.mutateAsync({ escritorio_id: escritorio.id, nome: novoNome.trim(), cor: novaCor })
      setNovoNome('')
      setNovaCor('#6366f1')
      setNovaAberta(false)
    } catch {
      /* toast já exibido pelo mutation onError */
    }
  }

  if (loadingEscritorio || loadingEtapas) {
    return (
      <div className="flex justify-center py-12">
        <OmniSpinner size="md" />
      </div>
    )
  }

  if (!escritorio) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Nenhum escritório encontrado</p>
        <p className="mt-1 text-amber-800/90">
          Cadastre o escritório na aba <span className="font-semibold">Escritório</span> desta página.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Etapas do Kanban</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Arraste para reordenar · Clique em <Pencil className="inline h-3 w-3" /> para editar nome e cor ·{' '}
            <Flag className="inline h-3 w-3 text-primary" /> marca como entrada padrão ·{' '}
            <FlagOff className="inline h-3 w-3 text-green-500" /> marca como encerramento
          </p>
        </div>
        <button
          onClick={() => setNovaAberta(v => !v)}
          className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Nova etapa
        </button>
      </div>

      {/* Form nova etapa */}
      {novaAberta && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          {/* Color picker */}
          <div className="relative shrink-0">
            <input
              type="color"
              value={novaCor}
              onChange={e => setNovaCor(e.target.value)}
              className="w-7 h-7 rounded-full cursor-pointer border-2 border-white shadow"
              style={{ backgroundColor: novaCor }}
              title="Escolher cor"
            />
          </div>

          {/* Seleção rápida de cor */}
          <div className="flex items-center gap-1">
            {CORES.slice(0, 8).map(c => (
              <button
                key={c}
                onClick={() => setNovaCor(c)}
                className={cn('w-5 h-5 rounded-full border-2 transition hover:scale-110', novaCor === c ? 'border-foreground/80' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setNovaAberta(false) }}
            placeholder="Nome da etapa..."
            autoFocus
            className="flex-1 text-sm bg-white border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            onClick={handleCreate}
            disabled={!novoNome.trim() || create.isPending || !escritorio}
            className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-40 transition"
            title="Criar"
          >
            {create.isPending ? <OmniSpinner size="xs" variant="dark" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setNovaAberta(false)}
            className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:bg-border transition"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Lista com DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={etapas.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {etapas.map(etapa => (
              <EtapaItem
                key={etapa.id}
                etapa={etapa}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {etapas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground/70 text-sm">
          Nenhuma etapa configurada. Clique em "Nova etapa" para começar.
        </div>
      )}

      <p className="text-xs text-muted-foreground/70 pt-2">
        {etapas.length} etapa{etapas.length !== 1 ? 's' : ''} configurada{etapas.length !== 1 ? 's' : ''}
        {etapas.filter(e => e.is_inicial).length === 0 && (
          <span className="text-amber-500 ml-2">· Nenhuma etapa marcada como inicial</span>
        )}
      </p>
    </div>
  )
}
