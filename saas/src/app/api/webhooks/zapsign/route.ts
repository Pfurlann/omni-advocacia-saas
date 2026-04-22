import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Webhook ZapSign — configure na conta ZapSign apontando para esta URL + query ?token=ZAPSIGN_WEBHOOK_SECRET
 * Documentação: https://docs.zapsign.com.br/webhooks
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('token')
  const expected = process.env.ZAPSIGN_WEBHOOK_SECRET?.trim()
  if (expected && q !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!expected) {
    return NextResponse.json({ error: 'Configure ZAPSIGN_WEBHOOK_SECRET' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const doc = (body.document as Record<string, unknown> | undefined) ?? body
  const token = String(doc.token ?? body.token ?? '')
  const status = String(doc.status ?? body.status ?? '')
  const signedFile = doc.signed_file != null ? String(doc.signed_file) : null

  if (!token) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Servidor sem service role' }, { status: 503 })
  }

  const mapped =
    status.toLowerCase().includes('signed') || signedFile
      ? 'signed'
      : status || 'updated'

  await admin
    .from('documentos')
    .update({
      assinatura_status: mapped,
      assinatura_atualizado_em: new Date().toISOString(),
    })
    .eq('assinatura_ref', token)
    .eq('assinatura_provedor', 'zapsign')

  return NextResponse.json({ ok: true })
}
