'use client'
import { use, useState, useEffect } from 'react'
import { useProcesso, useEtapasKanban, useUpdateProcesso } from '@/hooks/useProcessos'
import { useMovimentacoes, useAddMovimentacao } from '@/hooks/useMovimentacoes'
import { useTarefas, useCreateTarefa, useToggleTarefa, useDeleteTarefa } from '@/hooks/useTarefas'
import { usePrazos, useCreatePrazo, useConcluirPrazo } from '@/hooks/usePrazos'
import { useLancamentos } from '@/hooks/useLancamentos'
import { useEscritorio } from '@/hooks/useEscritorio'
import {
  TIPO_MOV_LABELS, TIPO_MOV_CORES,
  STATUS_PRAZO_CORES, STATUS_LANCAMENTO_LABELS, STATUS_LANCAMENTO_CORES,
} from '@/lib/constants'
import { corAreaHex, opcaoRotulo, prioridadeBadgeClass } from '@/lib/opcoes-helpers'
import { useOpcoesCadastro, useOpcaoIdPorSlug } from '@/hooks/useOpcoesCadastro'
import { formatCurrency, formatDate, formatDateRelative, formatHoraPrazo, getDiasRestantes, horaPrazoParaBanco } from '@/lib/formatters'
import { toast } from 'sonner'
import { ArrowLeft, CheckSquare, Square, Trash2, Plus, Send, AlertTriangle, Pencil } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DataJudPanel } from '@/components/processos/DataJudPanel'
import { FormEditarProcesso } from '@/components/processos/FormEditarProcesso'
import { ProcessoDocumentos } from '@/components/processos/ProcessoDocumentos'
import { Button, Select, Input } from '@/components/ui'
import type { Processo, PrazoComProcesso } from '@/types/database'

