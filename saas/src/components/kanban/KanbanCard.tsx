'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ProcessoComCliente } from '@/types/database'
import { AREA_LABELS, AREA_CORES } from '@/lib/constants'
import { AlertTriangle, Calendar, CheckSquare, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrazos } from '@/hooks/usePrazos'
import { useTarefas } from '@/hooks/useTarefas'
import { formatCompact } from '@/lib/formatters'

interface Props {
  processo: ProcessoComCliente
  /** Nome do advogado responsável (mapa da equipe); null para não exibir */
  responsavelNome?: string | null
  /** Foto do responsável (URL pública), quando existir */
  responsavelFotoUrl?: string | null
  onOpen?: (id: string) => void
  /** Filtros ativos: arrastar desligado (lista parcial / ordem no DB) */
  arrastarHabilitado?: boolean
}

const PRIORIDADE_BORDER: Record<number, string> = {
  1: 'border-l-destructive',
  2: 'border-l-primary',
  3: 'border-l-border',
}

const PRIORIDADE_DOT: Record<number, string> = {
  1: 'bg-destructive',
  2: 'bg-primary',
  3: 'bg-muted',
}

function PrazosIndicator({ processoId }: { processoId: string }) {
  const { data: prazos = [] } = usePrazos({ processo_id: processoId, status: 'pendente' })
  if (!prazos.length) return null
  const urgente = prazos.some(p => p.dias_restantes <= 3)
  const vencido = prazos.some(p => p.dias_restantes < 0)
  const proximo = prazos[0]
  return (
    <div className={cn(
      'flex items-center gap-1 text-xs font-medium',
      vencido ? 'text-red-500' : urgente ? 'text-amber-500' : 'text-muted-foreground/70',
    )}>
      {vencido || urgente
        ? <AlertTriangle className={cn('h-3 w-3', vencido && 'animate-pulse')} />
        : <Calendar className="h-3 w-3" />}
      <span>
        {proximo.dias_restantes < 0 ? 'Vencido' : proximo.dias_restantes === 0 ? 'Hoje' : `${proximo.dias_restantes}d`}
      </span>
    </div>
  )
}

function TarefasIndicator({ processoId }: { processoId: string }) {
  const { data: tarefas = [] } = useTarefas(processoId)
  if (!tarefas.length) return null
  const done = tarefas.filter(t => t.status === 'done').length
  const total = tarefas.length
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
      <CheckSquare className="h-3 w-3" />
      <span>{done}/{total}</span>
      <div className="w-10 h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-green-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CardConteudo({
  processo,
  responsavelNome = null,
  responsavelFotoUrl = null,
}: {
  processo: ProcessoComCliente
  responsavelNome?: string | null
  responsavelFotoUrl?: string | null
}) {
  const areaCor = AREA_CORES[processo.area] ?? '#6b7280'
  return (
    <>
      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
        {processo.titulo}
      </p>
      <p className="text-xs text-muted-foreground/70 truncate mb-2.5">
        {(processo as { cliente?: { nome?: string } }).cliente?.nome}
        {responsavelNome ? (
          <span className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
            {responsavelFotoUrl ? (
              <img
                src={responsavelFotoUrl}
                alt=""
                className="h-5 w-5 rounded-full object-cover shrink-0 border border-border bg-muted"
              />
            ) : null}
            <span className="min-w-0">Resp.: {responsavelNome}</span>
          </span>
        ) : null}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        <span
          className="text-xs px-1.5 py-0.5 rounded-md font-medium text-white"
          style={{ backgroundColor: areaCor }}
        >
          {AREA_LABELS[processo.area] ?? processo.area}
        </span>
        {processo.prioridade === 1 && (
          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-red-100 text-red-600">
            Alta
          </span>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2.5">
          <TarefasIndicator processoId={processo.id} />
          <PrazosIndicator processoId={processo.id} />
        </div>
        {processo.valor_causa != null && processo.valor_causa > 0 && (
          <div className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            <DollarSign className="h-3 w-3" />
            {formatCompact(processo.valor_causa).replace('R$ ', '')}
          </div>
        )}
      </div>
    </>
  )
}

/** Só o visual, sem `useSortable` — usado no DragOverlay (não duplicar sensores dnd). */
export function KanbanCardArrastarPreview({ processo, responsavelNome = null, responsavelFotoUrl = null }: Props) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-border border-l-4 p-3.5 select-none w-[256px] max-w-[90vw]',
        'cursor-grabbing shadow-2xl rotate-[1.5deg] scale-[1.04] ring-2 ring-primary/20',
        PRIORIDADE_BORDER[processo.prioridade] ?? 'border-l-gray-200',
      )}
    >
      <CardConteudo
        processo={processo}
        responsavelNome={responsavelNome}
        responsavelFotoUrl={responsavelFotoUrl}
      />
    </div>
  )
}

export function KanbanCard({
  processo,
  responsavelNome = null,
  responsavelFotoUrl = null,
  onOpen,
  arrastarHabilitado = true,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: processo.id, disabled: !arrastarHabilitado })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return
    onOpen?.(processo.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-white rounded-xl border border-border border-l-4 p-3.5 select-none group touch-manipulation',
        arrastarHabilitado && 'cursor-grab active:cursor-grabbing',
        !arrastarHabilitado && 'cursor-default',
        'hover:shadow-md transition-shadow duration-150',
        PRIORIDADE_BORDER[processo.prioridade] ?? 'border-l-gray-200',
        isDragging && 'opacity-30',
      )}
    >
      <CardConteudo
        processo={processo}
        responsavelNome={responsavelNome}
        responsavelFotoUrl={responsavelFotoUrl}
      />
    </div>
  )
}
