'use client'
import { useState } from 'react'
import { useProcessos } from '@/hooks/useProcessos'
import { AREA_LABELS, AREA_CORES, PRIORIDADE_LABELS, PRIORIDADE_CORES } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { Plus, FileText } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FormProcesso } from '@/components/processos/FormProcesso'
import { Button, SearchInput, EmptyState } from '@/components/ui'

export default function ProcessosPage() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const { data: processos = [], isLoading } = useProcessos({ search })

  return (
    <div className="page-enter space-y-5">
      <h1 className="sr-only">Processos</h1>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {processos.length} {processos.length === 1 ? 'processo ativo' : 'processos ativos'}
        </p>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Novo Processo
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar processo..."
        />
      </div>

      {/* ── Tabela ── */}
      <div className="omni-card">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <OmniSpinner size="md" />
          </div>
        ) : processos.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum processo encontrado"
            description={search ? 'Tente outro termo de busca.' : 'Crie seu primeiro processo.'}
            action={
              !search ? (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Novo Processo
                </Button>
              ) : undefined
            }
          />
        ) : (
          <table className="omni-table">
            <thead>
              <tr>
                {['Processo', 'Cliente', 'Área', 'Etapa', 'Prioridade', 'Data'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processos.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/processos/${p.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {p.titulo}
                    </Link>
                    {p.numero_processo && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.numero_processo}</p>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    {(p as any).cliente?.nome ?? '—'}
                  </td>
                  <td>
                    <span
                      className="badge text-white"
                      style={{ backgroundColor: AREA_CORES[p.area] ?? '#6b7280' }}
                    >
                      {AREA_LABELS[p.area]}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: (p as any).etapa?.cor ?? '#6b7280' }}
                      />
                      <span className="text-muted-foreground text-sm">{(p as any).etapa?.nome ?? '—'}</span>
                    </span>
                  </td>
                  <td>
                    <span className={cn('badge', PRIORIDADE_CORES[p.prioridade])}>
                      {PRIORIDADE_LABELS[p.prioridade]}
                    </span>
                  </td>
                  <td className="text-muted-foreground text-xs">
                    {p.data_distribuicao ? formatDate(p.data_distribuicao) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <FormProcesso onClose={() => setShowForm(false)} />}
    </div>
  )
}
