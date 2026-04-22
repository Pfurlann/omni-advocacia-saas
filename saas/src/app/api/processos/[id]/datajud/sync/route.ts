import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { searchProcessoNoTribunal } from '@/lib/datajud/fetch'
import { normalizeNumeroCnj, countCnjDigits } from '@/lib/datajud/normalize'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: processoId } = await ctx.params
  const apiKey = process.env.DATAJUD_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'Configure DATAJUD_API_KEY no servidor (.env.local). Chave pública em https://datajud-wiki.cnj.jus.br/api-publica/acesso/' },
      { status: 503 }
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {
            /* route handler */
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: processo, error: pe } = await supabase
    .from('processos')
    .select('id, escritorio_id, numero_processo, datajud_tribunal_sigla')
    .eq('id', processoId)
    .single()

  if (pe || !processo) {
    return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
  }

  const n = countCnjDigits(processo.numero_processo)
  const cnj = normalizeNumeroCnj(processo.numero_processo)
  if (!cnj) {
    const hint =
      n === 0
        ? 'Cadastre o número do processo no padrão CNJ.'
        : `O número tem ${n} dígitos; o CNJ exige exatamente 20. Confira se não faltou o último dígito.`
    await supabase.from('processos').update({ datajud_sync_error: hint }).eq('id', processoId)
    return NextResponse.json({ error: hint }, { status: 400 })
  }

  const sigla = processo.datajud_tribunal_sigla?.trim().toLowerCase()
  if (!sigla) {
    return NextResponse.json(
      { error: 'Selecione o tribunal DataJud nas informações do processo antes de sincronizar.' },
      { status: 400 }
    )
  }

  const result = await searchProcessoNoTribunal({
    tribunalSigla: sigla,
    numeroCnj20: cnj,
    apiKey,
  })

  if (result.raw_error && !result.encontrado) {
    await supabase.from('processos').update({ datajud_sync_error: result.raw_error }).eq('id', processoId)
    return NextResponse.json({ error: result.raw_error }, { status: 502 })
  }

  if (!result.encontrado) {
    await supabase
      .from('processos')
      .update({
        datajud_sync_error: 'Não encontrado no DataJud para este tribunal.',
      })
      .eq('id', processoId)
    return NextResponse.json(
      {
        error:
          'Processo não encontrado neste tribunal no DataJud. Confira o tribunal (ex.: TRT2 para processo trabalhista em SP capital) e o número.',
      },
      { status: 404 }
    )
  }

  const { error: delErr } = await supabase.from('datajud_movimentacoes').delete().eq('processo_id', processoId)
  if (delErr) {
    await supabase.from('processos').update({ datajud_sync_error: delErr.message }).eq('id', processoId)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (result.movimentos.length > 0) {
    const rows = result.movimentos.map(m => ({
      escritorio_id: processo.escritorio_id,
      processo_id: processoId,
      ocorrido_em: m.ocorrido_em,
      codigo: m.codigo || null,
      nome: m.nome,
      complemento: m.complemento,
      id_externo: m.id_externo,
    }))
    const { error: insErr } = await supabase.from('datajud_movimentacoes').insert(rows)
    if (insErr) {
      await supabase.from('processos').update({ datajud_sync_error: insErr.message }).eq('id', processoId)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  await supabase
    .from('processos')
    .update({
      datajud_synced_at: new Date().toISOString(),
      datajud_sync_error: null,
    })
    .eq('id', processoId)

  return NextResponse.json({ ok: true, total: result.movimentos.length, tribunal: result.tribunal })
}
