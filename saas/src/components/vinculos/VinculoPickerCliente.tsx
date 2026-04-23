'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { Input, Label } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { useClientes, useCliente } from '@/hooks/useClientes'
import { ModalPesquisaVinculo } from './ModalPesquisaVinculo'
import { Search, X, ChevronsUpDown, User, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PAPEL_ERP_LABELS } from '@/lib/constants'
import type { Cliente } from '@/types/database'

function matchNomeCpf(c: Cliente, q: string) {
  const t = q.trim().toLowerCase()
  if (!t) return true
  if (c.nome.toLowerCase().includes(t)) return true
  const dig = t.replace(/\D/g, '')
  if (dig.length >= 2 && (c.cpf_cnpj ?? '').replace(/\D/g, '').includes(dig)) return true
  return false
}

type Props = {
  value: string
  onChange: (id: string) => void
  label: string
  hint?: string
  disabled?: boolean
  name?: string
}

export function VinculoPickerCliente({ value, onChange, label, hint, disabled, name }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: page } = useClientes({ pageSize: 500, page: 1 })
  const pool = page?.clientes ?? []
  const { data: remoto } = useCliente(value)
  const display = useMemo(() => {
    if (!value) return null
    const local = pool.find(c => c.id === value)
    if (local) return local
    if (remoto && remoto.id === value) return remoto
    return null
  }, [value, pool, remoto])

  const filtrados = useMemo(() => pool.filter(c => matchNomeCpf(c, q)).slice(0, 32), [pool, q])

  useEffect(() => {
    if (!open) return
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  const pick = (c: Cliente) => {
    onChange(c.id)
    setQ('')
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setQ('')
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Label>{label}</Label>

      <div className="flex items-stretch gap-2 min-w-0">
        {display && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 h-11 w-11 p-0 rounded-xl border border-border"
            disabled={disabled}
            onClick={clear}
            title="Remover pessoa (apenas escritório)"
            aria-label="Limpar pessoa vinculada"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Popover open={open} onOpenChange={v => { setOpen(v); if (v) setQ('') }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'form-input flex-1 min-w-0 min-h-[2.75rem] flex items-center justify-between gap-2 text-left',
                'hover:border-primary/30 transition-colors',
                !display && 'text-muted-foreground',
              )}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                {display ? (
                  <User className="h-4 w-4 text-primary/80 shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                )}
                <span className="truncate">
                  {display
                    ? (
                      <span>
                        <span className="font-medium text-foreground">{display.nome}</span>
                        <span className="text-xs text-muted-foreground font-normal sm:inline block sm:mt-0 mt-0.5">
                          {' '}
                          ·
                          {PAPEL_ERP_LABELS[display.papel_erp] ?? display.papel_erp}
                        </span>
                      </span>
                    ) : (
                      'Apenas escritório — clique para vincular uma pessoa'
                    )}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,22rem)] max-w-lg"
            align="start"
            onOpenAutoFocus={e => e.preventDefault()}
          >
            <div className="p-2 border-b border-border bg-secondary/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Filtrar por nome ou CPF/CNPJ…"
                  className="pl-9 h-9 text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 flex items-start gap-2"
                  onClick={() => { clear() }}
                >
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">Apenas escritório</span>
                    <span className="block text-[11px] text-muted-foreground">Sem pessoa vinculada a este lançamento</span>
                  </span>
                </button>
              </li>
              {filtrados.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/80 border-t border-border/60"
                    onClick={() => pick(c)}
                  >
                    <span className="font-medium text-foreground">{c.nome}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {PAPEL_ERP_LABELS[c.papel_erp] ?? c.papel_erp}
                      {c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 shrink-0 p-0 rounded-xl border border-border"
          disabled={disabled}
          title="Pesquisa em tela cheia"
          onClick={() => setModal(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {hint ? <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p> : null}

      <ModalPesquisaVinculo
        mode="cliente"
        open={modal}
        onClose={() => setModal(false)}
        onSelect={c => {
          pick(c)
          setModal(false)
        }}
      />
    </div>
  )
}
