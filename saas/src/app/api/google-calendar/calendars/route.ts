import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarForTokens } from '@/lib/google-calendar/google'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
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
    return NextResponse.json({ error: 'Service role' }, { status: 500 })
  }
  const cal = await getCalendarForTokens(row as any, admin)
  if (!cal) {
    return NextResponse.json({ error: 'Google não disponível' }, { status: 500 })
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
