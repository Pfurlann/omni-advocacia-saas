'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePrazosUrgentes } from '@/hooks/usePrazos'
import { useEscritorio } from '@/hooks/useEscritorio'
import { OmniLogo } from '@/components/brand/OmniLogo'
import {
  LayoutDashboard, Kanban, FileText, Calendar,
  Users, DollarSign, Settings, CalendarDays,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/kanban',        label: 'Kanban',         icon: Kanban },
  { href: '/processos',     label: 'Processos',      icon: FileText },
  { href: '/agenda',        label: 'Agenda',         icon: CalendarDays },
  { href: '/prazos',        label: 'Prazos',         icon: Calendar,  badge: true },
  { href: '/clientes',      label: 'Clientes',       icon: Users },
  { href: '/financeiro',    label: 'Financeiro',     icon: DollarSign },
]

const navBottom = [
  { href: '/configuracoes', label: 'Configurações',  icon: Settings },
]

type Props = { compact?: boolean }

export function Sidebar({ compact = false }: Props) {
  const pathname  = usePathname()
  const { data: prazos } = usePrazosUrgentes()
  const { data: escritorio } = useEscritorio()
  const urgentes  = prazos?.filter(p => p.dias_restantes <= 3).length ?? 0

  return (
    <aside
      className={cn(
        'h-full w-full min-h-0 flex flex-col sidebar-scroll overflow-y-auto overflow-x-hidden',
        'bg-[hsl(var(--sidebar-bg))] shadow-[2px_0_12px_rgba(0,0,0,0.04)]',
      )}
    >
      <div
        className={cn(
          'border-b',
          'border-white/[0.08]',
          compact ? 'px-2 py-3 flex justify-center' : 'px-4 py-4 space-y-2',
        )}
      >
        {compact ? (
          <div className="flex justify-center" title="Omni">
            <OmniLogo variant="dark" size="sm" markOnly className="scale-95" />
          </div>
        ) : (
          <>
            <OmniLogo variant="dark" size="sm" />
            {escritorio?.logo_url && (
              <div className="pl-0.5 pt-0.5">
                <img
                  src={escritorio.logo_url}
                  alt=""
                  className="h-8 w-auto max-w-[150px] object-contain opacity-90"
                />
              </div>
            )}
          </>
        )}
      </div>

      <nav className={cn('flex-1 py-2', compact ? 'px-1.5 space-y-1' : 'px-2 space-y-0.5')}>
        <NavSection items={nav} pathname={pathname} urgentes={urgentes} compact={compact} />
      </nav>

      <div className="mx-2 my-1 h-px bg-white/[0.08] shrink-0" />

      <nav className={cn('pb-2', compact ? 'px-1.5 space-y-1' : 'px-2 space-y-0.5')}>
        <NavSection items={navBottom} pathname={pathname} urgentes={0} compact={compact} />
      </nav>

      {!compact && (
        <p
          className="text-center pb-3 pt-1 text-[10px] font-medium tabular-nums opacity-40"
          style={{ color: 'hsl(var(--sidebar-text))' }}
        >
          v1.0
        </p>
      )}
    </aside>
  )
}

function NavSection({
  items, pathname, urgentes, compact,
}: {
  items: typeof nav
  pathname: string
  urgentes: number
  compact: boolean
}) {
  return (
    <>
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const count  = badge ? urgentes : 0

        return (
          <Link
            key={href}
            href={href}
            title={compact ? label : undefined}
            className={cn(
              'relative flex items-center rounded-lg font-medium transition-colors duration-150',
              'outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
              compact
                ? 'justify-center p-0 h-10 w-10 mx-auto'
                : 'gap-2.5 px-2.5 py-2 text-[13px] leading-tight',
              active
                ? 'text-white bg-white/[0.09] shadow-sm'
                : 'text-[hsl(var(--sidebar-text))] hover:text-white/95 hover:bg-white/[0.05]',
            )}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                style={{ background: 'hsl(var(--primary))' }}
              />
            )}

            <span className="relative flex items-center justify-center shrink-0">
              <Icon
                className={cn('shrink-0 transition-colors', compact ? 'h-[1.15rem] w-[1.15rem]' : 'h-4 w-4')}
                style={active ? { color: 'hsl(var(--primary))' } : undefined}
                strokeWidth={2}
              />
              {compact && count > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-0.5 rounded-full text-[7px] font-bold leading-4 text-center text-white"
                  style={{ background: 'hsl(var(--destructive))' }}
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>

            {!compact && (
              <>
                <span className="flex-1 min-w-0">{label}</span>
                {count > 0 && (
                  <span
                    className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'hsl(var(--destructive))' }}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </>
            )}
          </Link>
        )
      })}
    </>
  )
}
