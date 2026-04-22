import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  defaultCalendarId: z.string().min(1).optional(),
  visibleCalendarIds: z.array(z.string()).optional(),
  showOmniLayer: z.boolean().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.defaultCalendarId !== undefined) row.default_calendar_id = body.defaultCalendarId
  if (body.visibleCalendarIds !== undefined) row.visible_calendar_ids = body.visibleCalendarIds
  if (body.showOmniLayer !== undefined) row.show_omni_layer = body.showOmniLayer

  const { data: ok, error } = await supabase
    .from('user_google_calendar')
    .update(row)
    .eq('user_id', user.id)
    .select('user_id')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!ok) {
    return NextResponse.json({ error: 'Ligue o Google Calendário antes de definir preferências' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
