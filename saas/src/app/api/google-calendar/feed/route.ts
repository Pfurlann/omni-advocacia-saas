import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarForTokens } from '@/lib/google-calendar/google'
import { appOriginFromRequest } from '@/lib/requests'

export const dynamic = 'force-dynamic'

/**
 * Prazos Omni + eventos Google — todas as queries rodando em paralelo.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const u = new URL(request.url)
  const from = u.searchParams.get('from')?.slice(0, 10)
  const to   = u.searchParams.get('to')?.slice(0, 10)
  if (!from || !to) {
    return NextResponse.json({ error: 'Use ?from=YYYY-MM-DD&to=YYYY-MM-DD' }, { status: 400 })
  }

  // ── 1. Buscar prefs e prazos em paralelo ─────────────────────────────────
  const [prefsResult, prazosResult] = await Promise.all([
    supabase
      .from('user_google_calendar')
      .select('user_id, access_token, refresh_token, token_expires_at, default_calendar_id, visible_calendar_ids, show_omni_layer')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('prazos')
      .select('id, titulo, tipo, data_prazo, hora_prazo, status, processo_id, responsavel_id, processo:processos(titulo,numero_processo,cliente:clientes(nome))')
      .in('status', ['pendente'])
      .gte('data_prazo', from)
      .lte('data_prazo', to)
      .order('data_prazo'),
  ])

  const prefs = prefsResult.data
  const showOmni = prefs?.show_omni_layer !== false

  if (prazosResult.error) {
    return NextResponse.json({ error: prazosResult.error.message }, { status: 500 })
  }
  const prazosRaw = prazosResult.data ?? []

  // ── 2. Buscar nomes dos responsáveis (se necessário) ─────────────────────
  let nomePor = new Map<string, string | null>()
  if (showOmni && prazosRaw.length) {
    const respIds = [...new Set(
      (prazosRaw as Array<{ responsavel_id: string }>)
        .map(p => p.responsavel_id)
        .filter(Boolean),
    )]
    if (respIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', respIds)
      nomePor = new Map((profs ?? []).map(r => [r.id as string, (r.full_name as string | null) ?? null]))
    }
  }

  // ── 3. Mapear prazos Omni ─────────────────────────────────────────────────
  const base = appOriginFromRequest(request)
  const omni: unknown[] = showOmni ? prazosRaw.map(p => {
    const proc = (p as { processo?: unknown }).processo
    const processo = Array.isArray(proc) ? proc[0] : proc
    const po  = processo as { titulo?: string; cliente?: { nome?: string } | { nome?: string }[] } | null | undefined
    const cli = po?.cliente
    const clienteRow = Array.isArray(cli) ? cli[0] : cli
    const clienteNome = clienteRow?.nome?.trim() ? clienteRow.nome.trim() : null
    const rid = (p as { responsavel_id: string }).responsavel_id
    return {
      id: p.id,
      source: 'omni' as const,
      titulo: p.titulo,
      tipo: p.tipo,
      dataPrazo: p.data_prazo,
      horaPrazo: p.hora_prazo,
      processoId: p.processo_id,
      processoTitulo: po?.titulo?.trim() ? po.titulo.trim() : null,
      clienteNome,
      processoUrl: p.processo_id ? `${base}/processos/${p.processo_id}` : null,
      responsavelId: rid,
      responsavelNome: nomePor.get(rid) ?? null,
    }
  }) : []

  // ── 4. Buscar Google Calendar — todos os calendários em paralelo ──────────
  type CalBlock = {
    calendarId: string
    events: Array<{
      id: string
      summary: string | null
      start: { date?: string; dateTime?: string }
      end: { date?: string; dateTime?: string }
      htmlLink: string | null
      allDay: boolean
    }>
  }

  let google: CalBlock[] = []

  if (prefs) {
    const admin = createSupabaseAdmin()
    if (admin) {
      const cal = await getCalendarForTokens(prefs as any, admin)
      if (cal) {
        const visible = (prefs.visible_calendar_ids as string[] | null)?.length
          ? prefs.visible_calendar_ids as string[]
          : ['primary']

        const t0 = new Date(from + 'T00:00:00.000Z')
        t0.setUTCDate(t0.getUTCDate() - 1)
        const t1 = new Date(to + 'T23:59:59.999Z')
        t1.setUTCDate(t1.getUTCDate() + 1)
        const timeMin = t0.toISOString()
        const timeMax = t1.toISOString()

        // Promise.all — todos os calendários buscados simultaneamente
        const results = await Promise.allSettled(
          visible.filter(Boolean).map(async calId => {
            const res = await cal.events.list({
              calendarId: calId,
              timeMin,
              timeMax,
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 500,
            })
            const events = (res.data.items ?? []).map(ev => {
              const fs = ev.start
              const fe = ev.end
              return {
                id: ev.id ?? '',
                summary: ev.summary ?? '(Sem título)',
                start: { date: fs?.date ?? undefined, dateTime: fs?.dateTime ?? undefined },
                end:   { date: fe?.date ?? undefined, dateTime: fe?.dateTime ?? undefined },
                htmlLink: ev.htmlLink ?? null,
                allDay: Boolean(fs?.date),
              }
            })
            return { calendarId: calId, events: events.filter(e => e.id) } as CalBlock
          }),
        )

        google = results
          .filter((r): r is PromiseFulfilledResult<CalBlock> => r.status === 'fulfilled')
          .map(r => r.value)
      }
    }
  }

  return NextResponse.json({
    from, to, omni, google,
    connected: Boolean(prefs),
  })
}
