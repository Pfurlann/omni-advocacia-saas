import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { syncPrazoForResponsavel } from '@/lib/google-calendar/sync-prazo'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ prazoId: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let prazoId: string
  try {
    const json = await request.json()
    prazoId = bodySchema.parse(json).prazoId
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { data: prazo, error: pe } = await supabase
    .from('prazos')
    .select('*, processo:processos(titulo,numero_processo)')
    .eq('id', prazoId)
    .maybeSingle()
  if (pe || !prazo) {
    return NextResponse.json({ error: 'Prazo não encontrado' }, { status: 404 })
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase service role não configurada' }, { status: 500 })
  }

  const { data: tokenRow, error: te } = await admin
    .from('user_google_calendar')
    .select(
      'user_id, access_token, refresh_token, token_expires_at, default_calendar_id, omni_sync_calendar_id',
    )
    .eq('user_id', prazo.responsavel_id)
    .maybeSingle()
  if (te) {
    return NextResponse.json({ error: te.message }, { status: 500 })
  }

  const result = await syncPrazoForResponsavel({
    prazo: prazo as any,
    tokenRow: tokenRow as any,
    supabaseAdmin: admin,
    supabaseUser: supabase,
    req: request,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Falha na sincronização' }, { status: 500 })
  }
  return NextResponse.json({ ...result, prazoId })
}
