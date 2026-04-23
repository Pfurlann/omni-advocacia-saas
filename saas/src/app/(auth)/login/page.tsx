'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { OmniLogo } from '@/components/brand/OmniLogo'

const schema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

function mensagemErroLogin(raw: string): string {
  const t = raw.toLowerCase()
  if (t.includes('invalid login credentials') || t.includes('invalid credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (t.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  }
  return raw
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (searchParams.get('error') !== 'auth') return
    const reason = searchParams.get('reason')
    if (reason === 'missing_code') {
      toast.error('Link de convite inválido. Abra o link do e-mail novamente.')
      return
    }
    if (reason) toast.error(`Não foi possível entrar: ${reason}`)
  }, [searchParams])

  const onSubmit = async (data: Form) => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.senha,
    })
    if (error) {
      toast.error(mensagemErroLogin(error.message))
      setLoading(false)
      return
    }
    router.push('/kanban')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'hsl(var(--sidebar-bg))' }}
    >
      {/* ══ PAINEL ESQUERDO — BRANDING ══ */}
      <div
        className="omni-pattern hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-12 relative overflow-hidden"
        style={{ borderRight: '1px solid hsl(var(--sidebar-border))' }}
      >
        {/* Radial glow — primary */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 20% 80%, hsl(var(--primary) / 0.22) 0%, transparent 60%)',
        }} />
        {/* Radial glow — gold */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 80% 10%, hsl(var(--gold) / 0.12) 0%, transparent 55%)',
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <OmniLogo variant="dark" size="md" />
        </div>

        {/* Centro — destaque display */}
        <div className="relative z-10 space-y-6">
          <div className="omni-accent-bar w-12" />
          <p
            className="font-display text-white/90 leading-snug"
            style={{ fontSize: '26px', letterSpacing: '-0.3px' }}
          >
            Gestão jurídica<br />
            <em style={{ color: 'hsl(var(--gold))' }}>sem atrito.</em>
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Processos, prazos, clientes e finanças centralizados. Foco total na advocacia.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            {['Kanban Jurídico', 'Prazos Fatais', 'CRM', 'DRE'].map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full font-medium tracking-wide"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'hsl(var(--sidebar-text))',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-xs relative z-10" style={{ color: 'hsl(240 15% 32%)' }}>
          © {new Date().getFullYear()} Omni · Gestão Jurídica
        </p>
      </div>

      {/* ══ PAINEL DIREITO — FORMULÁRIO ══ */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Marca decorativa grande ao fundo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.025]">
          <svg viewBox="0 0 52 52" width="360" height="360" fill="none">
            <circle cx="26" cy="26" r="18" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"
              strokeDasharray="99 14.1" transform="rotate(-45 26 26)" />
            <circle cx="38.7" cy="13.3" r="2.1" fill="#C9A84C" />
          </svg>
        </div>

        <div className="w-full max-w-[360px] relative z-10">
          {/* Logo mobile */}
          <div className="mb-10 lg:hidden">
            <OmniLogo variant="dark" size="sm" />
          </div>

          {/* Cabeçalho do formulário */}
          <div className="mb-8">
            <h1 className="font-display text-white mb-2" style={{ fontSize: '32px', lineHeight: 1.1 }}>
              Bem-vindo
            </h1>
            <p className="text-sm" style={{ color: 'hsl(var(--sidebar-text))' }}>
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Card do formulário com glassmorphism */}
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Campo Email */}
              <div>
                <label
                  className="block text-xs font-semibold mb-2 tracking-wide uppercase"
                  style={{ color: 'hsl(var(--sidebar-text))' }}
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'hsl(var(--sidebar-text))' }}
                  />
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="seu@escritorio.com.br"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white transition-all duration-150 focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: errors.email
                        ? '1px solid rgba(239,68,68,0.6)'
                        : '1px solid rgba(255,255,255,0.10)',
                      caretColor: 'hsl(var(--primary))',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid hsl(var(--primary) / 0.6)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.12)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = errors.email
                        ? '1px solid rgba(239,68,68,0.6)'
                        : '1px solid rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Campo Senha */}
              <div>
                <label
                  className="block text-xs font-semibold mb-2 tracking-wide uppercase"
                  style={{ color: 'hsl(var(--sidebar-text))' }}
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'hsl(var(--sidebar-text))' }}
                  />
                  <input
                    {...register('senha')}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white transition-all duration-150 focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: errors.senha
                        ? '1px solid rgba(239,68,68,0.6)'
                        : '1px solid rgba(255,255,255,0.10)',
                      caretColor: 'hsl(var(--primary))',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid hsl(var(--primary) / 0.6)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.12)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = errors.senha
                        ? '1px solid rgba(239,68,68,0.6)'
                        : '1px solid rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                {errors.senha && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.senha.message}</p>
                )}
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 mt-2"
                style={{
                  background: loading
                    ? 'hsl(var(--primary))'
                    : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(245 82% 55%) 100%)',
                  boxShadow: loading ? 'none' : '0 4px 20px hsl(var(--primary) / 0.35)',
                }}
                onMouseEnter={e => {
                  if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px hsl(var(--primary) / 0.50)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px hsl(var(--primary) / 0.35)'
                }}
              >
                {loading
                  ? <OmniSpinner size="xs" variant="light" />
                  : <><span>Entrar</span><ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </form>
          </div>

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm" style={{ color: 'hsl(var(--sidebar-text))' }}>
              Não tem conta?{' '}
              <Link href="/cadastro" className="text-white font-semibold hover:opacity-75 transition-opacity">
                Criar conta
              </Link>
            </p>
            <p className="text-xs" style={{ color: 'hsl(240 15% 32%)' }}>
              Convidado? Use o link recebido por e-mail.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--sidebar-bg))' }}>
        <OmniSpinner size="lg" variant="light" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
