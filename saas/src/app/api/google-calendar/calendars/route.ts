import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarForTokens } from '@/lib/google-calendar/google'
import { getGoogleClientCredentials } from '@/lib/google-calendar/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          'Servidor sem SUPABASE_SERVICE_ROLE_KEY. Adiciona em Vercel → Settings → Environment Variables (a secret service_role do Supabase, não a anon).',
        calendars: [],
      },
      { status: 503 },
    )
  }

  const googleCreds = getGoogleClientCredentials()
  if (!googleCreds) {
    return NextResponse.json(
      {
        error:
          'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET em falta no servidor (Vercel → Environment Variables; mesmo que no .env.local).',
        calendars: [],
      },
      { status: 503 },
    )
  }

  const { data: row, error: re } = await supabase
    .from('user_google_calendar')
    .select('user_id, access_token, refresh_token, token_expires_at, default_calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (re) return NextResponse.json({ error: re.message }, { status: 500 })
  if (!row) {
    return NextResponse.json({ calendars: [] })
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json(
      {
        error: 'Não foi possível criar o cliente admin (confirma NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do mesmo projeto).',
        calendars: [],
      },
      { status: 503 },
    )
  }
  const cal = await getCalendarForTokens(row as any, admin)
  if (!cal) {
    return NextResponse.json(
      { error: 'Não foi possível falar com o Google Calendar (tokens ou OAuth). Tenta ligar de novo em Configurações.', calendars: [] },
      { status: 502 },
    )
  }

  const list = await cal.calendarList.list({ maxResults: 100 })
  const calendars = (list.data.items ?? [])
    .filter(Boolean)
    .map(c => ({
      id: c.id ?? '',
      summary: c.summary ?? c.id ?? 'Calendário',
      primary: c.primary === true,
      accessRole: c.accessRole ?? null,
    }))
    .filter(c => c.id)

  return NextResponse.json({ calendars })
}
