import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarForTokens } from '@/lib/google-calendar/google'
import { DEFAULT_OMNI_CALENDAR_NAME } from '@/lib/google-calendar/omni-calendar-meta'

export const dynamic = 'force-dynamic'

const TZ = 'America/Sao_Paulo'

const colorIdSchema = z.string().refine(
  s => ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].includes(s),
  { message: 'colorId 1-11' },
)

const postSchema = z.object({
  mode: z.enum(['create', 'update']),
  name: z.string().max(200).optional(),
  colorId: colorIdSchema,
})

type TokenRow = {
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  default_calendar_id: string | null
  omni_sync_calendar_id?: string | null
  visible_calendar_ids: string[] | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: z.infer<typeof postSchema>
  try {
    const raw = postSchema.parse(await request.json())
    const n = (raw.name?.trim() || DEFAULT_OMNI_CALENDAR_NAME) as string
    body = { ...raw, name: n }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues.map(x => x.message).join(' · ') || 'Pedido inválido' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { data: row, error: re } = await supabase
    .from('user_google_calendar')
    .select(
      'user_id, access_token, refresh_token, token_expires_at, default_calendar_id, omni_sync_calendar_id, visible_calendar_ids',
    )
    .eq('user_id', user.id)
    .maybeSingle()
  if (re || !row) {
    return NextResponse.json(
      { error: 'Ligue o Google Calendário antes de criar o calendário dos prazos' },
      { status: 400 },
    )
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role não configurada' }, { status: 500 })
  }

  const cal = await getCalendarForTokens(row as TokenRow, admin)
  if (!cal) {
    return NextResponse.json({ error: 'Não foi possível falar com o Google' }, { status: 500 })
  }

  if (body.mode === 'create') {
    if ((row as TokenRow).omni_sync_calendar_id) {
      return NextResponse.json(
        { error: 'Já existe um calendário Omni. Use "Guardar" para alterar o nome ou a cor.' },
        { status: 400 },
      )
    }
    const ins = await cal.calendars.insert({
      requestBody: { summary: body.name, timeZone: TZ },
    })
    const newId = ins.data.id
    if (!newId) {
      return NextResponse.json({ error: 'Falha ao criar o calendário no Google' }, { status: 500 })
    }

    try {
      await cal.calendarList.patch({
        calendarId: newId,
        requestBody: { colorId: body.colorId, selected: true },
      })
    } catch (e) {
      console.error('calendarList.patch (novo calendário)', e)
      return NextResponse.json(
        { error: 'Calendário criado, mas não foi possível definir a cor. Tente de novo em instantes.' },
        { status: 502 },
      )
    }

    const prev = ((row as TokenRow).visible_calendar_ids as string[] | null) ?? ['primary']
    const vis = Array.from(new Set([...prev, newId]))
    const { error: upe } = await supabase
      .from('user_google_calendar')
      .update({
        omni_sync_calendar_id: newId,
        omni_sync_calendar_name: body.name,
        omni_sync_calendar_color_id: body.colorId,
        default_calendar_id: newId,
        visible_calendar_ids: vis,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (upe) {
      return NextResponse.json({ error: upe.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, calendarId: newId })
  }

  const cid = (row as TokenRow).omni_sync_calendar_id
  if (!cid) {
    return NextResponse.json({ error: 'Ainda não existe calendário Omni. Use criar primeiro.' }, { status: 400 })
  }

  await cal.calendars.patch({
    calendarId: cid,
    requestBody: { summary: body.name, timeZone: TZ },
  })
  try {
    await cal.calendarList.patch({
      calendarId: cid,
      requestBody: { colorId: body.colorId },
    })
  } catch (e) {
    console.error('calendarList.patch (atualizar)', e)
    return NextResponse.json(
      { error: 'Não foi possível atualizar a cor no Google. O nome pode ter sido guardado.' },
      { status: 502 },
    )
  }

  const { error: up2 } = await supabase
    .from('user_google_calendar')
    .update({
      omni_sync_calendar_name: body.name,
      omni_sync_calendar_color_id: body.colorId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
  if (up2) {
    return NextResponse.json({ error: up2.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, calendarId: cid })
}
