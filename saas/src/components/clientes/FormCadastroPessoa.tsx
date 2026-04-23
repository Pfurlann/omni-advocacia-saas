'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { Button, Input, Textarea, Select, Label, FormError } from '@/components/ui'
import { useCreateCliente, useUpdateCliente } from '@/hooks/useClientes'
import type { Cliente, PapelErp } from '@/types/database'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import { toast } from 'sonner'

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  tipo: z.enum(['PF', 'PJ']),
  papel_erp: z.enum(['cliente', 'fornecedor', 'ambos']),
  cpf_cnpj: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  status: z.enum(['ativo', 'inativo', 'prospecto']).default('ativo'),
  observacoes: z.string().optional(),
})
export type FormCadastroPessoaValues = z.infer<typeof schema>

type Props = {
  escritorioId: string
  onSuccess: (c: Cliente) => void
  onCancel: () => void
  /** `null` = novo cadastro */
  clienteInicial?: Cliente | null
  /** Título acessório / rodapé */
  showFooter?: boolean
}

const defaults: FormCadastroPessoaValues = {
  nome: '',
  tipo: 'PF',
  papel_erp: 'cliente',
  cpf_cnpj: '',
  email: '',
  telefone: '',
  status: 'ativo',
  observacoes: '',
}

export function FormCadastroPessoa({ escritorioId, onSuccess, onCancel, clienteInicial, showFooter = true }: Props) {
  const create = useCreateCliente()
  const update = useUpdateCliente()
  const isEdit = Boolean(clienteInicial)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormCadastroPessoaValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  useEffect(() => {
    if (clienteInicial) {
      reset({
        nome: clienteInicial.nome,
        tipo: clienteInicial.tipo,
        papel_erp: (clienteInicial.papel_erp ?? 'cliente') as FormCadastroPessoaValues['papel_erp'],
        cpf_cnpj: clienteInicial.cpf_cnpj ?? '',
        email: clienteInicial.email ?? '',
        telefone: clienteInicial.telefone ?? '',
        status: clienteInicial.status,
        observacoes: clienteInicial.observacoes ?? '',
      })
    } else {
      reset(defaults)
    }
  }, [clienteInicial, reset])

  const onSubmit = async (data: FormCadastroPessoaValues) => {
    try {
      if (isEdit && clienteInicial) {
        const c = await update.mutateAsync({
          id: clienteInicial.id,
          ...data,
          email: data.email || null,
          cpf_cnpj: data.cpf_cnpj || null,
          telefone: data.telefone || null,
          observacoes: data.observacoes || null,
        })
        toast.success('Cadastro atualizado!')
        onSuccess(c as Cliente)
        return
      }
      const c = await create.mutateAsync({
        ...data,
        escritorio_id: escritorioId,
        email: data.email || null,
        cpf_cnpj: data.cpf_cnpj || null,
        endereco: null,
        telefone: data.telefone || null,
        observacoes: data.observacoes || null,
      })
      toast.success('Cadastro criado!')
      onSuccess(c as Cliente)
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input {...register('nome')} placeholder="Nome completo ou razão social" />
        <FormError>{errors.nome?.message}</FormError>
      </div>
      <div>
        <Label>Papel no escritório (ERP) *</Label>
        <Select {...register('papel_erp')}>
          {(Object.keys(PAPEL_ERP_LABELS) as PapelErp[]).map(p => (
            <option key={p} value={p}>{PAPEL_ERP_LABELS[p]}</option>
          ))}
        </Select>
        <p className="text-[10px] text-muted-foreground mt-0.5">Fornecedores usam os mesmos lançamentos e relatórios de custo.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo de pessoa</Label>
          <Select {...register('tipo')}>
            <option value="PF">Pessoa Física</option>
            <option value="PJ">Pessoa Jurídica</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select {...register('status')}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="prospecto">Prospecto</option>
          </Select>
        </div>
      </div>
      <div>
        <Label>CPF / CNPJ</Label>
        <Input {...register('cpf_cnpj')} placeholder="000.000.000-00" />
      </div>
      <div>
        <Label>Email</Label>
        <Input {...register('email')} type="email" />
        <FormError>{errors.email?.message}</FormError>
      </div>
      <div>
        <Label>Telefone</Label>
        <Input {...register('telefone')} placeholder="(11) 99999-9999" />
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea {...register('observacoes')} rows={2} />
      </div>
      {showFooter && (
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={create.isPending || update.isPending}>
            Salvar
          </Button>
        </div>
      )}
    </form>
  )
}
