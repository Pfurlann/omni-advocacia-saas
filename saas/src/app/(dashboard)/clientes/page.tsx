'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClientes } from '@/hooks/useClientes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { formatCPF, formatCNPJ } from '@/lib/formatters'
import { Plus, Users } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'
import type { Cliente, PapelErp, StatusCliente } from '@/types/database'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import { Button, SearchInput, Select, Modal, EmptyState } from '@/components/ui'
import { FormCadastroPessoa } from '@/components/clientes/FormCadastroPessoa'

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
  const [papel, setPapel]       = useState<PapelErp | undefined>()
  const [page, setPage]         = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const { data: escritorio }    = useEscritorio()
  const { data, isLoading }     = useClientes({ search, status, papel_erp: papel, page })

  const abrirForm = (c?: Cliente) => {
    if (c) setEditando(c)
    else setEditando(null)
    setShowForm(true)
  }

  const total    = data?.total ?? 0
  const clientes = data?.clientes ?? []

  return (
    <div className="page-enter space-y-5">
      <h1 className="sr-only">Cadastros — clientes e fornecedores</h1>
      <div>
        <p className="text-sm font-medium text-foreground">Cadastros</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Mesmo cadastro para quem paga honorários, quem fatura o escritório e os dois. Usa nos lançamentos para custo por pessoa e por processo.
        </p>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'cadastro' : 'cadastros'}
        </p>
        <Button onClick={() => abrirForm()}>
          <Plus className="h-4 w-4" /> Novo cadastro
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
        <Select
          value={papel ?? ''}
          onChange={e => {
            setPapel((e.target.value || undefined) as PapelErp | undefined)
            setPage(1)
          }}
          className="w-auto min-w-[10rem]"
        >
          <option value="">Papel: todos</option>
          {(Object.keys(PAPEL_ERP_LABELS) as PapelErp[]).map(p => (
            <option key={p} value={p}>{PAPEL_ERP_LABELS[p]}</option>
          ))}
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
            title="Nenhum cadastro encontrado"
            action={!search ? (
              <Button size="sm" onClick={() => abrirForm()}>
                <Plus className="h-3.5 w-3.5" /> Novo cadastro
              </Button>
            ) : undefined}
          />
        ) : (
          <table className="omni-table">
            <thead>
              <tr>{['Nome', 'Papel (ERP)', 'Tipo pessoa', 'Contato', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
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
                  <td>
                    <span className="badge badge-primary text-[10px]">
                      {PAPEL_ERP_LABELS[c.papel_erp] ?? c.papel_erp}
                    </span>
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

      {escritorio && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editando ? 'Editar cadastro' : 'Novo cadastro (cliente / fornecedor)'}>
          <FormCadastroPessoa
            escritorioId={escritorio.id}
            clienteInicial={editando}
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  )
}
