'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Calendar, Columns3, Users } from 'lucide-react'
import type { AgendaViewMode } from '@/lib/agenda/range'
import type { MembroComNome } from '@/hooks/useEscritorioMembros'
import { agendaColorForUserId, iniciaisNome } from '@/lib/agenda/memberColors'

type Props = {
  /** Com Google ligado, gravar “mostrar prazos Omni” nas preferências */
  canPersistOmniLayer: boolean
  localOmni: boolean
  setLocalOmni: (v: boolean) => void
  savePreferences: (b: { showOmniLayer?: boolean }) => Promise<void>
  prazoResponsavelSelecionados: Set<string>
  onToggleResponsavel: (userId: string) => void
  onSelecionarTodosResponsaveis: () => void
  membros: MembroComNome[]
  viewMode: AgendaViewMode
  setViewMode: (m: AgendaViewMode) => void
  /** Mostra linha na legenda para eventos Google (conta ligada) */
  mostrarLegendaGoogle: boolean
}

const MODES: { id: AgendaViewMode; label: string }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
]

export function AgendaSidebar({
  canPersistOmniLayer,
  localOmni,
  setLocalOmni,
  savePreferences,
  prazoResponsavelSelecionados,
  onToggleResponsavel,
  onSelecionarTodosResponsaveis,
  membros,
  viewMode,
  setViewMode,
  mostrarLegendaGoogle,
}: Props) {
  const tudoSelecionado =
    membros.length > 0
    && membros.every(m => prazoResponsavelSelecionados.has(m.user_id))
    && prazoResponsavelSelecionados.size === membros.length

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 w-[272px] shrink-0 flex-col overflow-y-auto border-r border-border/80',
        'bg-gradient-to-b from-muted/25 via-white to-white',
        'self-stretch',
      )}
    >
      <div className="p-3 border-b border-border/60">
        <div className="flex items-center gap-2 text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Agenda</h2>
        </div>
      </div>

      <div className="p-3 space-y-3 border-b border-border/50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vista</p>
        <div className="flex rounded-lg border border-border/80 bg-white p-0.5 shadow-sm" role="tablist" aria-label="Modo de calendário">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={viewMode === m.id}
              onClick={() => setViewMode(m.id)}
              className={cn(
                'flex-1 text-center text-[11px] font-medium py-1.5 rounded-md transition',
                viewMode === m.id
                  ? 'bg-primary/12 text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2 border-b border-border/50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Columns3 className="h-3 w-3" /> Prazos Omni
        </p>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={localOmni}
            onChange={e => {
              const on = e.target.checked
              setLocalOmni(on)
              if (canPersistOmniLayer) void savePreferences({ showOmniLayer: on })
            }}
          />
          <span className="font-medium text-foreground/90">Mostrar prazos do escritório</span>
        </label>

        {localOmni && membros.length > 0 && (
          <div className="pl-0.5 space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Filtrar por advogado</span>
              </div>
              {!tudoSelecionado && (
                <button
                  type="button"
                  className="text-[10px] font-medium text-primary hover:underline"
                  onClick={onSelecionarTodosResponsaveis}
                >
                  Todos
                </button>
              )}
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto pl-0.5">
              {membros.map(m => {
                const on = tudoSelecionado || prazoResponsavelSelecionados.has(m.user_id)
                return (
                  <li key={m.user_id}>
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer text-muted-foreground">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={on}
                        onChange={() => { onToggleResponsavel(m.user_id) }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-sm shrink-0"
                        style={{ background: agendaColorForUserId(m.user_id).border }}
                        aria-hidden
                      />
                      <span className="truncate">{m.full_name ?? 'Sem nome'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {localOmni && membros.length > 0 && (
        <div className="p-3 space-y-2 border-b border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
          <p className="text-[10px] text-muted-foreground leading-snug">Cada cor corresponde ao responsável pelo prazo. Passa o rato no retrato no calendário para ver o nome.</p>
          <ul className="space-y-1.5">
            {membros.map(m => {
              const col = agendaColorForUserId(m.user_id)
              const name = m.full_name ?? '—'
              return (
                <li key={m.user_id} className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: col.border }}
                    title={name}
                    aria-label={name}
                  />
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover border shrink-0"
                      style={{ borderColor: col.border }}
                    />
                  ) : (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: col.border }}
                      title={name}
                    >
                      {iniciaisNome(m.full_name)}
                    </span>
                  )}
                  <span className="text-[10px] text-foreground/90 truncate" title={name}>
                    {name}
                  </span>
                </li>
              )
            })}
            {mostrarLegendaGoogle && (
              <li className="flex items-center gap-2 pt-1 border-t border-border/40">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-slate-400" aria-hidden />
                <span className="w-5 h-5 rounded-full bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] font-bold text-slate-700 shrink-0">
                  G
                </span>
                <span className="text-[10px] text-muted-foreground">Google (a tua conta)</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="p-3 mt-auto border-t border-border/50">
        <Link
          href="/configuracoes?tab=integracoes"
          className="text-xs font-medium text-primary hover:underline block"
        >
          Google Calendário e sinc. de prazos →
        </Link>
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
          Liga a tua conta e escolhe calendários em Configurações.
        </p>
      </div>
    </aside>
  )
}
