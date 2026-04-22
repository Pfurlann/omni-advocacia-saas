'use client'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import type { EtapaKanban, ProcessoComCliente } from '@/types/database'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/formatters'

interface Props {
  etapa: EtapaKanban
  processos: ProcessoComCliente[]
  nomesResponsaveis: Record<string, string>
  /** URL da foto por user_id (equipe) */
  fotosResponsaveis: Record<string, string | null>
  onNovoProcesso: () => void
  onOpenProcesso: (id: string) => void
  arrastarHabilitado: boolean
}

export function KanbanColuna({ etapa, processos, nomesResponsaveis, fotosResponsaveis, onNovoProcesso, onOpenProcesso, arrastarHabilitado }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })

  const totalValor = processos.reduce((sum, p) => sum + (p.valor_causa ?? 0), 0)

  return (
    <div className="flex flex-col shrink-0 w-[280px]">
      {/* ── Header da coluna ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: etapa.cor }}
          />
          <span className="text-sm font-semibold text-foreground truncate">{etapa.nome}</span>

          {/* Badge de quantidade */}
          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5 font-medium tabular-nums shrink-0">
            {processos.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {/* Total da coluna */}
          {totalValor > 0 && (
            <span
              className="text-xs font-semibold rounded-full px-2 py-0.5"
              style={{
                backgroundColor: etapa.cor + '18',
                color: etapa.cor,
              }}
              title={`Soma dos valores da causa`}
            >
              {formatCompact(totalValor)}
            </span>
          )}

          <button
            onClick={onNovoProcesso}
            className="p-1 rounded-lg hover:bg-border text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            title="Novo processo"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto rounded-xl p-2 min-h-[120px] space-y-2',
          'transition-all duration-150',
          isOver
            ? 'bg-primary/5 ring-2 ring-primary/20 ring-inset'
            : 'bg-secondary/60',
        )}
      >
        <SortableContext items={processos.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {processos.map(processo => (
            <KanbanCard
              key={processo.id}
              processo={processo}
              responsavelNome={nomesResponsaveis[processo.responsavel_id]?.trim() || null}
              responsavelFotoUrl={fotosResponsaveis[processo.responsavel_id] ?? null}
              onOpen={onOpenProcesso}
              arrastarHabilitado={arrastarHabilitado}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {processos.length === 0 && (
          <div
            className={cn(
              'flex flex-col items-center justify-center py-10 rounded-lg transition-colors duration-150',
              isOver ? 'bg-primary/10' : '',
            )}
          >
            <p className="text-xs text-muted-foreground/70 text-center">
              {isOver ? '↓ Solte aqui' : 'Sem processos'}
            </p>
          </div>
        )}

        {/* Drop indicator no final */}
        {isOver && processos.length > 0 && (
          <div
            className="h-1 rounded-full mx-1 transition-all duration-150"
            style={{ backgroundColor: etapa.cor + '60' }}
          />
        )}
      </div>
    </div>
  )
}
