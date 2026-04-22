'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEscritorio, useSetEscritorioAtivo } from '@/hooks/useEscritorio'
import { useMeusEscritorios } from '@/hooks/useMeusEscritorios'
import { useProfile } from '@/hooks/useProfile'
import { toast } from 'sonner'
import { LogOut, Settings, ChevronDown, Building2, Menu } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSidebarNav } from '@/contexts/SidebarNavContext'

const DIAS_PT  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_PT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']

function DataHoje() {
  const d   = new Date()
  const dia = DIAS_PT[d.getDay()]
  const mes = MESES_PT[d.getMonth()]
  return (
    <span className="text-xs font-medium text-muted-foreground select-none tabular-nums">
      {dia} {d.getDate()} de {mes}
    </span>
  )
}

export function Header() {
  const router   = useRouter()
  const { data: escritorio } = useEscritorio()
  const { data: listaEsc = [] } = useMeusEscritorios()
  const { data: profile } = useProfile()
  const setAtivo = useSetEscritorioAtivo()
  const [open, setOpen] = useState(false)
  const { expanded: navExpanded, toggle: toggleNav } = useSidebarNav()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Até logo!')
    router.push('/login')
    router.refresh()
  }

  const escInitials = (escritorio?.nome ?? 'ES')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const meInitials = (() => {
    const n = profile?.full_name?.trim() || 'U'
    const p = n.split(/\s+/).filter(Boolean)
    if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase()
    return n.slice(0, 2).toUpperCase()
  })()

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* ── Esquerda: toggle sidebar + data + OAB ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleNav}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label={navExpanded ? 'Recolher menu' : 'Expandir menu lateral'}
          aria-expanded={navExpanded}
        >
          <Menu className="h-4 w-4" />
        </button>

        <DataHoje />

        {escritorio?.oab && (
          <>
            <span className="text-border shrink-0 select-none">·</span>
            <span className="text-xs text-muted-foreground font-medium truncate">
              OAB {escritorio.oab}
            </span>
          </>
        )}
      </div>

      {/* ── Direita: switcher, nome do escritório, avatar ── */}
      <div className="flex items-center gap-2">
        {listaEsc.length > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 pr-1 border-r border-border mr-1">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              className="text-xs font-medium text-foreground bg-transparent border-0 max-w-[160px] cursor-pointer focus:ring-0 focus:outline-none"
              value={escritorio?.id ?? ''}
              onChange={e => { void setAtivo.mutateAsync(e.target.value) }}
              disabled={setAtivo.isPending}
              title="Trocar escritório"
            >
              {listaEsc.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}

        {escritorio && (
          <div className="hidden md:flex items-center gap-2 max-w-[200px] min-w-0 pr-1">
            {escritorio.logo_url ? (
              <img
                src={escritorio.logo_url}
                alt=""
                className="h-7 w-7 rounded-lg object-contain border border-border bg-white shrink-0"
              />
            ) : null}
            <span className="text-xs font-semibold text-foreground truncate">{escritorio.nome}</span>
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-7 h-7 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {meInitials}
              </div>
            )}
            <span className="text-sm text-foreground font-medium max-w-[100px] truncate hidden sm:block">
              {profile?.full_name?.trim() || 'Conta'}
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0',
                open && 'rotate-180',
              )}
            />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-20 py-1.5 overflow-hidden">
                <div className="px-3 py-2 mb-1 border-b border-border flex items-start gap-2">
                  {escritorio?.logo_url ? (
                    <img
                      src={escritorio.logo_url}
                      alt=""
                      className="h-8 w-8 rounded-md object-contain border border-border bg-white shrink-0"
                    />
                  ) : (
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: 'hsl(var(--primary))' }}
                    >
                      {escInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{escritorio?.nome}</p>
                    {escritorio?.email && (
                      <p className="text-[11px] text-muted-foreground truncate">{escritorio.email}</p>
                    )}
                  </div>
                </div>

                {listaEsc.length > 1 && (
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-1.5">Escritório ativo</p>
                    <select
                      className="w-full text-sm border border-border rounded-lg px-2 py-1.5 bg-white"
                      value={escritorio?.id ?? ''}
                      onChange={e => { void setAtivo.mutateAsync(e.target.value) }}
                      disabled={setAtivo.isPending}
                    >
                      {listaEsc.map(e => (
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { router.push('/configuracoes'); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Configurações
                </button>

                <div className="border-t border-border my-1" />

                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
