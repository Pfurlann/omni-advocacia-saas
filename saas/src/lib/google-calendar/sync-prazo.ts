import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prazo } from '@/types/database'
import { appOriginFromRequest } from '@/lib/requests'
import { prazoToGoogleEventBody } from './prazo-to-event'
import { getCalendarForTokens, getDefaultTargetCalendarId } from './google'

const TERMINAIS: Prazo['status'][] = ['concluido', 'cancelado', 'perdido']

type Row = {
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  default_calendar_id: string | null
  omni_sync_calendar_id?: string | null
}

/**
 * Sincroniza prazo com o calendário Google do **responsável** (dono dos tokens).
 */
export async function syncPrazoForResponsavel(options: {
  prazo: Prazo & { processo?: { titulo?: string; numero_processo?: string } | null }
  tokenRow: Row | null
  supabaseAdmin: SupabaseClient
  supabaseUser: SupabaseClient
  req: Request
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const { prazo, tokenRow, supabaseAdmin, supabaseUser, req } = options

  if (!tokenRow) {
    return { ok: true, skipped: 'responsavel_sem_google' }
  }

  const cal = await getCalendarForTokens(tokenRow, supabaseAdmin)
  if (!cal) {
    return { ok: false, error: 'google_nao_configurado_servidor' }
  }

  const calendarId = getDefaultTargetCalendarId(tokenRow)
  const origin = appOriginFromRequest(req)

  if (TERMINAIS.includes(prazo.status)) {
    if (prazo.google_event_id && (prazo.google_calendar_id || calendarId)) {
      const cid = prazo.google_calendar_id || calendarId
      try {
        await cal.events.delete({ calendarId: cid, eventId: prazo.google_event_id })
      } catch (e) {
        console.error('google events.delete', e)
      }
    }
    const { error: up } = await supabaseUser
      .from('prazos')
      .update({ google_event_id: null, google_calendar_id: null, google_synced_at: new Date().toISOString() })
      .eq('id', prazo.id)
    if (up) return { ok: false, error: up.message }
    return { ok: true }
  }

  const body = prazoToGoogleEventBody(prazo, origin)

  try {
    if (prazo.google_event_id) {
      const cid = prazo.google_calendar_id || calendarId
      await cal.events.patch({
        calendarId: cid,
        eventId: prazo.google_event_id,
        requestBody: body,
      })
      const { error: u } = await supabaseUser
        .from('prazos')
        .update({ google_synced_at: new Date().toISOString() })
        .eq('id', prazo.id)
      if (u) return { ok: false, error: u.message }
      return { ok: true }
    }

    const ins = await cal.events.insert({
      calendarId,
      requestBody: body,
    })
    const created = ins.data

    if (!created?.id) return { ok: false, error: 'google_sem_event_id' }

    const { error: u2 } = await supabaseUser
      .from('prazos')
      .update({
        google_event_id: created.id,
        google_calendar_id: calendarId,
        google_synced_at: new Date().toISOString(),
      })
      .eq('id', prazo.id)
    if (u2) return { ok: false, error: u2.message }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'google_error'
    console.error('syncPrazoForResponsavel', e)
    return { ok: false, error: msg }
  }
}
