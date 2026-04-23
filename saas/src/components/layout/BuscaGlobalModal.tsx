'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui'
import { useClientes } from '@/hooks/useClientes'
import { useProcessos } from '@/hooks/useProcessos'
import { useDebounce } from '@/lib/use-debounce'
import { formatNumeroProcesso } from '@/lib/formatters'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'
import { Building2, Scale, Search } from 'lucide-react'
import { useState } from 'react'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import type { Cliente, ProcessoComCliente } from '@/types/database'
import { opcaoRotulo } from '@/lib/opcoes-helpers'

interface Props {
  open: boolean
  onClose: () => void
}

const MIN = 2

export function BuscaGlobalModal({ open, onClose }: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const deb = useDebounce(q, 280)
  const inputRef = useRef<HTMLInputElement>(null)
  const canSearch = deb.trim().length >= MIN

  useEffect(() => {
    if (!open) {
      setQ('')
      return
    }
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  const { data: cliRes, isFetching: loadCl } = useClientes({
    search: deb,
    pageSize: 25,
    page: 1,
    enabled: open && canSearch,
  })
  const { data: procRows = [], isFetching: loadPr } = useProcessos({
    buscaLivre: deb,
    arquivado: false,
    prazo_vencimento: 'todos',
    tipo_prazo: 'todos',
    enabled: open && canSearch,
  })

  const clientes = cliRes?.clientes ?? []
  const processos = procRows

  const busy = canSearch && (loadCl || loadPr)
  const empty = canSearch && !busy && clientes.length === 0 && processos.length === 0

  const goCliente = (c: Cliente) => {
    onClose()
    router.push(`/clientes/${c.id}`)
  }
  const goProcesso = (p: ProcessoComCliente) => {
    onClose()
    router.push(`/processos/${p.id}`)
  }

  return (
    <Modal open={open} onClose={onClose} title="Busca global" size="xl" className="!max-w-3xl">
      <div className="p-4 space-y-4">
        <div>
          <label className="sr-only" htmlFor="busca-global-input">Buscar pessoas e processos</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              id="busca-global-input"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Nome, CPF/CNPJ, título ou número do processo…"
              className="pl-10 h-11 text-sm"
              autoComplete="off"
            />
          </div>
        </div>

        {!canSearch && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Digite pelo menos {MIN} caracteres para buscar pessoas e processos.
          </p>
        )}

        {canSearch && busy && (
          <div className="flex justify-center py-10">
            <OmniSpinner size="md" />
          </div>
        )}

        {empty && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado para &ldquo;{deb.trim()}&rdquo;.</p>
        )}

        {canSearch && !busy && (clientes.length > 0 || processos.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[200px]">
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Pessoas ({clientes.length})
              </h3>
              <ul className="border border-border rounded-xl overflow-hidden divide-y divide-border max-h-[min(45vh,420px)] overflow-y-auto">
                {clientes.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => goCliente(c)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-secondary/80 transition-colors',
                        'flex flex-col gap-0.5',
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{c.nome}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {PAPEL_ERP_LABELS[c.papel_erp] ?? c.papel_erp}
                        {c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : null}
                      </span>
                    </button>
                  </li>
                ))}
                {clientes.length === 0 && (
                  <li className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhuma pessoa</li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                Processos ({processos.length})
              </h3>
              <ul className="border border-border rounded-xl overflow-hidden divide-y divide-border max-h-[min(45vh,420px)] overflow-y-auto">
                {processos.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => goProcesso(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground line-clamp-2">{p.titulo}</span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        {(p as { cliente?: { nome?: string } }).cliente?.nome}
                        {p.numero_processo ? ` · ${formatNumeroProcesso(p.numero_processo)}` : null}
                        {p.etapa?.nome ? ` · ${p.etapa.nome}` : null}
                        {p.area ? ` · ${opcaoRotulo(p.area)}` : null}
                      </span>
                    </button>
                  </li>
                ))}
                {processos.length === 0 && (
                  <li className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum processo</li>
                )}
              </ul>
            </section>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Também em{' '}
          <Link href="/clientes" className="text-primary hover:underline" onClick={onClose}>Cadastros</Link>
          {' · '}
          <Link href="/processos" className="text-primary hover:underline" onClick={onClose}>Processos</Link>
        </p>
      </div>
    </Modal>
  )
}
