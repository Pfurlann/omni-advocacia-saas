'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight } from 'lucide-react'
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
    return 'E-mail ou senha incorretos. Dica: use o e-mail exatamente em minúsculas (como no cadastro da equipe). No Supabase, confira Authentication → Providers → E-mail ativo.'
  }
  if (t.includes('email not confirmed')) {
    return 'Este e-mail ainda não está confirmado no Auth. Peça ao gestor para revisar o usuário no painel Supabase ou recrie o acesso em Equipe.'
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
      toast.error('O link de convite não trouxe o código de acesso. Verifique as Redirect URLs no Supabase e abra o link do e-mail de novo.')
      return
    }
    if (reason) {
      toast.error(`Não foi possível entrar pelo link: ${reason}`)
    }
  }, [searchParams])

  const onSubmit = async (data: Form) => {
    setLoading(true)
    const supabase = createClient()
    const email = data.email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email, password: data.senha })
    if (error) {
      toast.error(mensagemErroLogin(error.message))
      setLoading(false)
      return
    }
    router.push('/kanban')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(var(--sidebar-bg))' }}>
      {/* ── Painel esquerdo — branding ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[400px] shrink-0 p-10"
        style={{ borderRight: '1px solid hsl(var(--sidebar-border))' }}
      >
        <OmniLogo variant="dark" size="md" />
        <div className="space-y-5">
          <p className="text-white/70 text-lg font-light leading-relaxed">
            "Gestão completa do escritório — processos, prazos e finanças em um só lugar."
          </p>
          <div className="flex flex-wrap gap-2">
            {['Kanban', 'Prazos Fatais', 'CRM', 'DRE'].map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'hsl(var(--sidebar-item-active))', color: 'hsl(var(--sidebar-text))' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'hsl(var(--sidebar-text))' }}>
          © {new Date().getFullYear()} Omni · Todos os direitos reservados
        </p>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><OmniLogo variant="dark" size="sm" /></div>

          <h2 className="text-2xl font-semibold text-white mb-1">Entrar</h2>
          <p className="text-sm mb-8" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Acesse seu escritório
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--sidebar-text))' }}>
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="seu@escritorio.com.br"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                style={{
                  background: 'hsl(var(--sidebar-item-active))',
                  border: '1px solid hsl(var(--sidebar-border))',
                }}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--sidebar-text))' }}>
                Senha
              </label>
              <input
                {...register('senha')}
                type="password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                style={{
                  background: 'hsl(var(--sidebar-item-active))',
                  border: '1px solid hsl(var(--sidebar-border))',
                }}
              />
              {errors.senha && <p className="text-red-400 text-xs mt-1">{errors.senha.message}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'hsl(var(--primary))' }}
            >
              {loading
                ? <OmniSpinner size="xs" variant="dark" />
                : <> Entrar <ArrowRight className="h-4 w-4" /> </>}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-white font-medium hover:opacity-80 transition">
              Criar conta
            </Link>
          </p>
          <p className="text-center text-xs mt-3" style={{ color: 'hsl(240 15% 38%)' }}>
            Foi convidado? Use o link recebido por e-mail.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><OmniSpinner size="lg" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
