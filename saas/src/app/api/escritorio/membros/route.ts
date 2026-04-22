import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin, getServiceRoleKeyConfigurationError } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const postCreateSchema = z.object({
  mode: z.literal('create'),
  email: z.string().email(),
  papel: z.enum(['gestor', 'advogado']),
  full_name: z.string().min(2, 'Nome muito curto').max(200),
  password: z.string().min(8, 'Senha: mínimo 8 caracteres').max(72),
})

const postLinkSchema = z.object({
  mode: z.literal('link_existing'),
  email: z.string().email(),
  papel: z.enum(['gestor', 'advogado']),
})

const postSchema = z.discriminatedUnion('mode', [postCreateSchema, postLinkSchema])

function appOrigin(req: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

/** true se o usuário for gestor (dono ou papel gestor) deste escritório. */
async function isGestorDoEscritorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  escritorioId: string,
): Promise<boolean> {
  const { data: own } = await supabase
    .from('escritorios')
    .select('id')
    .eq('id', escritorioId)
    .eq('owner_id', userId)
    .maybeSingle()
  if (own) return true
  const { data: m } = await supabase
    .from('escritorio_membros')
    .select('papel')
    .eq('escritorio_id', escritorioId)
    .eq('user_id', userId)
    .eq('ativo', true)
    .eq('papel', 'gestor')
    .maybeSingle()
  return Boolean(m)
}

async function getGestorEscritorioId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const ativo = await getEscritorioIdForCurrentUser(supabase, userId)
  if (ativo) {
    const g = await isGestorDoEscritorio(supabase, userId, ativo)
    if (g) return ativo
  }
  const { data: own } = await supabase
    .from('escritorios')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (own) return own.id as string
  const { data: mem } = await supabase
    .from('escritorio_membros')
    .select('escritorio_id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .eq('papel', 'gestor')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (mem?.escritorio_id as string | undefined) ?? null
}

/** Com a sessão do gestor — não usar o client admin aqui (chave errada aplica RLS e zera linhas). */
async function getOwnerIdDoEscritorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  escritorioId: string,
) {
  const { data, error } = await supabase
    .from('escritorios')
    .select('owner_id')
    .eq('id', escritorioId)
    .maybeSingle()
  if (error) return { ownerId: null as string | null, error: error.message }
  return { ownerId: (data?.owner_id as string | undefined) ?? null, error: null as string | null }
}

/** Escritório exibido (perfil.active_escritorio_id se acessível; senão primeiro dono / membro). */
async function getEscritorioIdForCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data: p } = await supabase
    .from('profiles')
    .select('active_escritorio_id')
    .eq('id', userId)
    .maybeSingle()
  const chosen = p?.active_escritorio_id as string | null | undefined
  if (chosen) {
    const { data: own } = await supabase
      .from('escritorios')
      .select('id')
      .eq('id', chosen)
      .eq('owner_id', userId)
      .maybeSingle()
    if (own) return chosen
    const { data: m } = await supabase
      .from('escritorio_membros')
      .select('escritorio_id')
      .eq('escritorio_id', chosen)
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle()
    if (m) return chosen
  }
  const { data: own } = await supabase
    .from('escritorios')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (own) return own.id as string
  const { data: mem } = await supabase
    .from('escritorio_membros')
    .select('escritorio_id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (mem?.escritorio_id as string | undefined) ?? null
}

