import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getGoogleClientCredentials, getGoogleOAuthRedirectUrl } from '@/lib/google-calendar/config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const err = url.searchParams.get('error')
  const stateB64 = url.searchParams.get('state')
  if (err) {
    return NextResponse.redirect(appendGoogleReturn(appBase(request), err))
  }
  if (!code || !stateB64) {
    return new NextResponse('Código de autorização em falta', { status: 400 })
  }

  let stateUser: string
  try {
    stateUser = Buffer.from(stateB64, 'base64url').toString('utf8')
  } catch {
    return new NextResponse('State inválido', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== stateUser) {
    return new NextResponse('Sessão inválida', { status: 401 })
  }

  const creds = getGoogleClientCredentials()
  if (!creds) {
    return new NextResponse('Google OAuth não configurado', { status: 500 })
  }

  const redirect = getGoogleOAuthRedirectUrl()
  const oauth2 = new google.auth.OAuth2(creds.id, creds.secret, redirect)
  const { tokens } = await oauth2.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token) {
    return new NextResponse('Não recebemos refresh token — tente de novo (revogue acesso em myaccount.google.com/permissions e reconecte)', { status: 400 })
  }

  const expires = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString()

  oauth2.setCredentials(tokens)
  const { error: up } = await supabase.from('user_google_calendar').upsert(
    {
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expires,
      default_calendar_id: 'primary',
      visible_calendar_ids: ['primary'],
      show_omni_layer: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (up) {
    console.error('user_google_calendar upsert', up)
    return new NextResponse('Erro a gravar ligação', { status: 500 })
  }

  return NextResponse.redirect(appendGoogleReturn(appBase(request), 'ok'))
}

function appBase(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : 'http://localhost:3000'
}

function appendGoogleReturn(base: string, googleValue: string) {
  const u = new URL('/configuracoes', base)
  u.searchParams.set('tab', 'integracoes')
  u.searchParams.set('google', googleValue)
  return u.toString()
}
