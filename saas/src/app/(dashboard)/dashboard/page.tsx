'use client'
import { useKpiDashboard, useDreMensal, useProcessosPorEtapa } from '@/hooks/useDashboard'
import { usePrazos } from '@/hooks/usePrazos'
import { useLancamentos } from '@/hooks/useLancamentos'
import { formatCurrency, formatDate, formatCompact } from '@/lib/formatters'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  AlertTriangle, Briefcase, ChevronRight,
  Calendar, Clock, Flag,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { differenceInDays } from 'date-fns'

// ─── Custom Tooltip para gráfico ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, trend, currency = true, alert = false,
}: {
  label: string
  value: number
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  currency?: boolean
  alert?: boolean
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center',
          alert ? 'bg-red-50' : 'bg-secondary',
        )}>
          <Icon className={cn('h-4 w-4', alert ? 'text-red-500' : 'text-muted-foreground')} />
        </div>
      </div>
      <p className={cn(
        'text-2xl font-bold tracking-tight',
        alert && value > 0 ? 'text-red-600' : 'text-foreground',
      )}>
        {currency ? formatCompact(value) : value}
      </p>
    </div>
  )
}

// ─── Prazo Row ────────────────────────────────────────────────────────────────
function PrazoRow({ p }: { p: any }) {
  const dias = p.dias_restantes
  const vencido = dias < 0
  const hoje    = dias === 0
  const urgente = dias <= 3 && !vencido

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-secondary/60 transition-colors rounded-xl">
      <div className={cn(
        'w-1.5 h-8 rounded-full shrink-0',
        vencido ? 'bg-red-500' : urgente ? 'bg-amber-400' : 'bg-green-400',
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{p.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">
          {p.processo?.titulo ?? 'Sem processo'} · {formatDate(p.data_prazo)}
        </p>
      </div>
      <span className={cn(
        'text-xs font-bold px-2.5 py-1 rounded-full shrink-0',
        vencido ? 'bg-red-100 text-red-700'
          : hoje  ? 'bg-amber-100 text-amber-700'
          : urgente ? 'bg-orange-100 text-orange-700'
          : 'bg-green-100 text-green-700',
      )}>
        {vencido ? `${Math.abs(dias)}d atraso` : hoje ? 'Hoje' : `${dias}d`}
      </span>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: kpi, isLoading } = useKpiDashboard()
  const { data: dre = [] }       = useDreMensal(6)
  const { data: etapas = [] }    = useProcessosPorEtapa()
  // Todos os prazos pendentes (sem filtro de dias) para categorizar
  const { data: todosPrazos = [] } = usePrazos({ status: 'pendente' })
  const { data: inadimplentes = [] } = useLancamentos({ status: 'inadimplente' })

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full">
        <h1 className="sr-only">Dashboard</h1>
        <OmniSpinner size="sm" variant="dark" />
      </div>
    )
  }

  // Categorias de prazo
  const vencidos  = todosPrazos.filter(p => p.dias_restantes < 0)
  const hoje      = todosPrazos.filter(p => p.dias_restantes === 0)
  const semana    = todosPrazos.filter(p => p.dias_restantes > 0 && p.dias_restantes <= 7)
  const proximos  = todosPrazos.filter(p => p.dias_restantes > 7 && p.dias_restantes <= 30)

  const maxEtapa  = Math.max(...etapas.map(e => e.total_processos), 1)
  const pipelineTotal = etapas.reduce((s, e) => s + (e.total_processos * 1), 0)

  return (
    <div className="space-y-6 page-enter">
      <h1 className="sr-only">Dashboard</h1>
      <p className="text-xs text-muted-foreground -mb-1">Resumo e indicadores do escritório ativo</p>
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Receita do mês"    value={kpi?.receita_mes ?? 0}       icon={TrendingUp}    />
        <KpiCard label="Despesas"          value={kpi?.despesa_mes ?? 0}       icon={TrendingDown}  />
        <KpiCard label="Resultado"         value={kpi?.resultado_mes ?? 0}     icon={DollarSign}    />
        <KpiCard label="Inadimplência"     value={kpi?.inadimplencia_total ?? 0} icon={AlertCircle} alert />
        <KpiCard label="Processos ativos"  value={kpi?.processos_ativos ?? 0}  icon={Briefcase}     currency={false} />
        <KpiCard label="Prazos urgentes"   value={kpi?.prazos_urgentes ?? 0}   icon={AlertTriangle} currency={false} alert={!!kpi?.prazos_urgentes} />
      </div>

      {/* ── Central de Prazos ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Flag className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Central de Prazos</h2>
          </div>
          <Link href="/prazos" className="flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80">
            Ver todos <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Tabs por categoria */}
        <div className="grid grid-cols-4 border-b border-border">
          {[
            { label: 'Vencidos',    count: vencidos.length,  color: 'text-red-600',    bg: 'bg-red-50'    },
            { label: 'Hoje',        count: hoje.length,      color: 'text-amber-600',  bg: 'bg-amber-50'  },
            { label: 'Esta semana', count: semana.length,    color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Próximos 30d',count: proximos.length,  color: 'text-green-600',  bg: 'bg-green-50'  },
          ].map(cat => (
            <div key={cat.label} className="flex flex-col items-center py-3 border-r last:border-r-0 border-border">
              <span className={cn('text-xl font-bold', cat.color)}>{cat.count}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{cat.label}</span>
            </div>
          ))}
        </div>

        {/* Lista dos mais urgentes */}
        <div className="p-3 space-y-0.5">
          {[...vencidos, ...hoje, ...semana].slice(0, 6).map(p => (
            <PrazoRow key={p.id} p={p} />
          ))}
          {vencidos.length + hoje.length + semana.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum prazo urgente. Bom trabalho!
            </p>
          )}
        </div>
      </div>

      {/* ── Gráfico + Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DRE mensal */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Receitas vs Despesas</h2>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={dre} barGap={4}>
              <CartesianGrid vertical={false} stroke="hsl(240 8% 92%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(240 12% 48%)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(240 12% 48%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(240 8% 94%)' }} />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(145 65% 42%)" radius={[5,5,0,0]} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(0 72% 51%)"   radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline por etapa */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
            <span className="text-xs text-muted-foreground font-medium">
              {pipelineTotal} processos
            </span>
          </div>
          <div className="space-y-3">
            {etapas
              .filter(e => !e.etapa_nome?.toLowerCase().includes('arquivado'))
              .map(e => {
                const pct = Math.round((e.total_processos / maxEtapa) * 100)
                return (
                  <div key={e.etapa_id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: e.cor }} />
                        <span className="text-foreground font-medium truncate">{e.etapa_nome}</span>
                      </div>
                      <span className="font-bold text-foreground tabular-nums">{e.total_processos}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: e.cor }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* ── Inadimplência ── */}
      {inadimplentes.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Inadimplência</h2>
            </div>
            <Link href="/financeiro/lancamentos?status=inadimplente"
              className="flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80">
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {inadimplentes.slice(0, 4).map(l => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {(l as any).cliente?.nome ?? '—'} · venc. {formatDate(l.data_vencimento)}
                  </p>
                </div>
                <span className="text-sm font-bold text-red-600 ml-4 shrink-0">
                  {formatCurrency(l.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