function displayNameFromAuthUser(user: {
  email?: string | undefined
  user_metadata?: Record<string, unknown> | undefined
} | null): string | null {
  if (!user) return null
  const meta = user.user_metadata
  for (const key of ['full_name', 'name', 'display_name'] as const) {
    const v = meta?.[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  if (user.email) {
    const local = user.email.split('@')[0]?.trim()
    if (local) return local
    return user.email
  }
  return null
}

async function findUserIdByEmail(
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  email: string,
): Promise<{ userId: string | null; error: string | null }> {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000
  try {
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
      if (error) {
        const raw = error.message || ''
        const invalidKey = /invalid\s*api\s*key|jwt\s*(invalid|expired)|apikey/i.test(raw)
        const hint = invalidKey
          ? ' Chave rejeitada pelo Supabase: use em .env a secret **service_role** (Project Settings → API), mesma URL do projeto, reinicie o `npm run dev`.'
          : ''
        return {
          userId: null,
          error: (raw || 'Falha ao listar usuários.') + hint,
        }
      }
      const users = data?.users ?? []
      const found = users.find(u => u.email?.toLowerCase() === normalized)
      if (found) return { userId: found.id, error: null }
      if (users.length < perPage) break
      page += 1
    }
  } catch (e) {
    return {
      userId: null,
      error: e instanceof Error ? e.message : 'Erro inesperado ao buscar usuário por e-mail.',
    }
  }
  return { userId: null, error: null }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const escritorioId = await getEscritorioIdForCurrentUser(supabase, user.id)
    if (!escritorioId) {
      return NextResponse.json({ error: 'Nenhum escritório associado à sua conta.' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 })
    }
    const keyCfg = getServiceRoleKeyConfigurationError()
    if (keyCfg) {
      return NextResponse.json({ error: keyCfg }, { status: 503 })
    }
    const admin = createSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Cliente admin indisponível.' }, { status: 503 })
    }

    const { data: rows, error: rowsErr } = await admin
      .from('escritorio_membros')
      .select('user_id, papel')
      .eq('escritorio_id', escritorioId)
      .eq('ativo', true)
      .order('papel', { ascending: true })

    if (rowsErr) {
      return NextResponse.json({ error: rowsErr.message }, { status: 400 })
    }

    const list = rows ?? []
    const ids = [...new Set(list.map(r => r.user_id as string))]
    if (!ids.length) {
      return NextResponse.json({ membros: [] })
    }

    const { data: profiles } = await admin.from('profiles').select('id, full_name, avatar_url').in('id', ids)
    const nomePorId = new Map((profiles ?? []).map(p => [p.id as string, (p.full_name as string | null) ?? null]))
    const avatarPorId = new Map(
      (profiles ?? []).map(p => [p.id as string, (p.avatar_url as string | null) ?? null]),
    )

    const needAuth = ids.filter(id => {
      const n = nomePorId.get(id)
      return n == null || !String(n).trim()
    })

    await Promise.all(
      needAuth.map(async uid => {
        const { data: ur, error: ue } = await admin.auth.admin.getUserById(uid)
        if (ue || !ur?.user) return
        const label = displayNameFromAuthUser(ur.user)
        if (label) nomePorId.set(uid, label)
      }),
    )

    const membros = list.map(r => ({
      user_id: r.user_id as string,
      papel: r.papel as 'gestor' | 'advogado',
      full_name: nomePorId.get(r.user_id as string) ?? null,
      avatar_url: avatarPorId.get(r.user_id as string) ?? null,
    }))

    return NextResponse.json({ membros })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao listar membros.'
    console.error('[api/escritorio/membros GET]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const escritorioId = await getGestorEscritorioId(supabase, user.id)
    if (!escritorioId) {
      return NextResponse.json({ error: 'Apenas gestores podem convidar membros.' }, { status: 403 })
    }

    let body: z.infer<typeof postSchema>
    try {
      body = postSchema.parse(await req.json())
    } catch {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY no .env.local.' }, { status: 503 })
    }
    const keyCfg = getServiceRoleKeyConfigurationError()
    if (keyCfg) {
      return NextResponse.json({ error: keyCfg }, { status: 503 })
    }
    const admin = createSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Não foi possível criar o cliente admin (confira NEXT_PUBLIC_SUPABASE_URL).' }, { status: 503 })
    }

    const { ownerId, error: ownerErr } = await getOwnerIdDoEscritorio(supabase, escritorioId)
    if (ownerErr) {
      return NextResponse.json({ error: ownerErr }, { status: 400 })
    }
    if (!ownerId) {
      return NextResponse.json(
        { error: 'Não foi possível carregar o escritório. Confira se a migration da equipe foi aplicada e se você ainda é gestor.' },
        { status: 404 },
      )
    }

    if (body.mode === 'create') {
      const emailNorm = body.email.trim().toLowerCase()

      const { userId: foundId, error: findErr } = await findUserIdByEmail(admin, emailNorm)
      if (findErr) {
        return NextResponse.json({ error: findErr }, { status: 502 })
      }
      if (foundId) {
        return NextResponse.json(
          {
            error:
              'Este e-mail já está cadastrado. Use “Vincular conta existente” abaixo ou escolha outro e-mail.',
          },
          { status: 409 },
        )
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: emailNorm,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim() },
      })
      if (cErr) {
        const msg = cErr.message ?? 'Não foi possível criar o usuário.'
        const lower = msg.toLowerCase()
        const exists =
          lower.includes('already') || lower.includes('registered') || lower.includes('exists') || lower.includes('duplicate')
        return NextResponse.json(
          { error: exists ? 'Este e-mail já está cadastrado.' : msg },
          { status: exists ? 409 : 400 },
        )
      }
      const newUser = created?.user
      if (!newUser?.id) {
        return NextResponse.json({ error: 'Usuário criado sem retornar id.' }, { status: 502 })
      }
      if (newUser.id === ownerId) {
        await admin.auth.admin.deleteUser(newUser.id)
        return NextResponse.json({ error: 'O dono do escritório já faz parte da equipe.' }, { status: 400 })
      }

      // Reforça senha + e-mail confirmado (em alguns projetos GoTrue o primeiro createUser não habilita login por senha).
      const { error: authSyncErr } = await admin.auth.admin.updateUserById(newUser.id, {
        password: body.password,
        email_confirm: true,
      })
      if (authSyncErr) {
        await admin.auth.admin.deleteUser(newUser.id)
        return NextResponse.json(
          {
            error: `Não foi possível ativar login com senha: ${authSyncErr.message}. No Supabase: Authentication → Providers → Email (habilitado).`,
          },
          { status: 502 },
        )
      }

      const { error: upErr } = await admin.from('escritorio_membros').upsert(
        {
          escritorio_id: escritorioId,
          user_id: newUser.id,
          papel: body.papel,
          ativo: true,
        },
        { onConflict: 'escritorio_id,user_id' },
      )
      if (upErr) {
        await admin.auth.admin.deleteUser(newUser.id)
        return NextResponse.json({ error: upErr.message }, { status: 400 })
      }

      await admin
        .from('profiles')
        .update({ full_name: body.full_name.trim() })
        .eq('id', newUser.id)

      return NextResponse.json({ ok: true, user_id: newUser.id, created: true })
    }

    // mode === 'link_existing' — só associa e-mail que já existe no Auth (sem e-mail automático)
    const emailNorm = body.email.trim()
    const redirectTo = `${appOrigin(req)}/auth/callback?next=/kanban`

    const { userId: foundId, error: findErr } = await findUserIdByEmail(admin, emailNorm)
    if (findErr) {
      return NextResponse.json({ error: findErr }, { status: 502 })
    }

    if (!foundId) {
      return NextResponse.json(
        {
          error:
            'Nenhum usuário encontrado com este e-mail. Use “Novo membro” acima para criar acesso com senha.',
        },
        { status: 404 },
      )
    }

    const targetUserId = foundId

    if (targetUserId === ownerId) {
      return NextResponse.json({ error: 'O dono do escritório já faz parte da equipe.' }, { status: 400 })
    }

    const { error: upErr } = await admin
      .from('escritorio_membros')
      .upsert(
        {
          escritorio_id: escritorioId,
          user_id: targetUserId,
          papel: body.papel,
          ativo: true,
        },
        { onConflict: 'escritorio_id,user_id' },
      )
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    let accessLink: string | undefined
    const { data: gl, error: glErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailNorm,
      options: { redirectTo },
    })
    if (glErr) {
      console.warn('[api/escritorio/membros] generateLink magiclink:', glErr.message)
    } else if (gl?.properties?.action_link) {
      accessLink = gl.properties.action_link
    }

    return NextResponse.json({
      ok: true,
      user_id: targetUserId,
      linked_existing: true,
      access_link: accessLink,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno ao convidar.'
    console.error('[api/escritorio/membros POST]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const escritorioId = await getGestorEscritorioId(supabase, user.id)
  if (!escritorioId) {
    return NextResponse.json({ error: 'Apenas gestores podem remover membros.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetUserId = url.searchParams.get('userId')
  if (!targetUserId) {
    return NextResponse.json({ error: 'Parâmetro userId obrigatório' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY no .env.local.' }, { status: 503 })
  }
  const keyCfgDel = getServiceRoleKeyConfigurationError()
  if (keyCfgDel) {
    return NextResponse.json({ error: keyCfgDel }, { status: 503 })
  }
  const admin = createSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Não foi possível criar o cliente admin.' }, { status: 503 })
  }

  const { ownerId } = await getOwnerIdDoEscritorio(supabase, escritorioId)
  if (ownerId === targetUserId) {
    return NextResponse.json({ error: 'Não é possível remover o dono do escritório.' }, { status: 400 })
  }

  const { error } = await admin
    .from('escritorio_membros')
    .delete()
    .eq('escritorio_id', escritorioId)
    .eq('user_id', targetUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
