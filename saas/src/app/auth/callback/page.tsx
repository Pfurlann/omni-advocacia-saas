'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

const OTP_TYPES = ['invite', 'signup', 'magiclink', 'recovery', 'email_change', 'email'] as const
type OtpType = (typeof OTP_TYPES)[number]

function isOtpType(t: string | null): t is OtpType {
  return t != null && (OTP_TYPES as readonly string[]).includes(t)
}

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get('next') ?? '/kanban'
  const next = nextRaw.startsWith('/') ? nextRaw : '/kanban'
  const [message, setMessage] = useState('Validando acesso…')

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const url = new URL(window.location.href)

      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setMessage(`Não foi possível concluir o login: ${error.message}`)
          return
        }
        url.searchParams.delete('code')
        const qs = url.searchParams.toString()
        window.history.replaceState(null, '', qs ? `${url.pathname}?${qs}` : url.pathname)
        router.replace(next)
        router.refresh()
        return
      }

      const token_hash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      if (token_hash && isOtpType(type)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) {
          setMessage(`Link inválido ou expirado: ${error.message}`)
          return
        }
        url.searchParams.delete('token_hash')
        url.searchParams.delete('type')
        const qs = url.searchParams.toString()
        window.history.replaceState(null, '', qs ? `${url.pathname}?${qs}` : url.pathname)
        router.replace(next)
        router.refresh()
        return
      }

      const raw = window.location.hash?.replace(/^#/, '') ?? ''
      if (raw) {
        const params = new URLSearchParams(raw)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) {
            setMessage(error.message)
            return
          }
          window.history.replaceState(null, '', url.pathname + url.search)
          router.replace(next)
          router.refresh()
          return
        }
      }

      setMessage(
        'Este link não trouxe dados de sessão (expirou, foi usado duas vezes ou a URL de retorno não está liberada no Supabase). ' +
          `Inclua em Authentication → URL Configuration → Redirect URLs: ${window.location.origin}/auth/callback** e peça um novo convite.`,
      )
    }
    void run()
  }, [next, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
      <OmniSpinner size="lg" />
      <p className="text-sm text-muted-foreground text-center max-w-md whitespace-pre-wrap">{message}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <OmniSpinner size="lg" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}
