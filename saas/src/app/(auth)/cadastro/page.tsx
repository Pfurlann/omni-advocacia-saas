'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { OmniLogo } from '@/components/brand/OmniLogo'
import { Input, Label, FormError, Button } from '@/components/ui'

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
      toast.success('Enviamos um link de confirmação. Após confirmar, faça login e configure o escritório.')
      setLoading(false)
      return
    }

    const user = signUpData.session.user
    const { error: escErr } = await supabase.from('escritorios').insert({
      owner_id: user.id, nome: data.nomeEscritorio,
      oab: data.oab?.trim() || null, telefone: data.telefone?.trim() || null,
    })
    if (escErr) {
      toast.error('Conta criada, mas houve erro ao criar o escritório. Configure em /configuracoes.')
      router.push('/configuracoes'); setLoading(false); return
    }

    toast.success('Conta e escritório criados!')
    router.refresh(); router.push('/kanban'); setLoading(false)
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
            "Seu escritório completo — processos, prazos e financeiro em um só lugar."
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

          <h2 className="text-2xl font-semibold text-white mb-1">Criar conta</h2>
          <p className="text-sm mb-8" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Escritório e acesso criados em um único passo
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Campo helper para inputs no contexto escuro */}
            {([
              { name: 'nome',           label: 'Nome completo',      placeholder: 'Dr. João Silva',               type: 'text' },
              { name: 'nomeEscritorio', label: 'Nome do escritório', placeholder: 'Silva & Associados Advocacia', type: 'text' },
            ] as const).map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--sidebar-text))' }}>
                  {f.label}
                </label>
                <input
                  {...register(f.name)}
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                  style={{ background: 'hsl(var(--sidebar-item-active))', border: '1px solid hsl(var(--sidebar-border))' }}
                />
                {errors[f.name] && <p className="text-red-400 text-xs mt-1">{errors[f.name]?.message}</p>}
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              {([
                { name: 'oab',      label: 'OAB (opcional)',      placeholder: 'SP 123.456'       },
                { name: 'telefone', label: 'Telefone (opcional)', placeholder: '(11) 99999-9999'  },
              ] as const).map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--sidebar-text))' }}>
                    {f.label}
                  </label>
                  <input
                    {...register(f.name)}
                    type="text"
                    placeholder={f.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                    style={{ background: 'hsl(var(--sidebar-item-active))', border: '1px solid hsl(var(--sidebar-border))' }}
                  />
                </div>
              ))}
            </div>

            {([
              { name: 'email',    label: 'Email',          placeholder: 'seu@escritorio.com.br', type: 'email'    },
              { name: 'senha',    label: 'Senha',          placeholder: '••••••••',               type: 'password' },
              { name: 'confirmar',label: 'Confirmar senha',placeholder: '••••••••',               type: 'password' },
            ] as const).map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--sidebar-text))' }}>
                  {f.label}
                </label>
                <input
                  {...register(f.name)}
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                  style={{ background: 'hsl(var(--sidebar-item-active))', border: '1px solid hsl(var(--sidebar-border))' }}
                />
                {errors[f.name] && <p className="text-red-400 text-xs mt-1">{errors[f.name]?.message}</p>}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'hsl(var(--primary))' }}
            >
              {loading
                ? <OmniSpinner size="xs" variant="dark" />
                : <> Criar conta <ArrowRight className="h-4 w-4" /> </>}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'hsl(var(--sidebar-text))' }}>
            Já tem conta?{' '}
            <Link href="/login" className="text-white font-medium hover:opacity-80 transition">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
