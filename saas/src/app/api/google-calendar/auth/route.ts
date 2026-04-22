import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { getGoogleClientCredentials, getGoogleOAuthRedirectUrl, GOOGLE_CALENDAR_SCOPES } from '@/lib/google-calendar/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
    return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent('/agenda'), base))
  }

  const creds = getGoogleClientCredentials()
  if (!creds) {
    return new NextResponse('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados', { status: 500 })
  }

  const redirect = getGoogleOAuthRedirectUrl()
  const oauth2 = new google.auth.OAuth2(creds.id, creds.secret, redirect)
  const state = Buffer.from(user.id, 'utf8').toString('base64url')

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: [...GOOGLE_CALENDAR_SCOPES],
    prompt: 'consent',
    state,
  })
  return NextResponse.redirect(url)
}
