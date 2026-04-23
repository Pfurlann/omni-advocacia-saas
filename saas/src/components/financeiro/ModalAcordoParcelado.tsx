'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateCliente } from '@/hooks/useClientes'
import { useCreateLancamentosLote } from '@/hooks/useLancamentos'
import { useProcessos } from '@/hooks/useProcessos'
import type { Cliente } from '@/types/database'
import { gerarLancamentosAcordoParcelado } from '@/lib/financeiro/acordo-parcelado'
import { Button, Input, Label, FormError, Modal, Select } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Link2, UserPlus } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'

const naoENum = (v: unknown) =>
  v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))

const schema = z
  .object({
    cliente_id: z.string().min(1, 'Selecione ou cadastre o cliente'),
    processo_id: z.string().optional().default(''),
    numero_processo_texto: z.string().min(1, 'Informe o número do processo ou vincule um do escritório'),
    tem_entrada: z.preprocess(
      (v) => v === true || v === 'on' || (Array.isArray(v) && (v as string[]).includes('on')),
      z.boolean().default(true),
    ),
    valor_entrada: z.preprocess(
      (v) => (naoENum(v) ? 0 : Number(v)),
      z.number().min(0),
    ),
    data_entrada: z.string().optional(),
    qtd_parcelas: z.preprocess(
      (v) => (naoENum(v) ? 1 : Number(v)),
      z.number().int('Use um número inteiro').min(1, 'Mín. 1 parcela'),
    ),
    valor_parcela: z.preprocess(
      (v) => (naoENum(v) ? undefined : Number(v)),
      z.number({ invalid_type_error: 'Informe o valor' }).refine(
        n => Number.isFinite(n) && n > 0,
        'Valor deve ser positivo',
      ),
    ),
    data_primeira_parcela: z.string().min(1, 'Obrigatório'),
    intervalo_dias: z.preprocess(
      (v) => (naoENum(v) ? 30 : Number(v)),
      z.number().int('Use um número inteiro').min(0, 'Mín. 0'),
    ),
    status: z.enum(['pendente', 'pago']),
  })
  .superRefine((d, ctx) => {
    if (d.tem_entrada) {
      if (d.valor_entrada <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Informe a entrada ou desmarque a opção', path: ['valor_entrada'] })
      }
      if (!d.data_entrada?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Data da entrada obrigatória', path: ['data_entrada'] })
      }
    }
  })

type Form = z.infer<typeof schema>

type Props = {
  onClose: () => void
  escritorioId: string
  clientes: Cliente[]
  isGestor: boolean
  hoje: string
}

