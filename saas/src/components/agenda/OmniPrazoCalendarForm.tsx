'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import { DEFAULT_OMNI_CALENDAR_NAME, GOOGLE_CALENDAR_LIST_COLORS } from '@/lib/google-calendar/omni-calendar-meta'
import { cn } from '@/lib/utils'

type CalRow = { id: string; summary: string; primary?: boolean; accessRole: string | null }

type Props = {
  calendars: CalRow[]
  defaultCalendarId: string
  /** Calendário dedicado a prazos (Google); quando definido, a sincronização usa-o. */
  omniSyncCalendarId: string | null
  omniSyncCalendarName: string | null
  omniSyncCalendarColorId: string | null
  onDefaultCalendarChange: (calendarId: string) => void
  onAfterChange: () => Promise<void>
  className?: string
}

export function OmniPrazoCalendarForm({
  calendars,
  defaultCalendarId,
  omniSyncCalendarId,
  omniSyncCalendarName,
  omniSyncCalendarColorId,
  onDefaultCalendarChange,
  onAfterChange,
  className,
}: Props) {
  const [name, setName] = useState(DEFAULT_OMNI_CALENDAR_NAME)
  const [colorId, setColorId] = useState('10')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (omniSyncCalendarName) {
      setName(omniSyncCalendarName)
    } else {
      setName(DEFAULT_OMNI_CALENDAR_NAME)
    }
    if (omniSyncCalendarColorId && GOOGLE_CALENDAR_LIST_COLORS.some(c => c.id === omniSyncCalendarColorId)) {
      setColorId(omniSyncCalendarColorId)
    }
  }, [omniSyncCalendarId, omniSyncCalendarName, omniSyncCalendarColorId])

  const submit = useCallback(async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/google-calendar/omni-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: omniSyncCalendarId ? 'update' : 'create',
          name: name.trim() || DEFAULT_OMNI_CALENDAR_NAME,
          colorId,
        }),
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        toast.error(j.error || 'Falha ao guardar o calendário')
        return
      }
      toast.success(omniSyncCalendarId ? 'Calendário atualizado' : 'Calendário criado no Google')
      await onAfterChange()
    } finally {
      setSaving(false)
    }
  }, [omniSyncCalendarId, name, colorId, onAfterChange])

  if (!calendars.length) {
    return null
  }

  return (
    <div
      className={cn(
        'mb-4 p-3 rounded-xl border border-border bg-card/50 space-y-3',
        className,
      )}
    >
      <p className="text-xs font-medium text-foreground">Calendário Google dos prazos Omni</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Cria um calendário só para os prazos (nome e cor editáveis no Google). Enquanto não existir, os prazos
        vão para o calendário que escolhe abaixo.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 min-w-0 w-full sm:min-w-[160px] sm:w-auto sm:flex-1">
          <span className="text-[10px] text-muted-foreground">Nome</span>
          <input
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white w-full min-w-0"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={200}
            placeholder={DEFAULT_OMNI_CALENDAR_NAME}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Cor (Google)</span>
          <select
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white"
            value={colorId}
            onChange={e => setColorId(e.target.value)}
          >
            {GOOGLE_CALENDAR_LIST_COLORS.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 h-7">
          {(() => {
            const c = GOOGLE_CALENDAR_LIST_COLORS.find(x => x.id === colorId)
            return c ? (
              <span
                className="inline-block h-6 w-6 rounded border border-border shrink-0"
                style={{ background: c.swatch }}
                title={c.label}
              />
            ) : null
          })()}
        </div>
        <Button type="button" size="sm" className="h-8" onClick={() => { void submit() }} disabled={saving}>
          {saving ? <OmniSpinner size="xs" variant="dark" /> : null}
          {omniSyncCalendarId ? 'Guardar nome e cor' : 'Criar calendário'}
        </Button>
      </div>

      {omniSyncCalendarId ? (
        <p className="text-[11px] text-muted-foreground">
          Os prazos sincronizam para o calendário <strong className="text-foreground/90">«{omniSyncCalendarName ?? name}»</strong> no
          Google. Pode alterar o nome e a cor acima; no Google, este calendário aparece em &quot;Outros calendários&quot; ou na lista
          com a cor escolhida.
        </p>
      ) : null}

      {!omniSyncCalendarId ? (
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-border/60">
          <span className="text-muted-foreground">Sincronizar prazos para (até criar o dedicado):</span>
          <select
            className="text-xs border border-border rounded-lg px-2 py-1 bg-white"
            value={defaultCalendarId}
            onChange={e => { onDefaultCalendarChange(e.target.value) }}
          >
            {calendars.map(c => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? ' (principal)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
