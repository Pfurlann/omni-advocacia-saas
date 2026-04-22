import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { diffDiasCivis, hojeIsoEmBrasil } from '@/lib/datetime/brazil'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { enviarEmailLembretesPrazos } from '@/lib/email/lembretes-prazos'
import { textoLembretePrazosWhatsapp } from '@/lib/notifications/texto-lembrete-prazos'
import { enviarTextoZApi, telefoneParaZApi } from '@/lib/whatsapp/zapi'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Vercel Cron chama GET; agendadores externos podem usar POST. Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  return runLembretes(req)
}

export async function POST(req: Request) {
  return runLembretes(req)
}

async function runLembretes(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) {
    return NextResponse.json({ error: 'Configure CRON_SECRET' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 503 })
  }

  const todayStr = hojeIsoEmBrasil()

  const { data: prazosRaw, error: qErr } = await admin
    .from('prazos')
    .select('id, titulo, data_prazo, alerta_dias, escritorio_id, processo_id, ultimo_lembrete_em, processo:processos(titulo)')
    .eq('status', 'pendente')

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 })
  }

  const candidatos = (prazosRaw ?? []).filter(row => {
    const dpStr = String(row.data_prazo).slice(0, 10)
    const dias = diffDiasCivis(dpStr, todayStr)
    if (Number.isNaN(dias)) return false
    if (dias < 0 || dias > (row.alerta_dias ?? 3)) return false
    const ult = row.ultimo_lembrete_em ? String(row.ultimo_lembrete_em).slice(0, 10) : null
    if (ult === todayStr) return false
    return true
  })

  if (candidatos.length === 0) {
    return NextResponse.json({
      ok: true,
      enviados: 0,
      hoje_em: 'America/Sao_Paulo',
      data_referencia: todayStr,
      mensagem: 'Nenhum prazo elegível (janela alerta_dias a partir de hoje, horário de Brasília)',
    })
  }

  const { data: escritorios, error: eErr } = await admin.from('escritorios').select('id, owner_id, nome, email, telefone')
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  const escMap = new Map((escritorios ?? []).map(e => [e.id, e]))

  type Grupo = {
    ownerId: string
    prazoIds: string[]
    items: { titulo: string; dataPrazo: string; processoTitulo: string | null; dias: number }[]
  }
  const porOwner = new Map<string, Grupo>()

  for (const p of candidatos) {
    const esc = escMap.get(p.escritorio_id)
    if (!esc) continue
    const ownerId = esc.owner_id
    const dpStr = String(p.data_prazo).slice(0, 10)
    const dp = new Date(dpStr + 'T12:00:00')
    const dias = diffDiasCivis(dpStr, todayStr)
    const procTit =
      p.processo && typeof p.processo === 'object' && 'titulo' in p.processo
        ? String((p.processo as { titulo?: string }).titulo ?? '')
        : null

    let g = porOwner.get(ownerId)
    if (!g) {
      g = { ownerId, prazoIds: [], items: [] }
      porOwner.set(ownerId, g)
    }
    g.prazoIds.push(p.id)
    g.items.push({
      titulo: p.titulo,
      dataPrazo: format(dp, 'dd/MM/yyyy'),
      processoTitulo: procTit,
      dias,
    })
  }

  let enviados = 0
  const erros: string[] = []

  for (const [, grupo] of porOwner) {
    const { data: userData, error: uErr } = await admin.auth.admin.getUserById(grupo.ownerId)
    if (uErr || !userData.user?.email) {
      erros.push(`owner ${grupo.ownerId}: sem e-mail`)
      continue
    }
    const esc = [...escMap.values()].find(e => e.owner_id === grupo.ownerId)
    const destinatario = (esc?.email?.trim() || userData.user.email).trim()

    const r = await enviarEmailLembretesPrazos({ to: destinatario, items: grupo.items })
    if (!r.ok) {
      erros.push(r.error ?? 'resend')
      continue
    }

    const telAdvogado = telefoneParaZApi(esc?.telefone)
    if (telAdvogado && process.env.ZAPI_INSTANCE_ID?.trim()) {
      const w = await enviarTextoZApi({
        phone: telAdvogado,
        message: textoLembretePrazosWhatsapp(grupo.items),
      })
      if (!w.ok) {
        erros.push(`z-api: ${w.error ?? 'falha'}`)
      }
    }

    await admin.from('prazos').update({ ultimo_lembrete_em: todayStr }).in('id', grupo.prazoIds)
    enviados += grupo.prazoIds.length
  }

  return NextResponse.json({
    ok: true,
    enviados,
    candidatos: candidatos.length,
    data_referencia_brasil: todayStr,
    erros: erros.length ? erros : undefined,
  })
}
