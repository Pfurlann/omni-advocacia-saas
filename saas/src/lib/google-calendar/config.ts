/** Escopos: ler calendários, listar, criar/editar/eliminar eventos. */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
] as const

export function getGoogleOAuthRedirectUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return `${fromEnv}/api/google-calendar/callback`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/google-calendar/callback`
  return 'http://localhost:3000/api/google-calendar/callback'
}

export function getGoogleClientCredentials(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim()
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!id || !secret) return null
  return { id, secret }
}
