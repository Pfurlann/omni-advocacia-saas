'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button, Input, Label } from '@/components/ui'
import { useClientes } from '@/hooks/useClientes'
import { useProcessos, useProcessosSelectLancamento } from '@/hooks/useProcessos'
import { useDebounce } from '@/lib/use-debounce'
import { formatNumeroProcesso } from '@/lib/formatters'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Cliente, ProcessoComCliente } from '@/types/database'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

type Base = { open: boolean; onClose: () => void }

type ClienteMode = Base & {
  mode: 'cliente'
  onSelect: (c: Cliente) => void
}

type ProcessoMode = Base & {
  mode: 'processo'
  onSelect: (p: { id: string; titulo: string; numero_processo: string | null; cliente_id: string }) => void
  /** Quando preenchido, restringe a lista à pessoa. */
  clienteFiltroId?: string | null
}

type Props = ClienteMode | ProcessoMode

type LinhaProc = { id: string; titulo: string; numero_processo: string | null; cliente_id: string }

function matchPoolProcesso(list: LinhaProc[], q: string): LinhaProc[] {
  const t = q.trim().toLowerCase()
  if (!t) return list.slice(0, 100)
  return list
    .filter(
      p =>
        p.titulo.toLowerCase().includes(t)
        || (p.numero_processo ?? '').toLowerCase().replace(/\D/g, '').includes(t.replace(/\D/g, ''))
        || (p.numero_processo ?? '').toLowerCase().includes(t),
    )
    .slice(0, 100)
}

export function ModalPesquisaVinculo(props: Props) {
  const { open, onClose } = props
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const deb = useDebounce(q, 250)

  useEffect(() => {
    if (!open) {
      setQ('')
      setSelId(null)
    }
  }, [open])

  // ── Pessoa ──
  const { data: cliPage, isFetching: loadCli } = useClientes({
    search: deb.trim() || undefined,
    page: 1,
    pageSize: 100,
    enabled: open && props.mode === 'cliente',
  })
  const clientes = props.mode === 'cliente' ? (cliPage?.clientes ?? []) : []

  // ── Processo: pool leve + busca com 2+ chars ──
  const procCliente = props.mode === 'processo' ? (props as ProcessoMode).clienteFiltroId : null
  const { data: poolProc = [] } = useProcessosSelectLancamento(
    open && props.mode === 'processo' ? procCliente : undefined,
    open && props.mode === 'processo',
  )
  const buscaForte = open && props.mode === 'processo' && deb.trim().length >= 2
  const { data: procDeep = [], isFetching: loadDeep } = useProcessos({
    buscaLivre: deb.trim(),
    arquivado: false,
    prazo_vencimento: 'todos',
    tipo_prazo: 'todos',
    cliente_id: procCliente || undefined,
    enabled: buscaForte,
  })
  const processoLinhas: LinhaProc[] = useMemo(() => {
    if (props.mode !== 'processo') return []
    if (buscaForte) {
      return (procDeep as ProcessoComCliente[]).map(p => ({
        id: p.id,
        titulo: p.titulo,
        numero_processo: p.numero_processo,
        cliente_id: p.cliente_id,
      }))
    }
    return matchPoolProcesso(poolProc, deb)
  }, [props.mode, buscaForte, procDeep, poolProc, deb])

  const canConfirm
    = props.mode === 'cliente'
      ? selId && clientes.some(c => c.id === selId)
      : Boolean(selId && processoLinhas.some(p => p.id === selId))

  const confirm = () => {
    if (props.mode === 'cliente' && selId) {
      const c = clientes.find(x => x.id === selId)
      if (c) {
        props.onSelect(c)
        onClose()
      }
      return
    }
    if (props.mode === 'processo' && selId) {
      const p = processoLinhas.find(x => x.id === selId)
      if (p) {
        props.onSelect(p)
        onClose()
      }
    }
  }

  const title = props.mode === 'cliente' ? 'Pesquisar pessoa' : 'Pesquisar processo'
  const loadProc = props.mode === 'processo' && buscaForte && loadDeep

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" className="!max-w-2xl">
      <div className="p-4 flex flex-col min-h-0 max-h-[min(80dvh,640px)]">
        <div className="shrink-0 space-y-2 mb-3">
          <Label className="sr-only" htmlFor="modal-vinc-q">Filtro</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="modal-vinc-q"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={props.mode === 'processo' ? 'Título, número do processo…' : 'Nome, CPF/CNPJ…'}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          {props.mode === 'processo' && (
            <p className="text-[11px] text-muted-foreground">
              {deb.trim().length < 2
                ? 'Até 2 caracteres: lista dos processos recentes (mesma ordem do cadastro), filtrada localmente. A partir de 2 caracteres, busca no banco.'
                : 'Buscando no banco (até 40 resultados)…'}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 border border-border rounded-xl overflow-y-auto">
          {props.mode === 'cliente' && loadCli && clientes.length === 0 && (
            <div className="flex justify-center py-12">
              <OmniSpinner size="md" />
            </div>
          )}
          {props.mode === 'processo' && loadProc && processoLinhas.length === 0 && (
            <div className="flex justify-center py-12">
              <OmniSpinner size="md" />
            </div>
          )}

          {props.mode === 'cliente' && !loadCli && clientes.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum resultado.</p>
          )}
          {props.mode === 'processo' && !loadProc && processoLinhas.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum processo. Ajuste o filtro.</p>
          )}

          {props.mode === 'cliente' && clientes.length > 0 && (
            <ul className="divide-y divide-border">
              {clientes.map(c => {
                const active = selId === c.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelId(c.id)}
                      onDoubleClick={() => {
                        setSelId(c.id)
                        props.onSelect(c)
                        onClose()
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm transition-colors',
                        active ? 'bg-primary/10' : 'hover:bg-secondary/80',
                      )}
                    >
                      <span className="font-medium text-foreground">{c.nome}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {PAPEL_ERP_LABELS[c.papel_erp] ?? c.papel_erp}
                        {c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {props.mode === 'processo' && processoLinhas.length > 0 && (
            <ul className="divide-y divide-border">
              {processoLinhas.map(p => {
                const active = selId === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelId(p.id)}
                      onDoubleClick={() => {
                        setSelId(p.id)
                        if (props.mode === 'processo') (props as ProcessoMode).onSelect(p)
                        onClose()
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-sm transition-colors',
                        active ? 'bg-primary/10' : 'hover:bg-secondary/80',
                      )}
                    >
                      <span className="font-medium text-foreground line-clamp-2">{p.titulo}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {p.numero_processo ? formatNumeroProcesso(p.numero_processo) : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 flex gap-2 justify-end pt-4 border-t border-border mt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!canConfirm}>
            Selecionar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