function useDebounce<T>(v: T, ms: number): T {
  const [o, s] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => s(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return o
}

export function ModalAcordoParcelado({ onClose, escritorioId, clientes, isGestor, hoje }: Props) {
  const [buscaProc, setBuscaProc] = useState('')
  const [procVinc, setProcVinc] = useState<null | { id: string; titulo: string; numero: string | null }>(null)
  const debBusca = useDebounce(buscaProc, 350)
  const { data: processosBusca = [] } = useProcessos({
    buscaLivre: debBusca,
    arquivado: false,
    prazo_vencimento: 'todos',
    tipo_prazo: 'todos',
  })
  const createLote = useCreateLancamentosLote()
  const createCli = useCreateCliente()

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      cliente_id: '',
      processo_id: '',
      numero_processo_texto: '',
      tem_entrada: true,
      valor_entrada: 0,
      data_entrada: hoje,
      qtd_parcelas: 1,
      valor_parcela: 0.01,
      data_primeira_parcela: hoje,
      intervalo_dias: 30,
      status: 'pendente',
    },
  })
  const temEntrada = watch('tem_entrada')
  const processoIdField = watch('processo_id')
  const resumoF = useWatch({ control })

  const escolherProcesso = (id: string) => {
    setValue('processo_id', id, { shouldValidate: true })
    const p = processosBusca.find(x => x.id === id)
    if (p) {
      setProcVinc({ id: p.id, titulo: p.titulo, numero: p.numero_processo ?? null })
      setValue('cliente_id', p.cliente_id, { shouldValidate: true })
      setValue('numero_processo_texto', p.numero_processo?.trim() || p.titulo.slice(0, 80), { shouldValidate: true })
    }
  }

  const onSubmit = async (data: Form) => {
    const processoId = data.processo_id?.trim() || null
    if (!isGestor && !processoId) {
      toast.error('Vincule um processo do escritório ou peça a um gestor para lançar sem processo cadastrado.')
      return
    }
    if (!data.cliente_id) {
      toast.error('Cliente é obrigatório')
      return
    }
    const acordoId = crypto.randomUUID()
    const numRef = data.numero_processo_texto.trim() || null
    const rows = gerarLancamentosAcordoParcelado({
      acordoGrupoId: acordoId,
      escritorioId,
      clienteId: data.cliente_id,
      processoId,
      numeroExibicao: numRef,
      temEntrada: data.tem_entrada,
      valorEntrada: data.valor_entrada,
      dataEntrada: data.data_entrada ?? hoje,
      qtdParcelas: data.qtd_parcelas,
      valorParcela: data.valor_parcela,
      dataPrimeiraParcela: data.data_primeira_parcela,
      intervaloDias: data.intervalo_dias,
      status: data.status,
    })
    if (data.status === 'pago') {
      const pago = hoje
      for (const r of rows) {
        r.data_pagamento = pago
      }
    }
    try {
      await createLote.mutateAsync(rows)
      toast.success(`${rows.length} lançamento(s) criado(s) no acordo.`)
      onClose()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível salvar o acordo. Verifique as permissões (gestor) ou tente de novo.')
    }
  }

  const cadastrarClienteRapido = async (nome: string) => {
    const n = nome.trim()
    if (n.length < 2) {
      toast.error('Nome muito curto')
      return
    }
    const row: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
      escritorio_id: escritorioId,
      nome: n,
      tipo: 'PF',
      papel_erp: 'cliente',
      cpf_cnpj: null,
      email: null,
      telefone: null,
      endereco: null,
      status: 'ativo',
      observacoes: null,
    }
    const c = await createCli.mutateAsync(row)
    setValue('cliente_id', c.id, { shouldValidate: true })
    toast.success('Cliente cadastrado')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Acordo parcelado"
      className="!max-w-2xl w-[min(100%,42rem)]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Gera uma entrada (opcional) e parcelas de honorário. O número do processo pode ser só referência, sem estar no Kanban, desde que você seja
          gestor ao lançar sem vínculo; caso contrário, vincule um processo.
        </p>
        <input type="hidden" {...register('processo_id')} />

        <div>
          <Label>Cliente *</Label>
          <div className="flex gap-2">
            <Select className="flex-1" {...register('cliente_id')}>
              <option value="">Selecione…</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
            <NovoClienteInline onCadastrar={cadastrarClienteRapido} loading={createCli.isPending} />
          </div>
          <FormError>{errors.cliente_id?.message}</FormError>
        </div>

        <div className="rounded-xl border border-border p-3 space-y-2 bg-secondary/20">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Link2 className="h-4 w-4" />
            Processo
          </div>
          <p className="text-xs text-muted-foreground">Busque pelo título ou número. Ao escolher, o cliente e o nº do processo são preenchidos.</p>
          <Input
            placeholder="Buscar processo no escritório…"
            value={buscaProc}
            onChange={e => setBuscaProc(e.target.value)}
          />
          {buscaProc.trim().length >= 2 && (
            <ul className="max-h-32 overflow-y-auto text-sm border border-border rounded-lg divide-y">
              {processosBusca.length === 0 && (
                <li className="p-2 text-muted-foreground">Nenhum resultado</li>
              )}
              {processosBusca.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => escolherProcesso(p.id)}
                    className={cn(
                      'w-full text-left p-2 hover:bg-secondary transition',
                      processoIdField === p.id && 'bg-primary/10',
                    )}
                  >
                    <span className="font-medium line-clamp-1">{p.titulo}</span>
                    {p.numero_processo && (
                      <span className="block text-xs text-muted-foreground">{p.numero_processo}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Label>Número do processo (referência) *</Label>
          <Input {...register('numero_processo_texto')} placeholder="Ex.: 0000000-00.0000.0.00.0000" />
          <FormError>{errors.numero_processo_texto?.message}</FormError>
        </div>
        {processoIdField && procVinc && procVinc.id === processoIdField && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg px-2 py-1.5 flex items-start justify-between gap-2">
            <p>
              Vinculado ao processo &quot;{procVinc.titulo}&quot; no Kanban. Lançamento atende às regras de acesso.
            </p>
            <button
              type="button"
              className="shrink-0 text-[11px] underline hover:no-underline"
              onClick={() => {
                setProcVinc(null)
                setValue('processo_id', '', { shouldValidate: true })
              }}
            >
              Limpar
            </button>
          </div>
        )}
        {!isGestor && !processoIdField && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2 py-1.5">
            Sem vínculo: apenas gestor pode concluir. Vincule um processo acima.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="te" className="rounded" {...register('tem_entrada')} />
            <label htmlFor="te" className="text-sm">Incluir entrada</label>
          </div>
          {temEntrada && (
            <>
              <div>
                <Label>Valor da entrada (R$)</Label>
                <Input type="number" step="0.01" {...register('valor_entrada', { valueAsNumber: true })} />
                <FormError>{errors.valor_entrada?.message}</FormError>
              </div>
              <div>
                <Label>Vencimento da entrada</Label>
                <Input type="date" {...register('data_entrada')} />
                <FormError>{errors.data_entrada?.message}</FormError>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade de parcelas *</Label>
            <Input type="number" min={1} {...register('qtd_parcelas', { valueAsNumber: true })} />
            <FormError>{errors.qtd_parcelas?.message}</FormError>
          </div>
          <div>
            <Label>Valor de cada parcela (R$) *</Label>
            <Input type="number" step="0.01" {...register('valor_parcela', { valueAsNumber: true })} />
            <FormError>{errors.valor_parcela?.message}</FormError>
          </div>
          <div>
            <Label>Vencimento 1ª parcela *</Label>
            <Input type="date" {...register('data_primeira_parcela')} />
            <FormError>{errors.data_primeira_parcela?.message}</FormError>
          </div>
          <div>
            <Label>Intervalo entre parcelas (dias) *</Label>
            <Input type="number" min={0} {...register('intervalo_dias', { valueAsNumber: true })} />
            <p className="text-[11px] text-muted-foreground mt-0.5">2ª parcela = 1ª + intervalo; 3ª = 1ª + 2×intervalo, etc.</p>
            <FormError>{errors.intervalo_dias?.message}</FormError>
          </div>
        </div>

        <div>
          <Label>Status ao criar</Label>
          <Select {...register('status')}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago (todas as parcelas)</option>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 border border-dashed border-border rounded-lg p-3">
          <p className="font-medium text-foreground">Prévia</p>
          {temEntrada && (resumoF?.valor_entrada ?? 0) > 0 && resumoF?.data_entrada && (
            <p>Entrada: {formatCurrency(resumoF?.valor_entrada ?? 0)} em {formatDate(resumoF.data_entrada)}</p>
          )}
          {resumoF?.data_primeira_parcela && (
            <p>
              Parcelas: {resumoF?.qtd_parcelas ?? 0} × {formatCurrency(resumoF?.valor_parcela ?? 0)} — 1º venc. {formatDate(resumoF.data_primeira_parcela)}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={createLote.isPending}>
            Gerar lançamentos
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function NovoClienteInline({ onCadastrar, loading }: { onCadastrar: (n: string) => void; loading: boolean }) {
  const [on, setOn] = useState(false)
  const [n, setN] = useState('')
  if (!on) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOn(true)} className="shrink-0">
        <UserPlus className="h-4 w-4" />
      </Button>
    )
  }
  return (
    <div className="flex gap-1 shrink-0">
      <Input
        className="w-40"
        placeholder="Nome"
        value={n}
        onChange={e => setN(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        onClick={() => { onCadastrar(n); setOn(false); setN('') }}
        disabled={loading}
      >
        {loading ? <OmniSpinner size="xs" variant="dark" /> : 'OK'}
      </Button>
    </div>
  )
}
