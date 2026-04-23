'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Mail, Lock, User, Building2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { OmniLogo } from '@/components/brand/OmniLogo'

const schema = z.object({
  nome:           z.string().min(2, 'Nome obrigatório'),
  nomeEscritorio: z.string().min(2, 'Nome do escritório obrigatório'),
  oab:            z.string().optional(),
  telefone:       z.string().optional(),
  email:          z.string().email('Email inválido'),
  senha:          z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar:      z.string(),
}).refine(d => d.senha === d.confirmar, { message: 'Senhas não conferem', path: ['confirmar'] })

type Form = z.infer<typeof schema>

// Estilo compartilhado para inputs dark
const inputStyle = (hasError?: boolean) => ({
  background: 'rgba(255,255,255,0.06)',
  border: hasError ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)',
  caretColor: 'hsl(var(--primary))',
})

function DarkInput({ icon: Icon, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  error?: boolean
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
          style={{ color: 'hsl(var(--sidebar-text))' }}
        />
      )}
      <input
        {...props}
        className={`w-full ${Icon ? 'pl-10' : 'pl-3.5'} pr-4 py-2.5 rounded-xl text-sm text-white transition-all duration-150 focus:outline-none placeholder-white/20`}
        style={inputStyle(error)}
        onFocus={e => {
          e.currentTarget.style.border = '1px solid hsl(var(--primary) / 0.6)'
          e.currentTarget.style.boxShadow = '0 0 0 3px hsl(var(--primary) / 0.12)'
        }}
        onBlur={e => {
          e.currentTarget.style.border = error ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

export default function CadastroPage() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    const supabase = createClient()
    const origin   = typeof window !== 'undefined' ? window.location.origin : ''
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.senha,
      options: {
        data: { full_name: data.nome },
        emailRedirectTo: `${origin}/auth/callback?next=/kanban`,
      },
    })
    if (error) { toast.error(error.message); setLoading(false); return }

    if (!signUpData.session) {
      toast.success('Enviamos um link de confirmação. Após confirmar, faça login.')
      setLoading(false); return
    }

    const user = signUpData.session.user
    const { error: escErr } = await supabase.from('escritorios').insert({
      owner_id: user.id, nome: data.nomeEscritorio,
      oab: data.oab?.trim() || null, telefone: data.telefone?.trim() || null,
    })
    if (escErr) {
      toast.error('Conta criada, mas erro ao criar escritório. Configure em Configurações.')
      router.push('/configuracoes'); setLoading(false); return
    }

    toast.success('Conta e escritório criados!')
    router.refresh(); router.push('/kanban'); setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(var(--sidebar-bg))' }}>

      {/* ══ PAINEL ESQUERDO — BRANDING ══ */}
      <div
        className="omni-pattern hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-12 relative overflow-hidden"
        style={{ borderRight: '1px solid hsl(var(--sidebar-border))' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 20% 80%, hsl(var(--primary) / 0.20) 0%, transparent 60%)',
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 80% 10%, hsl(var(--gold) / 0.12) 0%, transparent 55%)',
        }} />

        <div className="relative z-10">
          <OmniLogo variant="dark" size="md" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="omni-accent-bar w-12" />
          <p
            className="font-display text-white/90 leading-snug"
            style={{ fontSize: '26px', letterSpacing: '-0.3px' }}
          >
            Comece hoje.<br />
            <em style={{ color: 'hsl(var(--gold))' }}>Zero burocracia.</em>
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Configure seu escritório em menos de 2 minutos. Processos, prazos e finanças prontos para usar.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {['Kanban Jurídico', 'Prazos Fatais', 'CRM', 'DRE'].map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
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

        <p className="text-xs relative z-10" style={{ color: 'hsl(240 15% 32%)' }}>
          © {new Date().getFullYear()} Omni · Gestão Jurídica
        </p>
      </div>

      {/* ══ PAINEL DIREITO — FORMULÁRIO ══ */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-y-auto">
        {/* Marca decorativa ao fundo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.025]">
          <svg viewBox="0 0 52 52" width="340" height="340" fill="none">
            <circle cx="26" cy="26" r="18" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"
              strokeDasharray="99 14.1" transform="rotate(-45 26 26)" />
            <circle cx="38.7" cy="13.3" r="2.1" fill="#C9A84C" />
          </svg>
        </div>

        <div className="w-full max-w-[380px] relative z-10 py-8">
          <div className="mb-8 lg:hidden">
            <OmniLogo variant="dark" size="sm" />
          </div>

          <div className="mb-7">
            <h1 className="font-display text-white mb-2" style={{ fontSize: '30px', lineHeight: 1.1 }}>
              Criar conta
            </h1>
            <p className="text-sm" style={{ color: 'hsl(var(--sidebar-text))' }}>
              Escritório e acesso prontos em um único passo
            </p>
          </div>

          {/* Card glassmorphism */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>
                  Nome completo
                </label>
                <DarkInput {...register('nome')} icon={User} type="text" placeholder="Dr. João Silva" error={!!errors.nome} />
                {errors.nome && <p className="text-red-400 text-xs mt-1.5">{errors.nome.message}</p>}
              </div>

              {/* Escritório */}
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>
                  Nome do escritório
                </label>
                <DarkInput {...register('nomeEscritorio')} icon={Building2} type="text" placeholder="Silva & Associados" error={!!errors.nomeEscritorio} />
                {errors.nomeEscritorio && <p className="text-red-400 text-xs mt-1.5">{errors.nomeEscritorio.message}</p>}
              </div>

              {/* OAB + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>OAB</label>
                  <DarkInput {...register('oab')} type="text" placeholder="SP 123.456" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>Telefone</label>
                  <DarkInput {...register('telefone')} type="text" placeholder="(11) 99999-9999" />
                </div>
              </div>

              {/* Divisor */}
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>Email</label>
                <DarkInput {...register('email')} icon={Mail} type="email" autoComplete="email" placeholder="seu@escritorio.com.br" error={!!errors.email} />
                {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
              </div>

              {/* Senha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>Senha</label>
                  <DarkInput {...register('senha')} icon={Lock} type="password" autoComplete="new-password" placeholder="••••••••" error={!!errors.senha} />
                  {errors.senha && <p className="text-red-400 text-xs mt-1.5">{errors.senha.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'hsl(var(--sidebar-text))' }}>Confirmar</label>
                  <DarkInput {...register('confirmar')} type="password" autoComplete="new-password" placeholder="••••••••" error={!!errors.confirmar} />
                  {errors.confirmar && <p className="text-red-400 text-xs mt-1.5">{errors.confirmar.message}</p>}
                </div>
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 mt-1"
                style={{
                  background: loading ? 'hsl(var(--primary))' : 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(245 82% 55%) 100%)',
                  boxShadow: loading ? 'none' : '0 4px 20px hsl(var(--primary) / 0.35)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 28px hsl(var(--primary) / 0.50)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px hsl(var(--primary) / 0.35)' }}
              >
                {loading
                  ? <OmniSpinner size="xs" variant="light" />
                  : <><span>Criar conta</span><ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </form>
          </div>

          <p className="text-center text-sm mt-5" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Já tem conta?{' '}
            <Link href="/login" className="text-white font-semibold hover:opacity-75 transition-opacity">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
