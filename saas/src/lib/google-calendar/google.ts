import { google, type calendar_v3 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGoogleClientCredentials } from './config'

type TokenRow = {
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  default_calendar_id: string | null
  /** Calendário dedicado aos prazos Omni (criado pela API) */
  omni_sync_calendar_id?: string | null
}

function buildOAuth2() {
  const creds = getGoogleClientCredentials()
  if (!creds) return null
  return new google.auth.OAuth2(creds.id, creds.secret)
}

/**
 * Cria `calendar` API com tokens; persiste access_token renovado quando muda.
 */
export async function getCalendarForTokens(
  row: TokenRow,
  supabaseAdmin: SupabaseClient,
): Promise<calendar_v3.Calendar | null> {
  const oauth2 = buildOAuth2()
  if (!oauth2) return null

  oauth2.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: new Date(row.token_expires_at).getTime(),
  })

  const persistIfChanged = (tokens: { access_token?: string | null; expiry_date?: number | null; refresh_token?: string | null }) => {
    if (!tokens.access_token && !tokens.expiry_date) return
    const next: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (tokens.access_token) next.access_token = tokens.access_token
    if (tokens.expiry_date) next.token_expires_at = new Date(tokens.expiry_date).toISOString()
    if (tokens.refresh_token) next.refresh_token = tokens.refresh_token
    void supabaseAdmin.from('user_google_calendar').update(next).eq('user_id', row.user_id)
  }

  oauth2.on('tokens', t => {
    if (t.access_token || t.expiry_date) persistIfChanged(t)
  })

  // Força refresh se em princípio expirou (margem 60s)
  const exp = new Date(row.token_expires_at).getTime()
  if (Date.now() > exp - 60_000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken()
      persistIfChanged({
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date ?? null,
        refresh_token: credentials.refresh_token,
      })
    } catch (e) {
      console.error('google refreshAccessToken', e)
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2 })
}

/** Calendário onde entram eventos de prazos: dedicado Omni > preferência geral > primary */
export function getDefaultTargetCalendarId(row: TokenRow): string {
  return (
    row.omni_sync_calendar_id?.trim()
    || row.default_calendar_id?.trim()
    || 'primary'
  )
}
