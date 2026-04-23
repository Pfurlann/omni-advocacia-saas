'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, SearchInput } from '@/components/ui'
import { useClientes } from '@/hooks/useClientes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { FormCadastroPessoa } from './FormCadastroPessoa'
import { Plus, User } from 'lucide-react'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import type { Cliente } from '@/types/database'

type View = 'list' | 'novo'

type Props = {
  open: boolean
  onClose: () => void
  /** Quando o utilizador escolhe uma pessoa da lista (ou cria e salva). */
  onPessoaSelecionada: (id: string) => void
}

/**
 * Listagem de cadastros + novo cadastro, para usar por cima do modal de lançamento (ou outro fluxo).
 */
export function ModalCadastrosPessoas({ open, onClose, onPessoaSelecionada }: Props) {
  const [view, setView] = useState<View>('list')
  const [q, setQ] = useState('')
  const { data: esc } = useEscritorio()
  const { data, isLoading } = useClientes({ search: q, page: 1, pageSize: 50, enabled: open && view === 'list' })
  const clientes = data?.clientes ?? []

  useEffect(() => {
    if (!open) {
      setView('list')
      setQ('')
    }
  }, [open])

  const selecionar = (c: Cliente) => {
    onPessoaSelecionada(c.id)
    onClose()
  }

  const aposCriar = (c: Cliente) => {
    onPessoaSelecionada(c.id)
    onClose()
    setView('list')
    setQ('')
  }

  if (!esc) return null

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); setView('list'); setQ('') }}
      title={view === 'list' ? 'Cadastros (pessoas)' : 'Novo cadastro'}
      size="2xl"
      stack
      className="!max-w-4xl"
    >
      {view === 'list' && (
        <div className="flex flex-col min-h-0 min-h-[min(50dvh,360px)]">
          <div className="p-3 border-b border-border space-y-2 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="max-w-md flex-1">
                <SearchInput
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar por nome, CPF ou CNPJ…"
                />
              </div>
              <Button type="button" onClick={() => setView('novo')} className="shrink-0">
                <Plus className="h-4 w-4" /> Novo cadastro
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Toque numa linha para vincular a este lançamento. Ou crie alguém novo.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-0">
            {isLoading && (
              <p className="p-4 text-sm text-muted-foreground text-center">Carregando…</p>
            )}
            {!isLoading && clientes.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhum cadastro a mostrar. Ajuste a busca ou crie um novo.</p>
            )}
            <ul className="divide-y divide-border">
              {clientes.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(c)}
                    className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-start gap-3"
                  >
                    <User className="h-4 w-4 text-primary/70 shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground block truncate">{c.nome}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {PAPEL_ERP_LABELS[c.papel_erp] ?? c.papel_erp}
                        {c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {view === 'novo' && (
        <div>
          <div className="px-4 pt-3 border-b border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-1 -ml-1 text-muted-foreground"
              onClick={() => setView('list')}
            >
              ← Voltar à lista
            </Button>
          </div>
          <FormCadastroPessoa
            escritorioId={esc.id}
            clienteInicial={null}
            onSuccess={aposCriar}
            onCancel={() => setView('list')}
          />
        </div>
      )}
    </Modal>
  )
}
