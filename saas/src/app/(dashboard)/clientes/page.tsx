'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClientes, useCreateCliente, useUpdateCliente } from '@/hooks/useClientes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { formatCPF, formatCNPJ } from '@/lib/formatters'
import { Plus, Users } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Cliente, StatusCliente } from '@/types/database'
import { Button, SearchInput, Select, Input, Textarea, Label, FormError, Modal, EmptyState } from '@/components/ui'

const schema = z.object({
  nome:         z.string().min(2, 'Nome obrigatório'),
  tipo:         z.enum(['PF', 'PJ']),
  cpf_cnpj:     z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  telefone:     z.string().optional(),
  status:       z.enum(['ativo', 'inativo', 'prospecto']).default('ativo'),
  observacoes:  z.string().optional(),
})
type Form = z.infer<typeof schema>

const STATUS_BADGE: Record<StatusCliente, string> = {
  ativo:      'badge-success',
  inativo:    'badge-muted',
  prospecto:  'badge-primary',
}

const STATUS_LABEL: Record<StatusCliente, string> = {
  ativo:     'Ativo',
  inativo:   'Inativo',
  prospecto: 'Prospecto',
}

export default function ClientesPage() {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState<StatusCliente | undefined>()
  const [page, setPage]         = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const { data: escritorio }    = useEscritorio()
  const { data, isLoading }     = useClientes({ search, status, page })
  const create                  = useCreateCliente()
  const update                  = useUpdateCliente()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'PF', status: 'ativo' },
  })

  const abrirForm = (c?: Cliente) => {
    if (c) {
      setEditando(c)
      reset({ ...c, email: c.email ?? '', cpf_cnpj: c.cpf_cnpj ?? '', telefone: c.telefone ?? '', observacoes: c.observacoes ?? '' })
    } else {
      setEditando(null)
      reset({ tipo: 'PF', status: 'ativo' })
    }
    setShowForm(true)
  }

  const onSubmit = async (data: Form) => {
    if (!escritorio) return
    try {
      if (editando) {
        await update.mutateAsync({ id: editando.id, ...data, email: data.email || null, cpf_cnpj: data.cpf_cnpj || null, telefone: data.telefone || null, observacoes: data.observacoes || null })
      } else {
        await create.mutateAsync({ ...data, escritorio_id: escritorio.id, email: data.email || null, cpf_cnpj: data.cpf_cnpj || null, telefone: data.telefone || null, endereco: null, observacoes: data.observacoes || null })
      }
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente criado!')
      setShowForm(false)
    } catch { toast.error('Erro ao salvar cliente') }
  }

  const total    = data?.total ?? 0
  const clientes = data?.clientes ?? []

  return (
    <div className="page-enter space-y-5">
      <h1 className="sr-only">Clientes</h1>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
        </p>
        <Button onClick={() => abrirForm()}>
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <SearchInput
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Nome, CPF ou CNPJ..."
          />
        </div>
        <Select
          value={status ?? ''}
          onChange={e => setStatus((e.target.value || undefined) as StatusCliente)}
          className="w-auto"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="prospecto">Prospecto</option>
        </Select>
      </div>

      <div className="omni-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <OmniSpinner size="md" />
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            action={!search ? (
              <Button size="sm" onClick={() => abrirForm()}>
                <Plus className="h-3.5 w-3.5" /> Novo Cliente
              </Button>
            ) : undefined}
          />
        ) : (
          <table className="omni-table">
            <thead>
              <tr>{['Nome', 'Tipo', 'Contato', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('[data-cliente-skip-row]')) return
                    router.push(`/clientes/${c.id}`)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/clientes/${c.id}`)
                    }
                  }}
                  className="cursor-pointer hover:bg-secondary/50"
                >
                  <td>
                    <span className="font-medium text-foreground group-hover:text-primary">
                      {c.nome}
                    </span>
                    {c.cpf_cnpj && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {c.tipo === 'PF' ? formatCPF(c.cpf_cnpj) : formatCNPJ(c.cpf_cnpj)}
                      </p>
                    )}
                  </td>
                  <td><span className="badge badge-muted">{c.tipo}</span></td>
                  <td>
                    <p className="text-foreground">{c.email ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone ?? ''}</p>
                  </td>
                  <td><span className={cn('badge', STATUS_BADGE[c.status])}>{STATUS_LABEL[c.status]}</span></td>
                  <td className="text-right">
                    <button
                      data-cliente-skip-row
                      type="button"
                      onClick={e => { e.stopPropagation(); abrirForm(c) }}
                      className="text-xs text-primary hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>Próxima</Button>
          </div>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'}>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input {...register('nome')} placeholder="Nome completo ou razão social" />
            <FormError>{errors.nome?.message}</FormError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
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
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={create.isPending || update.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
