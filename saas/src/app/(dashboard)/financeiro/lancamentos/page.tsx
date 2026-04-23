'use client'
import { useState, useEffect } from 'react'
import { useLancamentos, useCreateLancamento, useMarcarPago, useDeleteLancamento } from '@/hooks/useLancamentos'
import { useProcessosSelectLancamento } from '@/hooks/useProcessos'
import { usePlanoContasAnaliticos } from '@/hooks/usePlanoContas'
import { useClientes } from '@/hooks/useClientes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { useMeuPapelEscritorio } from '@/hooks/useEscritorioMembros'
import { hojeIsoEmBrasil } from '@/lib/datetime/brazil'
import { ModalAcordoParcelado } from '@/components/financeiro/ModalAcordoParcelado'
import { STATUS_LANCAMENTO_LABELS, STATUS_LANCAMENTO_CORES, CATEGORIA_RECEITA_LABELS, CATEGORIA_DESPESA_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Plus, CheckCircle, Trash2, DollarSign, Layers } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { TipoLancamento, StatusLancamento, CategoriaLancamento } from '@/types/database'
import { Button, Select, Input, Label, FormError, Modal, EmptyState } from '@/components/ui'

const schema = z.object({
  tipo:              z.enum(['receita', 'despesa']),
  categoria:         z.string(),
  descricao:         z.string().min(1, 'Descrição obrigatória'),
  valor:             z.number({ invalid_type_error: 'Valor inválido' }).positive('Valor deve ser positivo'),
  data_vencimento:   z.string().min(1, 'Data obrigatória'),
  data_competencia:  z.string().optional(),
  plano_conta_id:    z.string().optional(),
  cliente_id:        z.string().optional(),
  processo_id:       z.string().optional(),
  status:            z.enum(['pago', 'pendente', 'inadimplente', 'cancelado']).default('pendente'),
  forma_pagamento:   z.string().optional(),
  observacoes:       z.string().optional(),
})
type Form = z.infer<typeof schema>

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function LancamentosPage() {
  const agora = new Date()
  const [mes, setMes]         = useState(agora.getMonth() + 1)
  const [ano, setAno]         = useState(agora.getFullYear())
  const [tipo, setTipo]       = useState<TipoLancamento | undefined>()
  const [status, setStatus]   = useState<StatusLancamento | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [showAcordo, setShowAcordo] = useState(false)
  const { data: lancamentos = [], isLoading } = useLancamentos({ tipo, status, mes, ano })
  const { data: clientesData }  = useClientes({ pageSize: 500 })
  const { data: escritorio }    = useEscritorio()
  const { data: me } = useMeuPapelEscritorio()
  const create     = useCreateLancamento()
  const planosR = usePlanoContasAnaliticos('receita')
  const planosD = usePlanoContasAnaliticos('despesa')
  const marcarPago = useMarcarPago()
  const deletar    = useDeleteLancamento()

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'receita',
      status: 'pendente',
      categoria: 'honorario_fixo',
      plano_conta_id: '',
      data_competencia: '',
      processo_id: '',
      cliente_id: '',
    },
  })
  const tipoWatch     = watch('tipo')
  const clienteFiltro = watch('cliente_id')?.trim() || null
  const processoWatch = watch('processo_id')
  const { data: processosSel = [] } = useProcessosSelectLancamento(clienteFiltro)
  const categorias = tipoWatch === 'receita' ? CATEGORIA_RECEITA_LABELS : CATEGORIA_DESPESA_LABELS

  useEffect(() => {
    if (!processoWatch) return
    const p = processosSel.find(x => x.id === processoWatch)
    if (!p) {
      setValue('processo_id', '')
      return
    }
    if (p.cliente_id) setValue('cliente_id', p.cliente_id)
  }, [processoWatch, processosSel, setValue, clienteFiltro])

  const receitas = lancamentos.filter(l => l.tipo === 'receita' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0)
  const despesas = lancamentos.filter(l => l.tipo === 'despesa' && l.status !== 'cancelado').reduce((s, l) => s + l.valor, 0)
  const inad     = lancamentos.filter(l => l.status === 'inadimplente').reduce((s, l) => s + l.valor, 0)

  const onSubmit = async (data: Form) => {
    if (!escritorio) return
    try {
      const comp = data.data_competencia?.trim() || data.data_vencimento
      const pid = data.plano_conta_id?.trim() || null
      const procId = data.processo_id?.trim() || null
      await create.mutateAsync({
        ...data,
        escritorio_id:    escritorio.id,
        tipo:             data.tipo,
        categoria:        data.categoria as CategoriaLancamento,
        cliente_id:       data.cliente_id || null,
        processo_id:      procId,
        honorario_id:     null,
        data_competencia: comp,
        plano_conta_id:   pid,
        data_pagamento:   data.status === 'pago' ? new Date().toISOString().split('T')[0] : null,
        comprovante_url:  null,
        forma_pagamento:  data.forma_pagamento || null,
        observacoes:      data.observacoes || null,
        acordo_grupo_id:          null,
        numero_processo_referencia: null,
        parcela_numero:           null,
      })
      toast.success('Lançamento criado!')
      setShowForm(false); reset()
    } catch { toast.error('Erro ao criar lançamento') }
  }

  return (
    <div className="page-enter space-y-5">
      <h1 className="sr-only">Lançamentos</h1>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">{lancamentos.length} no período</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowAcordo(true)}>
            <Layers className="h-4 w-4" /> Acordo parcelado
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Receitas',      valor: receitas, textCor: 'text-emerald-600', bg: 'bg-emerald-50'          },
          { label: 'Despesas',      valor: despesas, textCor: 'text-destructive',  bg: 'bg-destructive/5'       },
          { label: 'Inadimplência', valor: inad,     textCor: 'text-amber-600',   bg: 'bg-amber-50'            },
        ].map(k => (
          <div key={k.label} className={cn('rounded-2xl p-4 border border-border', k.bg)}>
            <p className={cn('text-xs font-semibold uppercase tracking-wide', k.textCor)}>{k.label}</p>
            <p className={cn('text-xl font-bold mt-1', k.textCor)}>{formatCurrency(k.valor)}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Navegador de meses */}
        <div className="flex items-center gap-0.5 bg-card border border-border rounded-xl p-1">
          {MESES.map((m, i) => (
            <button
              key={i}
              onClick={() => setMes(i + 1)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                mes === i + 1
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <Select value={ano} onChange={e => setAno(Number(e.target.value))} className="w-auto">
          {[agora.getFullYear(), agora.getFullYear() - 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select value={tipo ?? ''} onChange={e => setTipo((e.target.value || undefined) as TipoLancamento)} className="w-auto">
          <option value="">Receitas e Despesas</option>
          <option value="receita">Só receitas</option>
          <option value="despesa">Só despesas</option>
        </Select>
        <Select value={status ?? ''} onChange={e => setStatus((e.target.value || undefined) as StatusLancamento)} className="w-auto">
          <option value="">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
          <option value="inadimplente">Inadimplente</option>
        </Select>
      </div>

      {/* ── Tabela ── */}
      <div className="omni-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <OmniSpinner size="md" />
          </div>
        ) : lancamentos.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Nenhum lançamento neste período"
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Novo Lançamento
              </Button>
            }
          />
        ) : (
          <table className="omni-table">
            <thead>
              <tr>
                {['Data', 'Descrição', 'Conta', 'Pessoa', 'Processo', 'Tipo', 'Valor', 'Status', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentos.map(l => (
                <tr key={l.id} className="group">
                  <td className="text-muted-foreground text-xs">{formatDate(l.data_vencimento)}</td>
                  <td>
                    <p className="font-medium text-foreground flex flex-wrap items-center gap-1.5">
                      {l.descricao}
                      {l.categoria === 'acordo_parcelado' && l.acordo_grupo_id && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded">Acordo</span>
                      )}
                    </p>
                    {l.categoria === 'acordo_parcelado' && l.numero_processo_referencia && !(l as { processo?: unknown }).processo && (
                      <p className="text-xs text-muted-foreground">Ref. proc.: {l.numero_processo_referencia}</p>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground max-w-[140px]">
                    {(() => {
                      const pl = l as { plano_conta?: { codigo: string; nome: string } | null }
                      if (!pl.plano_conta) return '—'
                      return (
                        <span className="line-clamp-2" title={`${pl.plano_conta.codigo} ${pl.plano_conta.nome}`}>
                          {pl.plano_conta.codigo} · {pl.plano_conta.nome}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="text-muted-foreground">{(l as any).cliente?.nome ?? '—'}</td>
                  <td className="text-xs text-muted-foreground max-w-[130px]">
                    {(() => {
                      const p = l as { processo?: { titulo: string; numero_processo: string | null } }
                      if (!p.processo) return '—'
                      return (
                        <span className="line-clamp-2">
                          {p.processo.titulo}
                          {p.processo.numero_processo ? ` · ${p.processo.numero_processo}` : ''}
                        </span>
                      )
                    })()}
                  </td>
                  <td>
                    <span className={cn('badge', l.tipo === 'receita' ? 'badge-success' : 'badge-danger')}>
                      {l.tipo}
                    </span>
                  </td>
                  <td className="font-semibold text-foreground">{formatCurrency(l.valor)}</td>
                  <td>
                    <span className={cn('badge', STATUS_LANCAMENTO_CORES[l.status])}>
                      {STATUS_LANCAMENTO_LABELS[l.status]}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition justify-end">
                      {l.status === 'pendente' && (
                        <button
                          onClick={() => { marcarPago.mutate(l.id); toast.success('Marcado como pago!') }}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { deletar.mutate(l.id); toast.success('Excluído') }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {escritorio && showAcordo && (
        <ModalAcordoParcelado
          onClose={() => setShowAcordo(false)}
          escritorioId={escritorio.id}
          clientes={clientesData?.clientes ?? []}
          isGestor={me?.isGestor ?? false}
          hoje={hojeIsoEmBrasil()}
        />
      )}

      {/* ── Modal novo lançamento ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo Lançamento">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select {...register('tipo')}>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select {...register('categoria')}>
                {Object.entries(categorias).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input {...register('descricao')} />
            <FormError>{errors.descricao?.message}</FormError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input {...register('valor', { valueAsNumber: true })} type="number" step="0.01" />
              <FormError>{errors.valor?.message}</FormError>
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input {...register('data_vencimento')} type="date" />
              <FormError>{errors.data_vencimento?.message}</FormError>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Competência (DRE)</Label>
              <Input {...register('data_competencia')} type="date" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Padrão: igual ao vencimento</p>
            </div>
            <div>
              <Label>Conta (plano)</Label>
              <Select {...register('plano_conta_id')}>
                <option value="">— Nenhum —</option>
                {(tipoWatch === 'receita' ? planosR : planosD).map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Pessoa (cliente / fornecedor) — opcional</Label>
            <Select {...register('cliente_id')}>
              <option value="">Escritório / despesa geral (sem pessoa vinculada)</option>
              {clientesData?.clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vazio = custo ou receita só do escritório. Cadastre fornecedores em Cadastros.</p>
          </div>
          <div>
            <Label>Processo — opcional</Label>
            <Select {...register('processo_id')}>
              <option value="">Nenhum</option>
              {processosSel.map(p => (
                <option key={p.id} value={p.id}>
                  {p.titulo}{p.numero_processo ? ` · ${p.numero_processo}` : ''}
                </option>
              ))}
            </Select>
            <p className="text-[10px] text-muted-foreground mt-0.5">Filtra por pessoa, se selecionada. Ao escolher o processo, a pessoa é preenchida automaticamente.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select {...register('status')}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="inadimplente">Inadimplente</option>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input {...register('forma_pagamento')} placeholder="PIX, boleto..." />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={create.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
