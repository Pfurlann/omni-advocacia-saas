import { createClient } from '@supabase/supabase-js'

type ServiceJwtPayload = { role?: string; ref?: string; iss?: string }

function jwtProjectRef(payload: ServiceJwtPayload): string | null {
  if (typeof payload.ref === 'string') return payload.ref.toLowerCase()
  const iss = payload.iss
  if (typeof iss === 'string') {
    const m = iss.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)
    if (m) return m[1].toLowerCase()
  }
  return null
}

function decodeSupabaseJwtPayload(secret: string): ServiceJwtPayload | null {
  const t = secret.trim()
  const parts = t.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(json) as ServiceJwtPayload
  } catch {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const pad = '='.repeat((4 - (b64.length % 4)) % 4)
      const json = Buffer.from(b64 + pad, 'base64').toString('utf8')
      return JSON.parse(json) as ServiceJwtPayload
    } catch {
      return null
    }
  }
}

/** Ex.: https://abcd1234.supabase.co → abcd1234 */
export function extractSupabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Se a env estiver errada, devolve texto para mostrar ao gestor (evita "invalid API key" sem contexto).
 * A secret correta é um JWT cuja claim `role` é `service_role` (aba API do Supabase).
 */
export function getServiceRoleKeyConfigurationError(): string | null {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw?.trim()) return null

  const trimmed = raw.trim()
  if (trimmed.startsWith('sb_secret_')) {
    return 'A chave começa com sb_secret_ (formato novo do Supabase). Este projeto usa @supabase/supabase-js atualizado para aceitar esse formato; se o erro continuar, em Project Settings → API use a **service_role** em formato JWT (secção "API keys" / "Legacy" conforme o painel) e a mesma URL do projeto.'
  }

  const payload = decodeSupabaseJwtPayload(raw)
  if (!payload) {
    return 'SUPABASE_SERVICE_ROLE_KEY parece incompleta ou corrompida. Deve ser o JWT longo da secret **service_role** (Supabase → Project Settings → API). Sem aspas nem espaços no início/fim.'
  }
  if (payload.role === 'anon') {
    return 'SUPABASE_SERVICE_ROLE_KEY está com a chave **anon** (public). Troque pela secret **service_role** no mesmo ecrã. A chave anon não serve para convidar ou inserir membros pelo servidor.'
  }
  if (payload.role !== 'service_role') {
    return `SUPABASE_SERVICE_ROLE_KEY não é a service_role (role no token: "${payload.role ?? '?'}"). Copie a secret **service_role**, não a "anon".`
  }

  const urlRef = publicUrl ? extractSupabaseProjectRefFromUrl(publicUrl) : null
  const jwtRef = jwtProjectRef(payload)
  if (urlRef && jwtRef && urlRef !== jwtRef) {
    return `O URL e a chave são de projetos diferentes: NEXT_PUBLIC_SUPABASE_URL é o projeto "${urlRef}" e a service_role é do projeto "${jwtRef}". Copie URL + anon + service_role na **mesma** página (Project Settings → API). Misturar projetos causa "Invalid API key".`
  }

  return null
}

/** Cliente com service role — só em rotas/API/server; nunca no browser. */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
