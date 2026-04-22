'use client'

import { useMemo, useState } from 'react'
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useFinFluxoMensal } from '@/hooks/useFinRelatorios'
import { formatCurrency } from '@/lib/formatters'
import { Bar, BarChart, Legend, Line, ComposedChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export default function FluxoCaixaPage() {
  const [mes, setMes] = useState(() => new Date())
  const { data, isLoading } = useFinFluxoMensal(mes)
  const label = format(mes, "MMMM 'de' yyyy", { locale: ptBR })

  const chartData = useMemo(
    () =>
      (data?.serie ?? []).map(p => ({
        label: p.label,
        entradas: p.entradas,
        saidas: p.saidas,
        acumulado: p.acumulado,
      })),
    [data],
  )

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Fluxo de caixa</h1>
      <div>
        <p className="text-sm font-medium text-foreground">Fluxo de caixa (regime de caixa)</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Entradas e saídas com base na <strong>data de pagamento</strong> de lançamentos com status
          pago. Ideal para acompanhar o caixa real do período.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMes(m => startOfMonth(subMonths(m, 1)))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[180px] text-center">{label}</span>
          <Button variant="secondary" size="sm" onClick={() => setMes(m => startOfMonth(addMonths(m, 1)))} aria-label="Mês seguinte">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMes(startOfMonth(new Date()))}>
            Mês atual
          </Button>
        </div>
        {data && (
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-700">Entradas: <strong>{formatCurrency(data.resumo.entradas)}</strong></span>
            <span className="text-destructive">Saídas: <strong>{formatCurrency(data.resumo.saidas)}</strong></span>
            <span className={cn(data.resumo.entradas - data.resumo.saidas >= 0 ? 'text-emerald-800' : 'text-destructive')}>
              Líquido: <strong>{formatCurrency(data.resumo.entradas - data.resumo.saidas)}</strong>
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <OmniSpinner size="lg" />
        </div>
      ) : (
        <div className="omni-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Saldo acumulado e movimento diário</h2>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="l" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={44} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name) => [formatCurrency(v), name === 'entradas' ? 'Entradas' : name === 'saidas' ? 'Saídas' : 'Acumulado']}
                labelStyle={{ fontSize: 12 }}
              />
              <Legend />
              <Bar yAxisId="l" dataKey="entradas" name="entradas" fill="hsl(145 65% 38%)" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="l" dataKey="saidas" name="saidas" fill="hsl(0 70% 45%)" radius={[3, 3, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="acumulado" name="acumulado" stroke="hsl(240 12% 35%)" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {data && data.detalhe.length > 0 && (
        <div className="omni-card p-0 overflow-hidden">
          <div className="omni-card-header">
            <h2 className="text-sm font-semibold text-foreground">Movimentos do período (pagos)</h2>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="omni-table text-sm">
              <thead>
                <tr>
                  <th>Data pag.</th>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.detalhe.map(r => {
                  const row = r as { id: string; data_pagamento: string | null; descricao: string; tipo: string; valor: number; cliente?: { nome: string } | { nome: string }[] | null }
                  const c = row.cliente
                  const cnome = c ? (Array.isArray(c) ? c[0]?.nome : c.nome) : null
                  return (
                  <tr key={row.id}>
                    <td className="text-muted-foreground whitespace-nowrap">{row.data_pagamento ? format(new Date(row.data_pagamento + 'T12:00:00'), 'dd/MM/yy') : '—'}</td>
                    <td>{row.descricao}</td>
                    <td className="text-muted-foreground">{cnome ?? '—'}</td>
                    <td className={cn('text-right font-medium', row.tipo === 'receita' ? 'text-emerald-700' : 'text-destructive')}>
                      {row.tipo === 'despesa' ? '−' : ''}{formatCurrency(row.valor)}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
