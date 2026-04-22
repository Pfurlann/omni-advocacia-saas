'use client'

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui'
import { Link2, Unlink } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import { OmniPrazoCalendarForm } from '@/components/agenda/OmniPrazoCalendarForm'

type CalRow = { id: string; summary: string; primary?: boolean; accessRole: string | null }

type St = {
  defaultCalendarId?: string
  omniSyncCalendarId?: string | null
  omniSyncCalendarName?: string | null
  omniSyncCalendarColorId?: string | null
  visibleCalendarIds?: string[]
  showOmniLayer?: boolean
}

export function GoogleCalendarioSettings() {
  const qc = useQueryClient()
  const sp = useSearchParams()
  const { data: st } = useQuery({
    queryKey: ['googleCalStatus'],
    queryFn: async () => {
      const r = await fetch('/api/google-calendar/status', { credentials: 'include' })
      if (r.status === 401) return { connected: false as const }
      if (!r.ok) return { connected: false as const, err: true as const }
      return r.json() as Promise<{
        connected: boolean
        visibleCalendarIds?: string[]
        defaultCalendarId?: string
        omniSyncCalendarId?: string | null
        omniSyncCalendarName?: string | null
        omniSyncCalendarColorId?: string | null
        showOmniLayer?: boolean
      }>
    },
  })

  const stNorm = st && st.connected && !('err' in st && st.err) ? (st as St & { connected: true }) : null

  const { data: cals } = useQuery({
    queryKey: ['googleCalList'],
    queryFn: async () => {
      const r = await fetch('/api/google-calendar/calendars', { credentials: 'include' })
      if (!r.ok) return { calendars: [] as CalRow[] }
      return r.json() as Promise<{ calendars: CalRow[] }>
    },
    enabled: Boolean(stNorm),
  })

  const savePreferences = useCallback(
    async (body: { showOmniLayer?: boolean; visibleCalendarIds?: string[]; defaultCalendarId?: string }) => {
      const r = await fetch('/api/google-calendar/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      if (!r.ok) {
        const t = await r.text()
        toast.error(t || 'Falha ao guardar')
        return
      }
      await qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      await qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
    },
    [qc],
  )

  const connectGoogle = () => {
    window.location.href = '/api/google-calendar/auth'
  }

  const disconnect = async () => {
    if (!window.confirm('Desligar o Google? Os prazos deixam de sincronizar com a tua agenda.')) return
    const r = await fetch('/api/google-calendar/disconnect', { method: 'POST', credentials: 'include' })
    if (r.ok) {
      toast.success('Google desligado')
      await qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      await qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
      await qc.invalidateQueries({ queryKey: ['googleCalList'] })
    } else {
      toast.error('Erro ao desligar')
    }
  }

  const onAfterOmniCalendarChange = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['agendaFeed'] })
    await qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
    await qc.invalidateQueries({ queryKey: ['googleCalList'] })
  }, [qc])

  const googleParam = sp.get('google')
  useEffect(() => {
    if (googleParam === 'ok') {
      toast.success('Google Calendário ligado')
      void qc.invalidateQueries({ queryKey: ['agendaFeed'] })
      void qc.invalidateQueries({ queryKey: ['googleCalStatus'] })
      void qc.invalidateQueries({ queryKey: ['googleCalList'] })
      window.history.replaceState({}, '', '/configuracoes?tab=integracoes')
    }
    if (googleParam && googleParam !== 'ok') {
      toast.error('Não foi possível ligar o Google: ' + googleParam)
      window.history.replaceState({}, '', '/configuracoes?tab=integracoes')
    }
  }, [googleParam, qc])

  const vis = stNorm?.visibleCalendarIds ?? ['primary']

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Liga a tua conta Google para misturar os teus calendários na <strong>Agenda</strong> e para sincronizar prazos Omni no calendário que
        escolheres (incluindo calendário dedicado criado abaixo).
      </p>

      {!stNorm && (
        <div className="omni-card omni-card-body">
          <h3 className="text-sm font-semibold text-foreground mb-2">Ligação Google</h3>
          <p className="text-xs text-muted-foreground mb-4">Ainda não conectada.</p>
          <Button type="button" onClick={connectGoogle}>
            <Link2 className="h-3.5 w-3.5" /> Ligar Google Calendário
          </Button>
        </div>
      )}

      {stNorm && (
        <div className="omni-card omni-card-body space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Calendários visíveis na Agenda</h3>
            <Button
              type="button"
              variant="secondary"
              className="text-destructive h-8 text-xs"
              onClick={() => { void disconnect() }}
            >
              <Unlink className="h-3 w-3" /> Desligar Google
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Marca quais calendários aparecem na vista unificada da Agenda.</p>
          <ul className="space-y-2 max-w-md">
            {cals?.calendars?.map(cal => {
              const on = vis.includes(cal.id)
              return (
                <li key={cal.id}>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-border"
                      checked={on}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...vis.filter((id: string) => id !== cal.id), cal.id]
                          : vis.filter((id: string) => id !== cal.id)
                        if (next.length === 0) {
                          toast.message('Mantém pelo menos um calendário visível')
                          return
                        }
                        void savePreferences({ visibleCalendarIds: next })
                      }}
                    />
                    <span>
                      {cal.summary}
                      {cal.primary ? <span className="text-xs text-muted-foreground"> (principal)</span> : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {stNorm && cals && !cals.calendars?.length && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <OmniSpinner size="xs" variant="dark" /> A carregar calendários…
            </div>
          )}

          {cals && cals.calendars && cals.calendars.length > 0 && stNorm && (
            <div className="pt-2 border-t border-border">
              <h4 className="text-sm font-medium text-foreground mb-1">Onde sincronizar prazos (Google)</h4>
              <p className="text-xs text-muted-foreground mb-3">Cria um calendário só para prazos ou escolhe um existente.</p>
              <OmniPrazoCalendarForm
                calendars={cals.calendars}
                defaultCalendarId={stNorm.defaultCalendarId ?? 'primary'}
                omniSyncCalendarId={stNorm.omniSyncCalendarId ?? null}
                omniSyncCalendarName={stNorm.omniSyncCalendarName ?? null}
                omniSyncCalendarColorId={stNorm.omniSyncCalendarColorId ?? null}
                onDefaultCalendarChange={v => { void savePreferences({ defaultCalendarId: v }) }}
                onAfterChange={onAfterOmniCalendarChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