export default function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: processo, isLoading } = useProcesso(id)
  const { data: etapas = [] }         = useEtapasKanban()
  const { data: movs = [] }           = useMovimentacoes(id)
  const { data: tarefas = [] }        = useTarefas(id)
  const { data: prazos = [] }         = usePrazos({ processo_id: id })
  const { data: lancamentos = [] }    = useLancamentos({ processo_id: id })
  const { data: escritorio }          = useEscritorio()

  const updateProcesso = useUpdateProcesso()
  const addMov         = useAddMovimentacao()
  const createTarefa   = useCreateTarefa()
  const toggleTarefa   = useToggleTarefa()
  const deleteTarefa   = useDeleteTarefa()
  const createPrazo    = useCreatePrazo()
  const concluirPrazo  = useConcluirPrazo()

  const [nota, setNota]               = useState('')
  const [novaTarefa, setNovaTarefa]   = useState('')
  const [aba, setAba]                 = useState<'tarefas' | 'prazos' | 'documentos' | 'financeiro'>('tarefas')
  const [showNovoPrazo, setShowNovoPrazo] = useState(false)
  const [novoPrazo, setNovoPrazo]     = useState({ titulo: '', tipo_prazo_id: '', data_prazo: '', hora_prazo: '' })
  const [editarProcesso, setEditarProcesso] = useState(false)
  const { data: opTipos = [] }      = useOpcoesCadastro('tipo_prazo')
  const defTipoInterno              = useOpcaoIdPorSlug('tipo_prazo', 'prazo_interno', opTipos)

  useEffect(() => {
    if (!defTipoInterno) return
    setNovoPrazo(p => (p.tipo_prazo_id ? p : { ...p, tipo_prazo_id: defTipoInterno }))
  }, [defTipoInterno])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <OmniSpinner size="lg" />
    </div>
  )
  if (!processo) return (
    <div className="text-center py-20 text-muted-foreground text-sm">Processo não encontrado</div>
  )

  type ProcessoVista = Processo & {
    area?: { rotulo?: string; cor?: string | null } | null
    prioridade?: { rotulo?: string; cor?: string | null; slug?: string } | null
  }
  const proc = processo as unknown as ProcessoVista
  const areaCor = corAreaHex(proc.area)
  const receitas  = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0)
  const pendente  = lancamentos.filter(l => l.tipo === 'receita' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0)

  const enviarNota = async () => {
    if (!nota.trim() || !escritorio) return
    await addMov.mutateAsync({ processo_id: id, escritorio_id: escritorio.id, tipo: 'nota_interna', conteudo: nota })
    setNota('')
  }

  const adicionarTarefa = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !novaTarefa.trim() || !escritorio) return
    await createTarefa.mutateAsync({
      processo_id: id, escritorio_id: escritorio.id, responsavel_id: processo.responsavel_id,
      titulo: novaTarefa, status: 'todo', prioridade: 'normal', descricao: null, data_vencimento: null,
    })
    setNovaTarefa('')
  }

  const salvarPrazo = async () => {
    if (!novoPrazo.titulo || !novoPrazo.data_prazo || !escritorio || !novoPrazo.tipo_prazo_id) return
    await createPrazo.mutateAsync({
      processo_id: id, escritorio_id: escritorio.id, responsavel_id: processo.responsavel_id,
      titulo: novoPrazo.titulo, tipo_prazo_id: novoPrazo.tipo_prazo_id, data_prazo: novoPrazo.data_prazo,
      status: 'pendente', alerta_dias: 3, descricao: null,
      hora_prazo: horaPrazoParaBanco(novoPrazo.hora_prazo),
    })
    setShowNovoPrazo(false)
    setNovoPrazo({ titulo: '', tipo_prazo_id: defTipoInterno ?? '', data_prazo: '', hora_prazo: '' })
    toast.success('Prazo adicionado', {
      action: { label: 'Agenda', onClick: () => { window.location.href = '/agenda' } },
    })
  }

  return (
    <div className="max-w-6xl mx-auto page-enter">
      <FormEditarProcesso
        processo={processo as Processo & { cliente?: { id: string; nome: string } | null }}
        open={editarProcesso}
        onClose={() => setEditarProcesso(false)}
      />

      {/* ── Header ── */}
      <div className="flex items-start gap-4 mb-6">
        <Link href="/kanban" className="btn-ghost btn p-2 mt-0.5 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="badge text-white" style={{ backgroundColor: areaCor }}>
              {opcaoRotulo(proc.area)}
            </span>
            <span className={cn('badge', prioridadeBadgeClass(proc.prioridade))}>
              {opcaoRotulo(proc.prioridade)} prioridade
            </span>
            <Select
              value={processo.etapa_id}
              onChange={e => updateProcesso.mutate({ id, etapa_id: e.target.value })}
              className="w-auto text-xs py-1 px-3 rounded-full"
            >
              {etapas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground flex-1 min-w-0 break-words">{processo.titulo}</h1>
            <Button variant="ghost" size="sm" onClick={() => setEditarProcesso(true)} className="shrink-0 border border-border">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: <Link href={`/clientes/${processo.cliente_id}`} className="text-primary hover:underline">{(processo as any).cliente?.nome}</Link>
            {processo.numero_processo && <> · <span className="font-mono">{processo.numero_processo}</span></>}
          </p>
        </div>
      </div>

      {/* ── Layout 2 colunas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coluna esquerda: Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <DataJudPanel processo={processo as unknown as Processo} />

          {/* Nova nota */}
          <div className="omni-card omni-card-body">
            <h3 className="text-sm font-semibold text-foreground mb-3">Adicionar nota</h3>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
              placeholder="Anotação interna, update do caso, comunicação com o cliente..."
              className="form-textarea w-full"
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={enviarNota} disabled={!nota.trim() || addMov.isPending} loading={addMov.isPending}>
                <Send className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="omni-card">
            <div className="omni-card-header">
              <h3 className="text-sm font-semibold text-foreground">Histórico</h3>
            </div>
            {movs.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhum evento ainda.</p>
            )}
            <div className="divide-y divide-border">
              {movs.map(m => (
                <div key={m.id} className="p-4 flex gap-3">
                  <span className={cn('badge mt-0.5 h-fit shrink-0', TIPO_MOV_CORES[m.tipo] ?? 'badge-muted')}>
                    {TIPO_MOV_LABELS[m.tipo] ?? m.tipo}
                  </span>
                  <div className="flex-1 min-w-0">
                    {m.titulo   && <p className="text-sm font-medium text-foreground">{m.titulo}</p>}
                    {m.conteudo && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{m.conteudo}</p>}
                    {m.tipo === 'mudanca_etapa' && (m.metadata as any)?.de && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(m.metadata as any).de} → {(m.metadata as any).para}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDateRelative(m.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita: Tabs */}
        <div className="lg:col-span-2">
          <div className="omni-card">
            {/* Tab header */}
            <div className="tab-bar overflow-x-auto">
              {(['tarefas', 'prazos', 'documentos', 'financeiro'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAba(t)}
                  className={cn('tab-item flex-1 text-center whitespace-nowrap capitalize', aba === t && 'active')}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ── TAREFAS ── */}
              {aba === 'tarefas' && (
                <div className="space-y-2">
                  <input
                    value={novaTarefa}
                    onChange={e => setNovaTarefa(e.target.value)}
                    onKeyDown={adicionarTarefa}
                    placeholder="Nova tarefa — Enter para adicionar"
                    className="w-full text-sm border border-dashed border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary bg-secondary/40"
                  />
                  {tarefas.map(t => (
                    <div key={t.id} className="flex items-center gap-2 group py-0.5">
                      <button onClick={() => toggleTarefa.mutate({ id: t.id, processo_id: id, concluida: t.status !== 'done' })}>
                        {t.status === 'done'
                          ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                      <span className={cn('text-sm flex-1', t.status === 'done' && 'line-through text-muted-foreground')}>
                        {t.titulo}
                      </span>
                      <button
                        onClick={() => deleteTarefa.mutate({ id: t.id, processo_id: id })}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {tarefas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                  )}
                </div>
              )}

              {/* ── PRAZOS ── */}
              {aba === 'prazos' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowNovoPrazo(!showNovoPrazo)}
                    className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mb-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo prazo
                  </button>

                  {showNovoPrazo && (
                    <div className="border border-dashed border-border rounded-xl p-3 space-y-2 mb-3 bg-secondary/40">
                      <Input
                        value={novoPrazo.titulo}
                        onChange={e => setNovoPrazo(p => ({ ...p, titulo: e.target.value }))}
                        placeholder="Título do prazo"
                      />
                      <Select
                        value={novoPrazo.tipo_prazo_id}
                        onChange={e => setNovoPrazo(p => ({ ...p, tipo_prazo_id: e.target.value }))}
                      >
                        {opTipos.filter(o => o.ativo).map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={novoPrazo.data_prazo}
                          onChange={e => setNovoPrazo(p => ({ ...p, data_prazo: e.target.value }))}
                        />
                        <Input
                          type="time"
                          value={novoPrazo.hora_prazo}
                          onChange={e => setNovoPrazo(p => ({ ...p, hora_prazo: e.target.value }))}
                          title="Opcional — vazio = dia inteiro"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setShowNovoPrazo(false)}>Cancelar</Button>
                        <Button type="button" size="sm" className="flex-1" onClick={salvarPrazo}>Salvar</Button>
                      </div>
                    </div>
                  )}

                  {prazos.map(p => {
                    const dias = getDiasRestantes(p.data_prazo)
                    return (
                      <div key={p.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-secondary/60 group transition-colors">
                        {dias <= 3 && p.status === 'pendente' && (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {opcaoRotulo((p as PrazoComProcesso).tipo_prazo)} · {formatDate(p.data_prazo)}
                            {formatHoraPrazo(p.hora_prazo) ? ` · ${formatHoraPrazo(p.hora_prazo)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={cn('badge', STATUS_PRAZO_CORES[p.status])}>
                            {dias >= 0 && p.status === 'pendente' ? `${dias}d` : p.status}
                          </span>
                          {p.status === 'pendente' && (
                            <button
                              onClick={() => concluirPrazo.mutate(p.id)}
                              className="text-xs text-emerald-600 hover:underline opacity-0 group-hover:opacity-100 ml-1"
                            >✓</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {prazos.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum prazo</p>}
                </div>
              )}

              {/* ── DOCUMENTOS ── */}
              {aba === 'documentos' && escritorio && (
                <ProcessoDocumentos processoId={id} escritorioId={escritorio.id} responsavelId={processo.responsavel_id} />
              )}

              {/* ── FINANCEIRO ── */}
              {aba === 'financeiro' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Recebido</p>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">{formatCurrency(receitas)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Pendente</p>
                      <p className="text-base font-bold text-amber-700 mt-0.5">{formatCurrency(pendente)}</p>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {lancamentos.map(l => (
                      <div key={l.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/60 transition-colors">
                        <div>
                          <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{l.descricao}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(l.data_vencimento)}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-xs font-semibold', l.tipo === 'receita' ? 'text-emerald-600' : 'text-destructive')}>
                            {l.tipo === 'receita' ? '+' : '-'}{formatCurrency(l.valor)}
                          </p>
                          <span className={cn('badge', STATUS_LANCAMENTO_CORES[l.status])}>
                            {STATUS_LANCAMENTO_LABELS[l.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                    {lancamentos.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem lançamentos</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
