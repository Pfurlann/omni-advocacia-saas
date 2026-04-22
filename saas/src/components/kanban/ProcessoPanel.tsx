'use client'
import { useState, useEffect, useRef } from 'react'
import {
  X, ExternalLink, Flag, CheckSquare, FileText,
  Plus, ChevronRight, AlertTriangle,
  Calendar, User, Hash, Scale,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useProcesso } from '@/hooks/useProcessos'
import { usePrazos, useCreatePrazo, useConcluirPrazo } from '@/hooks/usePrazos'
import { useTarefas, useCreateTarefa, useToggleTarefa } from '@/hooks/useTarefas'
import { useAddMovimentacao } from '@/hooks/useMovimentacoes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { formatCurrency, formatDate, formatHoraPrazo, horaPrazoParaBanco } from '@/lib/formatters'
import { AREA_LABELS, AREA_CORES, PRIORIDADE_CORES, TIPO_PRAZO_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TipoPrazo } from '@/types/database'

interface Props {
  processoId: string | null
  onClose: () => void
}

// ─── Slide-over panel ────────────────────────────────────────────────────────
export function ProcessoPanel({ processoId, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const prevId = useRef<string | null>(null)

  // Animação de entrada/saída
  useEffect(() => {
    if (processoId) {
      prevId.current = processoId
      // Micro-delay para CSS transition funcionar após mount
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [processoId])

  // Fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const activeId = processoId ?? prevId.current

  if (!activeId && !visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 flex flex-col bg-white shadow-2xl border-l border-border',
          'w-full max-w-[500px]',
          'transition-transform duration-200 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {activeId && <PainelConteudo processoId={activeId} onClose={onClose} />}
      </div>
    </>
  )
}

// ─── Conteúdo do painel ───────────────────────────────────────────────────────
function PainelConteudo({ processoId, onClose }: { processoId: string; onClose: () => void }) {
  const { data: escritorio } = useEscritorio()
  const { data: processo, isLoading } = useProcesso(processoId)
  const { data: prazos = [] } = usePrazos({ processo_id: processoId, status: 'pendente' })
  const { data: tarefas = [] } = useTarefas(processoId)

  const criarPrazo   = useCreatePrazo()
  const concluirPrazo = useConcluirPrazo()
  const criarTarefa  = useCreateTarefa()
  const toggleTarefa = useToggleTarefa()
  const addMov       = useAddMovimentacao()

  // Estados dos formulários inline
  const [novoPrazoOpen, setNovoPrazoOpen] = useState(false)
  const [prazoTitulo, setPrazoTitulo]     = useState('')
  const [prazoData, setPrazoData]         = useState('')
  const [prazoTipo, setPrazoTipo]         = useState<TipoPrazo>('prazo_interno')
  const [prazoHora, setPrazoHora]         = useState('')

  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false)
  const [tarefaTitulo, setTarefaTitulo]     = useState('')

  const [nota, setNota]         = useState('')
  const [savingNota, setSaving] = useState(false)

  // ── Handlers ──
  const handleAddPrazo = async () => {
    if (!prazoTitulo.trim() || !prazoData || !escritorio || !processo) return
    await criarPrazo.mutateAsync({
      escritorio_id: escritorio.id,
      processo_id: processoId,
      responsavel_id: processo.responsavel_id,
      titulo: prazoTitulo.trim(),
      tipo: prazoTipo,
      data_prazo: prazoData,
      hora_prazo: horaPrazoParaBanco(prazoHora),
      status: 'pendente',
      alerta_dias: 3,
      descricao: null,
    })
    setPrazoTitulo(''); setPrazoData(''); setPrazoHora(''); setNovoPrazoOpen(false)
    toast.success('Prazo adicionado. Aparece na Agenda e, com Google ligado, no teu calendário.', {
      action: { label: 'Abrir agenda', onClick: () => { window.location.href = '/agenda' } },
    })
  }

  const handleAddTarefa = async () => {
    if (!tarefaTitulo.trim() || !escritorio || !processo) return
    await criarTarefa.mutateAsync({
      escritorio_id: escritorio.id,
      processo_id: processoId,
      responsavel_id: processo.responsavel_id,
      titulo: tarefaTitulo.trim(),
      descricao: null,
      status: 'todo',
      prioridade: 'normal',
      data_vencimento: null,
    })
    setTarefaTitulo(''); setNovaTarefaOpen(false)
  }

  const handleNota = async () => {
    if (!nota.trim() || !escritorio) return
    setSaving(true)
    try {
      await addMov.mutateAsync({
        processo_id: processoId,
        escritorio_id: escritorio.id,
        tipo: 'nota_interna',
        titulo: 'Nota',
        conteudo: nota.trim(),
      })
      setNota('')
      toast.success('Nota salva')
    } finally { setSaving(false) }
  }

  // ── Dados derivados ──
  const urgentes     = prazos.filter(p => p.dias_restantes <= 3)
  const tarefasTodo  = tarefas.filter(t => t.status !== 'done' && t.status !== 'cancelada')
  const tarefasDone  = tarefas.filter(t => t.status === 'done')
  const areaCor      = processo ? AREA_CORES[processo.area] ?? '#6b7280' : '#6b7280'
  const etapa        = (processo as any)?.etapa
  const cliente      = (processo as any)?.cliente

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {processo && (
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: etapa?.cor ?? '#6b7280' }}
            />
          )}
          <span className="text-sm font-semibold text-foreground truncate">
            {isLoading ? 'Carregando...' : (processo?.titulo ?? '—')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {processo && (
            <Link
              href={`/processos/${processo.id}`}
              onClick={onClose}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver tudo
            </Link>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/70 hover:text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Corpo scrollável ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <OmniSpinner size="md" />
        </div>
      ) : processo ? (
        <div className="flex-1 overflow-y-auto">

          {/* ── Bloco CRM ── */}
          <div className="p-5 border-b border-border space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: areaCor }}
              >
                {AREA_LABELS[processo.area] ?? processo.area}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORIDADE_CORES[processo.prioridade])}>
                {processo.prioridade === 1 ? '↑ Alta' : processo.prioridade === 2 ? 'Normal' : '↓ Baixa'}
              </span>
              {etapa && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: etapa.cor }}
                >
                  {etapa.nome}
                </span>
              )}
            </div>

            {/* Grid de informações CRM */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <CrmField icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={cliente?.nome} />
              {processo.numero_processo && (
                <CrmField icon={<Hash className="h-3.5 w-3.5" />} label="Nº Processo" value={processo.numero_processo} mono />
              )}
              {processo.valor_causa != null && (
                <CrmField icon={<Scale className="h-3.5 w-3.5" />} label="Valor da causa" value={formatCurrency(processo.valor_causa)} highlight />
              )}
              {processo.valor_acordo != null && (
                <CrmField icon={<Scale className="h-3.5 w-3.5" />} label="Valor do acordo" value={formatCurrency(processo.valor_acordo)} highlight />
              )}
              {processo.vara_tribunal && (
                <CrmField icon={<Scale className="h-3.5 w-3.5" />} label="Vara / Tribunal" value={processo.vara_tribunal} />
              )}
              {processo.comarca && (
                <CrmField icon={<Scale className="h-3.5 w-3.5" />} label="Comarca" value={processo.comarca} />
              )}
              {processo.data_distribuicao && (
                <CrmField icon={<Calendar className="h-3.5 w-3.5" />} label="Distribuição" value={formatDate(processo.data_distribuicao)} />
              )}
            </div>

            {/* Alerta de urgência */}
            {urgentes.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-red-700">
                    {urgentes.length} prazo{urgentes.length > 1 ? 's' : ''} urgente{urgentes.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-red-500">{urgentes[0].titulo}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Prazos ── */}
          <Section
            icon={<Flag className="h-4 w-4 text-amber-500" />}
            title="Prazos"
            badge={prazos.length || undefined}
            badgeClass="bg-amber-100 text-amber-700"
            action={{ label: '+ Adicionar', onClick: () => setNovoPrazoOpen(v => !v) }}
          >
            {novoPrazoOpen && (
              <div className="bg-secondary/60 border border-border rounded-xl p-3 mb-3 space-y-2">
                <input
                  value={prazoTitulo}
                  onChange={e => setPrazoTitulo(e.target.value)}
                  placeholder="Título do prazo..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddPrazo()}
                  className="w-full text-sm px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={prazoTipo}
                    onChange={e => setPrazoTipo(e.target.value as TipoPrazo)}
                    className="text-xs px-2 py-1.5 border border-border rounded-lg focus:outline-none bg-white"
                  >
                    {Object.entries(TIPO_PRAZO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={prazoData}
                      onChange={e => setPrazoData(e.target.value)}
                      className="text-xs px-2 py-1.5 border border-border rounded-lg focus:outline-none"
                    />
                    <input
                      type="time"
                      value={prazoHora}
                      onChange={e => setPrazoHora(e.target.value)}
                      title="Opcional. Vazio = dia inteiro"
                      className="text-xs px-2 py-1.5 border border-border rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1">Hora opcional. Sem hora, o prazo é o dia inteiro (e no Google, evento de dia).</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPrazo}
                    disabled={!prazoTitulo.trim() || !prazoData || criarPrazo.isPending}
                    className="flex-1 text-xs bg-primary text-white py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    {criarPrazo.isPending ? <OmniSpinner size="xs" variant="dark" /> : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setNovoPrazoOpen(false)
                      setPrazoTitulo('')
                      setPrazoData('')
                      setPrazoHora('')
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-border text-muted-foreground hover:bg-border transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {prazos.map(p => {
                const vencido = p.dias_restantes < 0
                const urgente = p.dias_restantes <= 3 && !vencido
                return (
                  <div key={p.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => concluirPrazo.mutate(p.id)}
                      className="w-4 h-4 rounded border-2 border-border hover:border-green-500 hover:bg-green-50 transition shrink-0"
                      title="Concluir"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate leading-tight">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {TIPO_PRAZO_LABELS[p.tipo] ?? p.tipo} · {formatDate(p.data_prazo)}
                        {formatHoraPrazo(p.hora_prazo) ? ` · ${formatHoraPrazo(p.hora_prazo)}` : ''}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full shrink-0',
                      vencido ? 'bg-red-100 text-red-600'
                        : urgente ? 'bg-amber-100 text-amber-700'
                        : 'bg-secondary text-muted-foreground',
                    )}>
                      {vencido ? 'Vencido' : p.dias_restantes === 0 ? 'Hoje' : `${p.dias_restantes}d`}
                    </span>
                  </div>
                )
              })}
              {prazos.length === 0 && (
                <p className="text-xs text-muted-foreground/70 py-1">Nenhum prazo pendente</p>
              )}
            </div>
          </Section>

          {/* ── Tarefas ── */}
          <Section
            icon={<CheckSquare className="h-4 w-4 text-primary" />}
            title="Tarefas"
            badge={tarefas.length ? `${tarefasDone.length}/${tarefas.length}` : undefined}
            badgeClass="bg-primary/10 text-primary"
            action={{ label: '+ Adicionar', onClick: () => setNovaTarefaOpen(v => !v) }}
          >
            {novaTarefaOpen && (
              <div className="flex gap-2 mb-3">
                <input
                  value={tarefaTitulo}
                  onChange={e => setTarefaTitulo(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddTarefa()
                    if (e.key === 'Escape') setNovaTarefaOpen(false)
                  }}
                  placeholder="Nova tarefa..."
                  autoFocus
                  className="flex-1 text-sm px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddTarefa}
                  className="text-xs px-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  OK
                </button>
              </div>
            )}

            <div className="space-y-2">
              {tarefasTodo.map(t => (
                <label key={t.id} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleTarefa.mutate({ id: t.id, processo_id: processoId, concluida: true })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground group-hover:text-foreground leading-tight">{t.titulo}</span>
                </label>
              ))}
              {tarefasDone.slice(0, 3).map(t => (
                <label key={t.id} className="flex items-start gap-2.5 cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleTarefa.mutate({ id: t.id, processo_id: processoId, concluida: false })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground/70 line-through leading-tight">{t.titulo}</span>
                </label>
              ))}
              {tarefas.length === 0 && (
                <p className="text-xs text-muted-foreground/70 py-1">Nenhuma tarefa cadastrada</p>
              )}
            </div>
          </Section>

          {/* ── Nota rápida ── */}
          <Section
            icon={<FileText className="h-4 w-4 text-muted-foreground/70" />}
            title="Nota rápida"
          >
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Registre uma observação, ligação, reunião..."
              rows={3}
              className="w-full text-sm px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <button
              onClick={handleNota}
              disabled={!nota.trim() || savingNota}
              className="mt-2 w-full text-sm bg-secondary text-foreground py-2 rounded-lg hover:bg-border disabled:opacity-40 transition font-medium"
            >
              {savingNota ? <OmniSpinner size="xs" variant="dark" /> : 'Salvar nota'}
            </button>
          </Section>
        </div>
      ) : null}

      {/* ── Footer ── */}
      {processo && (
        <div className="border-t border-border px-5 py-3 shrink-0">
          <Link
            href={`/processos/${processo.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full text-sm font-medium text-primary hover:bg-primary/5 py-2.5 rounded-xl transition"
          >
            Abrir página completa
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CrmField({
  icon, label, value, highlight = false, mono = false,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
  highlight?: boolean
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground/70 mb-0.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn(
        'text-sm truncate',
        highlight ? 'font-semibold text-primary' : 'font-medium text-foreground',
        mono && 'font-mono text-xs',
      )}>
        {value}
      </p>
    </div>
  )
}

function Section({
  icon, title, badge, badgeClass, action, children,
}: {
  icon: React.ReactNode
  title: string
  badge?: string | number
  badgeClass?: string
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}) {
  return (
    <div className="p-5 border-b border-border last:border-b-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge !== undefined && (
            <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium', badgeClass ?? 'bg-secondary text-muted-foreground')}>
              {badge}
            </span>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 font-medium transition"
          >
            <Plus className="h-3.5 w-3.5" />
            {action.label.replace('+ ', '')}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
