'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { Input, Label } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { useProcessos, useProcessoResumo, useProcessosSelectLancamento } from '@/hooks/useProcessos'
import { ModalPesquisaVinculo } from './ModalPesquisaVinculo'
import { Search, X, ChevronsUpDown, FileText, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumeroProcesso } from '@/lib/formatters'
import type { ProcessoComCliente } from '@/types/database'

type LinhaP = { id: string; titulo: string; numero_processo: string | null; cliente_id: string }

function matchProc(p: LinhaP, q: string) {
  const t = q.trim().toLowerCase()
  if (!t) return true
  if (p.titulo.toLowerCase().includes(t)) return true
  const n = (p.numero_processo ?? '').toLowerCase()
  return n.includes(t) || n.replace(/\D/g, '').includes(t.replace(/\D/g, ''))
}

type Props = {
  value: string
  onChange: (id: string) => void
  label: string
  hint?: string
  clienteFiltroId?: string | null
  disabled?: boolean
  name?: string
}

export function VinculoPickerProcesso({ value, onChange, label, hint, clienteFiltroId, disabled, name }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: pool = [] } = useProcessosSelectLancamento(clienteFiltroId, true)
  const busca2 = open && q.trim().length >= 2
  const { data: profundo = [] } = useProcessos({
    buscaLivre: q.trim(),
    arquivado: false,
    prazo_vencimento: 'todos',
    tipo_prazo: 'todos',
    cliente_id: clienteFiltroId || undefined,
    enabled: busca2,
  })
  const { data: resumo } = useProcessoResumo(value)

  const opcoes = useMemo((): LinhaP[] => {
    if (busca2) {
      const m = new Map<string, LinhaP>()
      for (const p of profundo as ProcessoComCliente[]) {
        m.set(p.id, {
          id: p.id,
          titulo: p.titulo,
          numero_processo: p.numero_processo,
          cliente_id: p.cliente_id,
        })
      }
      return [...m.values()].slice(0, 32)
    }
    return pool.filter(p => matchProc(p, q)).slice(0, 32)
  }, [busca2, profundo, pool, q])

  const display = useMemo((): LinhaP | null => {
    if (!value) return null
    const inPool = pool.find(p => p.id === value)
    if (inPool) return inPool
    if (resumo && resumo.id === value) {
      return {
        id: resumo.id,
        titulo: resumo.titulo,
        numero_processo: resumo.numero_processo,
        cliente_id: resumo.cliente_id,
      }
    }
    return null
  }, [value, pool, resumo])

  useEffect(() => {
    if (!open) return
    const t = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  const pick = (p: LinhaP) => {
    onChange(p.id)
    setQ('')
    setOpen(false)
  }

  const semProcesso = () => {
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
            onClick={semProcesso}
            title="Remover vínculo com processo"
            aria-label="Limpar processo"
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
                <FileText
                  className={cn('h-4 w-4 shrink-0', display ? 'text-primary/80' : 'text-muted-foreground/60')}
                />
                <span className="truncate">
                  {display
                    ? (
                      <span>
                        <span className="font-medium text-foreground line-clamp-1">{display.titulo}</span>
                        {display.numero_processo && (
                          <span className="text-xs text-muted-foreground font-normal sm:inline block sm:mt-0 mt-0.5">
                            {' '}
                            ·
                            {formatNumeroProcesso(display.numero_processo)}
                          </span>
                        )}
                      </span>
                    ) : (
                      'Nenhum processo — clique para vincular'
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
                  placeholder="Título ou número; 2+ caracteres = busca no banco"
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
                  onClick={semProcesso}
                >
                  <Ban className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">Sem processo</span>
                    <span className="block text-[11px] text-muted-foreground">Lançamento sem pasta processual</span>
                  </span>
                </button>
              </li>
              {opcoes.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/80 border-t border-border/60"
                    onClick={() => pick(p)}
                  >
                    <span className="font-medium text-foreground line-clamp-2">{p.titulo}</span>
                    {p.numero_processo && (
                      <span className="block text-[11px] text-muted-foreground">
                        {formatNumeroProcesso(p.numero_processo)}
                      </span>
                    )}
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
        mode="processo"
        open={modal}
        onClose={() => setModal(false)}
        onSelect={p => {
          pick(p)
          setModal(false)
        }}
        clienteFiltroId={clienteFiltroId}
      />
    </div>
  )
}
