'use client'
import { useKpiDashboard, useDreMensal } from '@/hooks/useDashboard'
import { formatCurrency } from '@/lib/formatters'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  DollarSign,
  FileSpreadsheet,
  LayoutList,
  Receipt,
  Tags,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const MODULOS = [
  { href: '/financeiro/lancamentos', label: 'Lançamentos', desc: 'Receitas, despesas e acordos parcelados', icon: LayoutList },
  { href: '/financeiro/fluxo-caixa', label: 'Fluxo de caixa', desc: 'Caixa real por data de pagamento', icon: TrendingUp },
  { href: '/financeiro/dfc', label: 'DFC', desc: 'Fluxos por natureza (CPC 03, via plano)', icon: BarChart3 },
  { href: '/financeiro/plano-contas', label: 'Plano de contas', desc: 'Estrutura contábil e DFC', icon: BookOpen },
  { href: '/financeiro/notas-fiscais', label: 'Notas fiscais', desc: 'Entrada e saída / faturamento', icon: Receipt },
  { href: '/financeiro/fiscal', label: 'CFOP / Fiscal', desc: 'CFOP e ligação ao plano', icon: Tags },
  { href: '/financeiro/relatorios', label: 'Relatórios AP/AR', desc: 'Contas a pagar e a receber + CSV', icon: FileSpreadsheet },
] as const

export default function FinanceiroPage() {
  const { data: kpi, isLoading: loadingKpi } = useKpiDashboard()
  const { data: dre = [], isLoading: loadingDre } = useDreMensal(12)

  if (loadingKpi) return (
    <div className="flex justify-center py-16">
      <OmniSpinner size="lg" />
    </div>
  )

  const resultado = kpi?.resultado_mes ?? 0
  const kpis = [
    { label: 'Receita do mês',   valor: kpi?.receita_mes ?? 0,        icon: TrendingUp,   positivo: true  },
    { label: 'Despesas do mês',  valor: kpi?.despesa_mes ?? 0,        icon: TrendingDown,  positivo: false },
    { label: 'Resultado líquido',valor: resultado,                     icon: DollarSign,   positivo: resultado >= 0 },
    { label: 'Inadimplência',    valor: kpi?.inadimplencia_total ?? 0, icon: AlertCircle,  positivo: false },
  ]

  return (
    <div className="page-enter space-y-6">
      <h1 className="sr-only">Financeiro</h1>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Visão geral</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Indicadores e DRE do escritório. Aceda aos módulos abaixo.</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={cn(
            'omni-card p-5',
            k.positivo ? 'border-emerald-200 bg-emerald-50' : 'border-destructive/20 bg-destructive/5',
          )}>
            <div className="flex items-start justify-between mb-2">
              <p className={cn('text-xs font-semibold uppercase tracking-wide', k.positivo ? 'text-emerald-600' : 'text-destructive')}>
                {k.label}
              </p>
              <k.icon className={cn('h-4 w-4', k.positivo ? 'text-emerald-500' : 'text-destructive')} />
            </div>
            <p className={cn('text-2xl font-bold', k.positivo ? 'text-emerald-700' : 'text-destructive')}>
              {formatCurrency(k.valor)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Gráfico DRE ── */}
      <div className="omni-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-6">Receitas vs Despesas — últimos 12 meses</h2>
        {loadingDre ? (
          <div className="flex justify-center py-8"><OmniSpinner size="md" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dre} barGap={4}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(240 12% 48%)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(240 12% 48%)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(145 65% 42%)" radius={[5,5,0,0]} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(0 72% 51%)"   radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── DRE Tabela ── */}
      <div className="omni-card">
        <div className="omni-card-header">
          <h2 className="text-sm font-semibold text-foreground">DRE Mensal</h2>
        </div>
        <table className="omni-table">
          <thead>
            <tr>
              {['Mês', 'Receitas', 'Despesas', 'Resultado', 'Margem'].map(h => (
                <th key={h} className={h !== 'Mês' ? 'text-right' : ''}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...dre].reverse().map(d => {
              const margem = d.receitas > 0 ? ((d.resultado / d.receitas) * 100).toFixed(1) : '0'
              return (
                <tr key={d.mes}>
                  <td className="font-medium text-foreground">{d.mes}</td>
                  <td className="text-right text-emerald-600 font-medium">{formatCurrency(d.receitas)}</td>
                  <td className="text-right text-destructive font-medium">{formatCurrency(d.despesas)}</td>
                  <td className={cn('text-right font-bold', d.resultado >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                    {formatCurrency(d.resultado)}
                  </td>
                  <td className="text-right text-muted-foreground">{margem}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Módulos financeiros</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULOS.map(m => (
            <Link
              key={m.href}
              href={m.href}
              className="group omni-card p-4 flex gap-3 items-start border-border/80 hover:border-primary/25 hover:bg-primary/[0.03] transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <m.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-foreground text-sm group-hover:text-primary transition inline-flex items-center gap-1">
                  {m.label} <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{m.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
