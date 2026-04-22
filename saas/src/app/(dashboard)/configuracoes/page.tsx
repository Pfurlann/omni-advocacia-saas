'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEscritorio, useUpdateEscritorio, useCreateEscritorio, useSetEscritorioAtivo } from '@/hooks/useEscritorio'
import { useMeusEscritorios } from '@/hooks/useMeusEscritorios'
import { uploadEscritorioLogoPublic } from '@/lib/branding/upload'
import { ContaBrandingForm } from '@/components/configuracoes/ContaBrandingForm'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Settings, Kanban, User, Users, Link2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { GoogleCalendarioSettings } from '@/components/configuracoes/GoogleCalendarioSettings'
import { cn } from '@/lib/utils'
import { KanbanSettings } from '@/components/configuracoes/KanbanSettings'
import { EquipeSettings } from '@/components/configuracoes/EquipeSettings'
import { Button, Input, Label, FormError } from '@/components/ui'

const schema = z.object({
  nome:        z.string().min(2, 'Nome obrigatório'),
  oab:         z.string().optional(),
  telefone:    z.string().optional(),
  email:       z.string().email('Email inválido').optional().or(z.literal('')),
  meta_mensal: z.number().optional(),
})
type Form = z.infer<typeof schema>

const createSchema = z.object({
  nome:     z.string().min(2, 'Nome obrigatório'),
  oab:      z.string().optional(),
  telefone: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

const TABS = [
  { id: 'escritorio',   label: 'Escritório',   icon: Settings },
  { id: 'equipe',       label: 'Equipe',       icon: Users },
  { id: 'kanban',       label: 'Kanban',       icon: Kanban },
  { id: 'integracoes',  label: 'Integrações',  icon: Link2 },
  { id: 'conta',        label: 'Conta',        icon: User },
] as const
type TabId = typeof TABS[number]['id']

// ─── Aba Escritório ───────────────────────────────────────────────────────────
function EscritorioTab() {
  const { data: escritorio, isLoading, isError, error, refetch } = useEscritorio()
  const { data: listaEsc = [] } = useMeusEscritorios()
  const update     = useUpdateEscritorio()
  const createEsc  = useCreateEscritorio()
  const setAtivo   = useSetEscritorioAtivo()
  const fileLogoRef = useRef<HTMLInputElement>(null)
  const [logoUp, setLogoUp] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })
  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  useEffect(() => {
    if (escritorio) reset({
      nome: escritorio.nome, oab: escritorio.oab ?? '', telefone: escritorio.telefone ?? '',
      email: escritorio.email ?? '', meta_mensal: escritorio.meta_mensal,
    })
  }, [escritorio, reset])

  const onSubmit = async (data: Form) => {
    try {
      await update.mutateAsync({ nome: data.nome, oab: data.oab || null, telefone: data.telefone || null, email: data.email || null, meta_mensal: data.meta_mensal ?? 0 })
      toast.success('Configurações salvas!')
    } catch { toast.error('Erro ao salvar') }
  }

  const onCreateEscritorio = async (data: CreateForm) => {
    try {
      await createEsc.mutateAsync({ nome: data.nome, oab: data.oab || null, telefone: data.telefone || null })
      createForm.reset()
      toast.success('Escritório criado e ativado.')
    } catch { toast.error('Erro ao criar escritório') }
  }

  const onUploadLogo = async (f: File | null) => {
    if (!f?.size || !escritorio) return
    if (f.size > 2_000_000) {
      toast.error('Imagem até 2 MB')
      return
    }
    const supabase = createClient()
    setLogoUp(true)
    try {
      const url = await uploadEscritorioLogoPublic(supabase, escritorio.id, f)
      await update.mutateAsync({ logo_url: url })
      toast.success('Logomarca atualizada')
    } catch (e) {
      console.error(e)
      toast.error('Falha no upload da logomarca')
    } finally {
      setLogoUp(false)
      if (fileLogoRef.current) fileLogoRef.current.value = ''
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><OmniSpinner size="md" /></div>

  if (isError) return (
    <div className="omni-card omni-card-body border-destructive/30 bg-destructive/5 text-sm">
      <p className="text-destructive font-medium mb-2">Não foi possível carregar o escritório.</p>
      <p className="text-muted-foreground mb-4">{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      <Button size="sm" onClick={() => refetch()}>Tentar novamente</Button>
    </div>
  )

  if (!escritorio) return (
    <div className="omni-card omni-card-body">
      <h2 className="text-base font-semibold text-foreground mb-1">Criar escritório</h2>
      <p className="text-sm text-muted-foreground mb-5">Necessário para usar o Kanban e os cadastros. Depois disso, você pode criar mais escritórios e alternar o ativo a qualquer momento.</p>
      <form onSubmit={createForm.handleSubmit(onCreateEscritorio)} className="space-y-4 max-w-md">
        <div>
          <Label>Nome do escritório *</Label>
          <Input {...createForm.register('nome')} />
          <FormError>{createForm.formState.errors.nome?.message}</FormError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>OAB</Label>
            <Input {...createForm.register('oab')} placeholder="SP 123.456" />
          </div>
          <div>
            <Label>Telefone (WhatsApp)</Label>
            <Input {...createForm.register('telefone')} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Com Z-API no servidor, lembretes de prazos também chegam neste número.</p>
        <Button type="submit" loading={createEsc.isPending}>Criar escritório</Button>
      </form>
    </div>
  )

  return (
    <div className="space-y-5">
      {listaEsc.length > 1 && (
        <div className="omni-card omni-card-body">
          <h3 className="text-sm font-semibold text-foreground mb-2">Escritório ativo</h3>
          <p className="text-xs text-muted-foreground mb-3">Kanban, processos, clientes e finanças valem para o escritório selecionado.</p>
          <select
            className="w-full max-w-md text-sm border border-border rounded-lg px-3 py-2 bg-white"
            value={escritorio.id}
            onChange={e => { void setAtivo.mutateAsync(e.target.value) }}
            disabled={setAtivo.isPending}
          >
            {listaEsc.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
      )}

    <div className="omni-card omni-card-body">
      <h2 className="text-base font-semibold text-foreground mb-5">Dados do Escritório</h2>
      {escritorio && (
        <div className="mb-5 flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex items-center gap-3">
            {escritorio.logo_url ? (
              <img
                src={escritorio.logo_url}
                alt=""
                className="h-16 w-16 rounded-xl object-contain border border-border bg-white p-0.5"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-secondary border border-dashed border-border" />
            )}
            <div>
              <input
                ref={fileLogoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={e => { void onUploadLogo(e.target.files?.[0] ?? null) }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={logoUp}
                onClick={() => fileLogoRef.current?.click()}
              >
                {logoUp ? 'Enviando…' : 'Logomarca do escritório'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Aparece no menu e no cabeçalho.</p>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Nome do escritório *</Label>
          <Input {...register('nome')} />
          <FormError>{errors.nome?.message}</FormError>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>OAB</Label>
            <Input {...register('oab')} placeholder="SP 123.456" />
          </div>
          <div>
            <Label>Telefone (WhatsApp / lembretes)</Label>
            <Input {...register('telefone')} placeholder="(11) 99999-9999" />
            <p className="text-xs text-muted-foreground mt-1.5">Com Z-API, o cron envia o resumo de prazos por WhatsApp (DDI 55).</p>
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input {...register('email')} type="email" />
          <FormError>{errors.email?.message}</FormError>
          <p className="text-xs text-muted-foreground mt-1.5">Lembretes de prazos por e-mail (Resend), se configurado.</p>
        </div>
        <div>
          <Label>Meta mensal (R$)</Label>
          <Input {...register('meta_mensal', { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" />
        </div>
        <Button type="submit" className="w-full mt-2" loading={update.isPending}>
          Salvar alterações
        </Button>
      </form>
    </div>

    <div className="omni-card omni-card-body">
      <h3 className="text-sm font-semibold text-foreground mb-1">Novo escritório</h3>
      <p className="text-xs text-muted-foreground mb-4">Cada escritório tem etapas do Kanban e equipe próprias.</p>
      <form onSubmit={createForm.handleSubmit(onCreateEscritorio)} className="space-y-3 max-w-md">
        <div>
          <Label>Nome *</Label>
          <Input {...createForm.register('nome')} />
          <FormError>{createForm.formState.errors.nome?.message}</FormError>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>OAB</Label>
            <Input {...createForm.register('oab')} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input {...createForm.register('telefone')} />
          </div>
        </div>
        <Button type="submit" size="sm" loading={createEsc.isPending}>
          Criar e ativar
        </Button>
      </form>
    </div>
    </div>
  )
}

// ─── Aba Conta ────────────────────────────────────────────────────────────────
function ContaTab() {
  return (
    <div className="omni-card omni-card-body">
      <h2 className="text-base font-semibold text-foreground mb-4">Conta</h2>
      <ContaBrandingForm />
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
function ConfiguracoesPageInner() {
  const sp = useSearchParams()
  const [tab, setTab] = useState<TabId>('escritorio')

  useEffect(() => {
    const t = sp.get('tab') as TabId | null
    if (t && TABS.some(x => x.id === t)) setTab(t)
  }, [sp])

  return (
    <div className="max-w-2xl page-enter">
      <h1 className="sr-only">Configurações</h1>
      <p className="text-xs text-muted-foreground mb-4">Preferências do escritório e da conta</p>

      {/* Tabs — pill style */}
      <div className="flex gap-1 bg-secondary p-1 rounded-xl mb-6 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                const u = new URL(window.location.href)
                u.searchParams.set('tab', t.id)
                window.history.replaceState({}, '', u.pathname + u.search)
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'escritorio' && <EscritorioTab />}
      {tab === 'equipe'     && <EquipeSettings />}
      {tab === 'kanban'     && <KanbanSettings />}
      {tab === 'integracoes' && <GoogleCalendarioSettings />}
      {tab === 'conta'      && <ContaTab />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={(
      <div className="max-w-2xl page-enter flex justify-center py-12">
        <OmniSpinner size="md" />
      </div>
    )}
    >
      <ConfiguracoesPageInner />
    </Suspense>
  )
}
