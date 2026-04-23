'use client'
import { usePrazos, useConcluirPrazo } from '@/hooks/usePrazos'
import { opcaoRotulo } from '@/lib/opcoes-helpers'
import type { PrazoComProcesso } from '@/types/database'
import { formatDate } from '@/lib/formatters'
import { AlertTriangle, CheckCircle, Calendar, Flag } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import { useState } from 'react'

export default function PrazosPage() {
  const { data: todos = [], isLoading } = usePrazos({ status: 'pendente' })
  const { data: historico = [] }       = usePrazos({ status: 'concluido' })
  const concluir                       = useConcluirPrazo()
  const [aba, setAba]                  = useState<'pendentes' | 'historico'>('pendentes')

  const urgentes = todos.filter(p => p.dias_restantes <= 3)
  const proximos = todos.filter(p => p.dias_restantes > 3 && p.dias_restantes <= 7)
  const normais  = todos.filter(p => p.dias_restantes > 7)

  const handleConcluir = async (id: string) => {
    await concluir.mutateAsync(id)
    toast.success('Prazo concluído!')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <OmniSpinner size="lg" />
      </div>
    )
  }

  function PrazoItem({ prazo }: { prazo: (typeof todos)[0] }) {
    const dias    = prazo.dias_restantes
    const vencido = dias < 0
    const urgente = dias <= 3 && !vencido
    return (
      <div className={cn(
        'flex items-start gap-3 p-4 rounded-xl border transition-colors',
        vencido ? 'border-destructive/30 bg-destructive/5'
          : urgente ? 'border-destructive/20 bg-destructive/5'
          : 'border-border bg-card',
      )}>
        {/* ícone */}
        <div className={cn(
          'p-2 rounded-xl shrink-0',
          vencido || urgente ? 'bg-destructive/10' : 'bg-primary/10',
        )}>
          {vencido || urgente
            ? <AlertTriangle className={cn('h-4 w-4', vencido && 'animate-pulse text-destructive', urgente && 'text-destructive')} />
            : <Calendar className="h-4 w-4 text-primary" />}
        </div>

        {/* conteúdo */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">{prazo.titulo}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{opcaoRotulo((prazo as PrazoComProcesso).tipo_prazo)}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatDate(prazo.data_prazo)}</span>
            {(prazo as any).processo && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <Link href={`/processos/${(prazo as any).processo.id}`} className="text-xs text-primary hover:underline truncate">
                  {(prazo as any).processo.titulo}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* badge + ação */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'badge',
            vencido ? 'badge-danger'
              : dias === 0 ? 'badge-danger'
              : urgente ? 'badge-warning'
              : 'badge-primary',
          )}>
            {dias < 0 ? 'Vencido' : dias === 0 ? 'Hoje' : `${dias}d`}
          </span>
          <button
            onClick={() => handleConcluir(prazo.id)}
            className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition"
            title="Marcar concluído"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto page-enter space-y-6">
      <h1 className="sr-only">Prazos</h1>
      <p className="text-xs text-muted-foreground">
        {todos.length} pendentes · {urgentes.length} urgentes
      </p>

      {/* ── Tabs ── */}
      <div className="tab-bar">
        {(['pendentes', 'historico'] as const).map(t => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={cn('tab-item', aba === t && 'active')}
          >
            {t === 'pendentes' ? `Pendentes (${todos.length})` : `Histórico (${historico.length})`}
          </button>
        ))}
      </div>

      {/* ── Pendentes ── */}
      {aba === 'pendentes' && (
        <div className="space-y-6">
          {urgentes.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 animate-pulse" /> URGENTE — próximos 3 dias
              </h2>
              <div className="space-y-2">{urgentes.map(p => <PrazoItem key={p.id} prazo={p} />)}</div>
            </div>
          )}
          {proximos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-600 mb-3">Esta semana</h2>
              <div className="space-y-2">{proximos.map(p => <PrazoItem key={p.id} prazo={p} />)}</div>
            </div>
          )}
          {normais.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Próximos</h2>
              <div className="space-y-2">{normais.map(p => <PrazoItem key={p.id} prazo={p} />)}</div>
            </div>
          )}
          {todos.length === 0 && (
            <div className="empty-state">
              <CheckCircle className="h-12 w-12 empty-state-icon" />
              <p className="text-sm font-medium text-foreground">Nenhum prazo pendente</p>
              <p className="text-xs text-muted-foreground">Bom trabalho! Tudo em dia.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Histórico ── */}
      {aba === 'historico' && (
        <div className="space-y-2">
          {historico.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card opacity-60">
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.titulo}</p>
                <p className="text-xs text-muted-foreground">{formatDate(p.data_prazo)}</p>
              </div>
            </div>
          ))}
          {historico.length === 0 && (
            <p className="text-center py-8 text-sm text-muted-foreground">Nenhum prazo concluído ainda</p>
          )}
        </div>
      )}
    </div>
  )
}
