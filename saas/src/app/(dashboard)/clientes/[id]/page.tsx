'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useCliente } from '@/hooks/useClientes'
import { useProcessos } from '@/hooks/useProcessos'
import { formatCPF, formatCNPJ, formatDate, formatNumeroProcesso } from '@/lib/formatters'
import { ArrowLeft, Scale } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ProcessoComCliente } from '@/types/database'

const AREA_LABEL: Record<string, string> = {
  trabalhista: 'Trabalhista', civil: 'Civil', criminal: 'Criminal', tributario: 'Tributário',
  previdenciario: 'Previdenciário', empresarial: 'Empresarial', familia: 'Família',
  consumidor: 'Consumidor', administrativo: 'Administrativo', imobiliario: 'Imobiliário', outro: 'Outro',
}

export default function ClienteDetalhePage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const { data: cliente, isLoading: loadingC, error: errC } = useCliente(id)
  const { data: processos = [], isLoading: loadingP, error: errP } = useProcessos({ cliente_id: id, arquivado: false })

  if (loadingC) {
    return (
      <div className="flex justify-center py-20">
        <OmniSpinner size="lg" />
      </div>
    )
  }

  if (errC || !cliente) {
    return (
      <div className="page-enter space-y-4">
        <p className="text-sm text-destructive">Cliente não encontrado.</p>
        <Link href="/clientes" className="btn-secondary btn-sm inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium">
          ← Clientes
        </Link>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-5">
      <h1 className="sr-only">Processos do cliente {cliente.nome}</h1>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/clientes"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition -ml-2 px-2 py-1 rounded-lg hover:bg-secondary/80"
          >
            <ArrowLeft className="h-4 w-4" /> Clientes
          </Link>
          <h2 className="text-xl font-semibold text-foreground">{cliente.nome}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {cliente.tipo === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}
            {cliente.cpf_cnpj && (
              <span className="ml-2 font-mono text-xs">
                {cliente.tipo === 'PF' ? formatCPF(cliente.cpf_cnpj) : formatCNPJ(cliente.cpf_cnpj)}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[cliente.email, cliente.telefone].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <span className={cn('badge shrink-0', cliente.status === 'ativo' && 'badge-success', cliente.status === 'inativo' && 'badge-muted', cliente.status === 'prospecto' && 'badge-primary')}>
          {cliente.status}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-0.5">Processos</h3>
        <p className="text-xs text-muted-foreground">
          Todos os processos vinculados a este cliente (não arquivados). Clique num processo para abrir a ficha.
        </p>
      </div>

      {errP && <p className="text-sm text-destructive">Não foi possível carregar os processos.</p>}

      {loadingP ? (
        <div className="flex justify-center py-12">
          <OmniSpinner size="md" />
        </div>
      ) : processos.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhum processo vinculado"
          action={
            <Link href="/processos" className="btn-primary btn-sm inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-primary-foreground">
              Ir para processos
            </Link>
          }
        />
      ) : (
        <div className="omni-card p-0 overflow-x-auto">
          <table className="omni-table text-sm min-w-[640px]">
            <thead>
              <tr>
                <th>Processo</th>
                <th>N.º</th>
                <th>Etapa</th>
                <th>Área</th>
                <th>Atualização</th>
              </tr>
            </thead>
            <tbody>
              {(processos as ProcessoComCliente[]).map(p => (
                <tr key={p.id} className="group">
                  <td>
                    <Link
                      href={`/processos/${p.id}`}
                      className="font-medium text-foreground group-hover:text-primary transition-colors"
                    >
                      {p.titulo}
                    </Link>
                  </td>
                  <td className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    {p.numero_processo ? formatNumeroProcesso(p.numero_processo) : '—'}
                  </td>
                  <td>
                    {p.etapa && (
                      <span className="text-xs">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full align-middle mr-1.5"
                          style={{ background: p.etapa.cor }}
                        />
                        {p.etapa.nome}
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground">{AREA_LABEL[p.area] ?? p.area}</td>
                  <td className="text-xs text-muted-foreground">
                    {p.updated_at ? formatDate(p.updated_at) : p.created_at ? formatDate(p.created_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
