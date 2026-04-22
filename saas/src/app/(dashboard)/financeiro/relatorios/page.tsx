'use client'

import { useState, useCallback } from 'react'
import { useFinContasPagarReceber } from '@/hooks/useFinRelatorios'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { CATEGORIA_DESPESA_LABELS, CATEGORIA_RECEITA_LABELS, STATUS_LANCAMENTO_LABELS, STATUS_LANCAMENTO_CORES } from '@/lib/constants'
import { buildOmniCsvString, downloadOmniCsvFile } from '@/lib/csv'
import { FileDown } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Tab = 'receber' | 'pagar'

export default function FinRelatoriosPage() {
  const [tab, setTab] = useState<Tab>('receber')
  const { data, isLoading } = useFinContasPagarReceber()

  const list = tab === 'receber' ? (data?.aReceber ?? []) : (data?.aPagar ?? [])
  const total = tab === 'receber' ? (data?.totReceber ?? 0) : (data?.totPagar ?? 0)

  const categoria = (c: string) => {
    const a = { ...CATEGORIA_RECEITA_LABELS, ...CATEGORIA_DESPESA_LABELS } as Record<string, string>
    return a[c] ?? c
  }

  const exportar = useCallback(() => {
    const title = tab === 'receber' ? 'Contas a receber' : 'Contas a pagar'
    const fileBase = `fin_${tab === 'receber' ? 'a_receber' : 'a_pagar'}`
    const st = (s: string) => STATUS_LANCAMENTO_LABELS[s as keyof typeof STATUS_LANCAMENTO_LABELS] ?? s
    const labels = { ...CATEGORIA_RECEITA_LABELS, ...CATEGORIA_DESPESA_LABELS } as Record<string, string>
    const cat = (c: string) => labels[c] ?? c
    const csv = buildOmniCsvString({
      title,
      headers: [
        'Data vencimento',
        'Descrição',
        'Cliente / fornecedor',
        'Processo',
        'Categoria',
        'Valor (R$)',
        'Status',
      ],
      rows: list.map(l => {
        const cx = l as { cliente?: { nome: string } }
        const pr = l as { processo?: { titulo: string } }
        return [
          formatDate(l.data_vencimento),
          l.descricao,
          cx.cliente?.nome || '—',
          pr.processo?.titulo || '—',
          cat(l.categoria),
          formatCurrency(l.valor),
          st(l.status),
        ]
      }),
    })
    const nome = `omni_${fileBase}_${new Date().toISOString().slice(0, 10)}.csv`
    downloadOmniCsvFile(nome, csv)
    toast.success('Ficheiro descarregado')
  }, [list, tab])

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Relatórios contas a pagar e a receber</h1>
      <div>
        <p className="text-sm font-medium text-foreground">Títulos em aberto (pendente e inadimplente)</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Consolidação para cobranças, compromissos de caixa e priorização. Exporte em CSV para folha de cálculo
          ou envio a contabilidade.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['receber', 'pagar'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:opacity-90',
            )}
          >
            {t === 'receber' ? 'Contas a receber' : 'Contas a pagar'}
          </button>
        ))}
        <Button variant="secondary" size="sm" onClick={exportar} disabled={!list.length}>
          <FileDown className="h-4 w-4" /> Exportar CSV
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          Total: <strong className="text-foreground">{formatCurrency(total)}</strong> · {list.length} títulos
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <OmniSpinner size="lg" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">Nenhum título em aberto nesta fila.</p>
      ) : (
        <div className="omni-card p-0 overflow-hidden">
          <div className="max-h-[min(60vh,560px)] overflow-y-auto">
            <table className="omni-table text-sm">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>Parte / Processo</th>
                  <th>Categoria</th>
                  <th className="text-right">Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map(l => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDate(l.data_vencimento)}</td>
                    <td className="font-medium">{l.descricao}</td>
                    <td className="text-muted-foreground text-xs max-w-[200px]">
                      {(l as { cliente?: { nome: string } }).cliente?.nome}
                      {(() => {
                        const p = (l as { processo?: { titulo: string } }).processo
                        if (!p) return null
                        return <span className="block truncate">{p.titulo}</span>
                      })()}
                    </td>
                    <td className="text-xs">{categoria(l.categoria)}</td>
                    <td className="text-right font-semibold">{formatCurrency(l.valor)}</td>
                    <td>
                      <span className={cn('badge', STATUS_LANCAMENTO_CORES[l.status as keyof typeof STATUS_LANCAMENTO_CORES])}>
                        {STATUS_LANCAMENTO_LABELS[l.status as keyof typeof STATUS_LANCAMENTO_LABELS]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
