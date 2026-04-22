import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { criarDocumentoZapSign } from '@/lib/zapsign/create-doc'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  signatario_nome: z.string().min(2),
  signatario_email: z.string().email(),
  signatario_telefone: z.string().optional(),
})

function telefoneParaSignerParts(raw?: string): { phone_country?: string; phone_number?: string } {
  const d = raw?.replace(/\D/g, '') ?? ''
  if (d.length < 10) return {}
  const national = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
  return { phone_country: '55', phone_number: national }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: documentoId } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { data: doc, error: de } = await supabase.from('documentos').select('*').eq('id', documentoId).single()
  if (de || !doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  }

  const mime = (doc.mime_type ?? '').toLowerCase()
  if (!mime.includes('pdf')) {
    return NextResponse.json({ error: 'Apenas arquivos PDF podem ir para assinatura ZapSign.' }, { status: 400 })
  }

  const maxBytes = 10 * 1024 * 1024
  if (doc.tamanho_bytes != null && doc.tamanho_bytes > maxBytes) {
    return NextResponse.json({ error: 'PDF acima de 10 MB (limite ZapSign).' }, { status: 400 })
  }

  const { data: blob, error: be } = await supabase.storage.from('documentos').download(doc.storage_path)
  if (be || !blob) {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo no storage.' }, { status: 500 })
  }

  const ab = await blob.arrayBuffer()
  const b64 = Buffer.from(ab).toString('base64')

  const phone = telefoneParaSignerParts(body.signatario_telefone)

  const result = await criarDocumentoZapSign({
    name: doc.nome.slice(0, 240),
    base64Pdf: b64,
    externalId: doc.id,
    signers: [
      {
        name: body.signatario_nome,
        email: body.signatario_email,
        phone_country: phone.phone_country,
        phone_number: phone.phone_number,
      },
    ],
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  const { error: ue } = await supabase
    .from('documentos')
    .update({
      assinatura_provedor: 'zapsign',
      assinatura_ref: result.token,
      assinatura_status: result.status,
      assinatura_link: result.signUrl,
      assinatura_atualizado_em: new Date().toISOString(),
    })
    .eq('id', documentoId)

  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    token: result.token,
    sign_url: result.signUrl,
  })
}
