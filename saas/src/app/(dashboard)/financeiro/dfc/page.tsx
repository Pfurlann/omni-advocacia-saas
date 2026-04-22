'use client'

import { useFinDfcMensal } from '@/hooks/useFinRelatorios'
import { formatCurrency } from '@/lib/formatters'
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = {
  operacional: 'Operacional',
  investimento: 'Investimentos',
  financiamento: 'Financiamento',
}

export default function DfcPage() {
  const { data, isLoading } = useFinDfcMensal(12)
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Demonstração dos fluxos de caixa (DFC)</h1>
      <div>
        <p className="text-sm font-medium text-foreground">DFC — método indireto simplificado (caixa)</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Agrupa lançamentos <strong>pagos</strong> por <strong>data de pagamento</strong> e pela natureza
          DFC atribuída na conta do <strong>plano de contas</strong> (CPC 03: operacional, investimento, financiamento).
          Títulos sem conta ou sem natureza entram em <em>operacional</em>. Consulte o contador para fechamento oficial.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-20">
          <OmniSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="omni-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Fluxo líquido por mês (R$)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.linhas} barGap={0} maxBarSize={20}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="operacional" name={LABELS.operacional} fill="hsl(210 60% 48%)" />
                <Bar dataKey="investimento" name={LABELS.investimento} fill="hsl(32 90% 45%)" />
                <Bar dataKey="financiamento" name={LABELS.financiamento} fill="hsl(145 50% 40%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="omni-card">
            <div className="omni-card-header">
              <h2 className="text-sm font-semibold text-foreground">Tabela — fluxo por natureza (líquido do mês)</h2>
            </div>
            <table className="omni-table text-sm">
              <thead>
                <tr>
                  <th>Período</th>
                  <th className="text-right">{LABELS.operacional}</th>
                  <th className="text-right">{LABELS.investimento}</th>
                  <th className="text-right">{LABELS.financiamento}</th>
                  <th className="text-right">Total mês</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map(l => {
                  const t = l.operacional + l.investimento + l.financiamento
                  return (
                    <tr key={l.mesId}>
                      <td className="font-medium capitalize">{l.mes}</td>
                      <td className={cn('text-right', l.operacional >= 0 ? 'text-emerald-800' : 'text-destructive')}>
                        {formatCurrency(l.operacional)}
                      </td>
                      <td className={cn('text-right', l.investimento >= 0 ? 'text-emerald-800' : 'text-destructive')}>
                        {formatCurrency(l.investimento)}
                      </td>
                      <td className={cn('text-right', l.financiamento >= 0 ? 'text-emerald-800' : 'text-destructive')}>
                        {formatCurrency(l.financiamento)}
                      </td>
                      <td className="text-right font-bold">{formatCurrency(t)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
