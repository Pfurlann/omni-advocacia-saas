'use client'

import { useMemo, useState, useCallback } from 'react'
import { useFinAllocacaoCustos, type BaseCusto } from '@/hooks/useFinAllocacaoCustos'
import { formatCurrency } from '@/lib/formatters'
import { buildOmniCsvString, downloadOmniCsvFile } from '@/lib/csv'
import { FileDown, PieChart } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { Button, Select, Input, Label } from '@/components/ui'
import { toast } from 'sonner'
function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function lastDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

export default function FinCustosAllocacaoPage() {
  const now = useMemo(() => new Date(), [])
  const [from, setFrom] = useState(firstDayOfMonth(now))
  const [to, setTo] = useState(lastDayOfMonth(now))
  const [base, setBase] = useState<BaseCusto>('pagamento')
  const { data, isLoading } = useFinAllocacaoCustos(from, to, base)

  const exportar = useCallback(() => {
    if (!data) return
    const titulo = base === 'pagamento'
      ? 'Despesas por alocação (base: data de pagamento, só pagas)'
      : 'Despesas por alocação (base: data de vencimento)'
    const csv = buildOmniCsvString({
      title: titulo,
      headers: ['Tipo', 'Nome / identificação', 'Nº proc.', 'Valor (R$)', 'Lançamentos'],
      rows: [
        ...data.porCliente.map(r => ['Por pessoa (cliente/forn.)', r.nome, '—', formatCurrency(r.total), String(r.qtd)]),
        ...data.porProcesso.map(r => ['Por processo', r.nome, r.numero ?? '—', formatCurrency(r.total), String(r.qtd)]),
        ['Escritório (sem pessoa e sem processo)', '—', '—', formatCurrency(data.escritorioFixo), String(data.escritorioQtd)],
      ],
    })
    downloadOmniCsvFile(`omni_despesas_allocacao_${from}_${to}.csv`, csv)
    toast.success('CSV descarregado')
  }, [data, base, from, to])

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Custo por cliente e processo</h1>
      <div>
        <p className="text-sm font-medium text-foreground">Despesas alocadas — ERP</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Soma de <strong>despesas</strong> atribuídas a pessoas cadastradas (clientes/fornecedores) e a processos. Linhas sem pessoa e sem processo entram como custo do escritório.
          Use <strong>base pagamento</strong> para custo de caixa real (recomendado).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[10.5rem]" />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-[10.5rem]" />
        </div>
        <div>
          <Label className="text-xs">Base</Label>
          <Select value={base} onChange={e => setBase(e.target.value as BaseCusto)} className="min-w-[12rem]">
            <option value="pagamento">Data de pagamento (só pagas)</option>
            <option value="vencimento">Data de vencimento (abertas + pagas)</option>
          </Select>
        </div>
        <Button variant="secondary" size="sm" onClick={exportar} disabled={!data?.linhas}>
          <FileDown className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <OmniSpinner size="lg" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="omni-card p-4 border-destructive/15">
              <p className="text-xs font-medium text-muted-foreground">Total despesas no período</p>
              <p className="text-xl font-bold text-destructive mt-1">{formatCurrency(data.totalGeral)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{data.linhas} lançamentos</p>
            </div>
            <div className="omni-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Só escritório (sem vínculo)</p>
              <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(data.escritorioFixo)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{data.escritorioQtd} lançamentos</p>
            </div>
            <div className="omni-card p-4 flex items-center gap-2 text-muted-foreground">
              <PieChart className="h-8 w-8 opacity-40" />
              <p className="text-xs">Preencha pessoa e/ou processo nos lançamentos para ver o detalhe abaixo.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="omni-card overflow-hidden">
              <div className="omni-card-header">
                <h2 className="text-sm font-semibold">Por pessoa (cliente / fornecedor)</h2>
              </div>
              <table className="omni-table">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porCliente.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-muted-foreground text-sm py-6">Nenhuma despesa com pessoa vinculada</td></tr>
                  ) : (
                    data.porCliente.map(r => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.nome}</td>
                        <td className="text-right">{formatCurrency(r.total)}</td>
                        <td className="text-right text-muted-foreground">{r.qtd}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="omni-card overflow-hidden">
              <div className="omni-card-header">
                <h2 className="text-sm font-semibold">Por processo</h2>
              </div>
              <table className="omni-table">
                <thead>
                  <tr>
                    <th>Processo</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porProcesso.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-muted-foreground text-sm py-6">Nenhuma despesa com processo vinculado</td></tr>
                  ) : (
                    data.porProcesso.map(r => (
                      <tr key={r.id}>
                        <td>
                          <p className="font-medium line-clamp-2">{r.nome}</p>
                          {r.numero && <p className="text-[10px] text-muted-foreground font-mono">{r.numero}</p>}
                        </td>
                        <td className="text-right">{formatCurrency(r.total)}</td>
                        <td className="text-right text-muted-foreground">{r.qtd}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
