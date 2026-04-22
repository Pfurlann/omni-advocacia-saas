'use client'
import { useState } from 'react'
import { useEscritorio } from '@/hooks/useEscritorio'
import { useEscritorioMembros, useMeuPapelEscritorio } from '@/hooks/useEscritorioMembros'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, UserPlus, Trash2, Link2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

type MembrosPostOk = {
  ok?: boolean
  error?: string
  access_link?: string
  created?: boolean
  linked_existing?: boolean
}

export function EquipeSettings() {
  const qc = useQueryClient()
  const { data: escritorio, isLoading: loadingEsc } = useEscritorio()
  const { data: me } = useMeuPapelEscritorio()
  const { data: membros = [], isLoading: loadingMem } = useEscritorioMembros()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [papel, setPapel] = useState<'advogado' | 'gestor'>('advogado')
  const [creating, setCreating] = useState(false)

  const [linkEmail, setLinkEmail] = useState('')
  const [linkPapel, setLinkPapel] = useState<'advogado' | 'gestor'>('advogado')
  const [linking, setLinking] = useState(false)

  const [removing, setRemoving] = useState<string | null>(null)

  const isGestor = me?.isGestor ?? false

  const criarMembro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) return
    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      toast.error('As senhas não coincidem.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/escritorio/membros', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          email: email.trim(),
          full_name: fullName.trim(),
          password,
          papel,
        }),
      })
      let payload: MembrosPostOk = {}
      try {
        payload = (await res.json()) as MembrosPostOk
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error(payload.error ?? `Falha (${res.status})`)

      toast.success(
        'Acesso criado. No Entrar, use o e-mail em minúsculas e a mesma senha definida aqui.',
        { duration: 10_000 },
      )
      setFullName('')
      setEmail('')
      setPassword('')
      setPasswordConfirm('')
      await qc.invalidateQueries({ queryKey: ['escritorio-membros'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar membro')
    } finally {
      setCreating(false)
    }
  }

  const vincularExistente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkEmail.trim()) return
    setLinking(true)
    try {
      const res = await fetch('/api/escritorio/membros', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'link_existing',
          email: linkEmail.trim(),
          papel: linkPapel,
        }),
      })
      let payload: MembrosPostOk = {}
      try {
        payload = (await res.json()) as MembrosPostOk
      } catch {
        /* ignore */
      }
      if (!res.ok) throw new Error(payload.error ?? `Falha (${res.status})`)

      if (payload.access_link) {
        try {
          await navigator.clipboard.writeText(payload.access_link)
          toast.success(
            'Conta vinculada. Link de acesso copiado — envie ao colega (login sem depender de e-mail).',
            { duration: 9000 },
          )
        } catch {
          toast.message('Copie o link manualmente', {
            description: payload.access_link,
            duration: 25_000,
          })
        }
      } else {
        toast.success('Conta vinculada. O membro pode usar Entrar com o e-mail e senha que já tinha.')
      }
      setLinkEmail('')
      await qc.invalidateQueries({ queryKey: ['escritorio-membros'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular')
    } finally {
      setLinking(false)
    }
  }

  const remover = async (userId: string) => {
    if (userId === me?.userId) {
      toast.error('Remova outro gestor para sair da equipe, ou peça transferência.')
      return
    }
    setRemoving(userId)
    try {
      const res = await fetch(`/api/escritorio/membros?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Falha')
      toast.success('Membro removido.')
      await qc.invalidateQueries({ queryKey: ['escritorio-membros'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setRemoving(null)
    }
  }

  if (loadingEsc || !escritorio) {
    return (
      <div className="flex justify-center py-12">
        <OmniSpinner size="md" />
      </div>
    )
  }

  if (!isGestor) {
    return (
      <div className="bg-white rounded-xl border border-border p-6">
        <h2 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Equipe
        </h2>
        <p className="text-sm text-muted-foreground">
          Apenas gestores convidam ou removem membros. Você acessa os processos em que é responsável.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-8">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Equipe
        </h2>
        <p className="text-sm text-muted-foreground">
          Crie o acesso aqui com nome, e-mail, senha e papel. Não é necessário enviar e-mail: o membro usa a tela de{' '}
          <strong className="font-medium text-foreground">Entrar</strong> com essas credenciais.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Novo membro
        </h3>
        <form onSubmit={criarMembro} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome completo *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="advogado@escritorio.com"
              autoComplete="off"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Senha * (mín. 8)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Confirmar senha *</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={8}
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-foreground mb-1">Papel *</label>
            <select
              value={papel}
              onChange={e => setPapel(e.target.value as 'advogado' | 'gestor')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="advogado">Advogado</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <OmniSpinner size="xs" variant="dark" /> : <UserPlus className="h-4 w-4" />}
            Criar acesso
          </button>
        </form>
      </section>

      <section className="space-y-4 pt-2 border-t border-border">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Vincular conta que já existe
        </h3>
        <p className="text-xs text-muted-foreground max-w-lg">
          Use quando o advogado já tiver cadastro neste projeto Supabase. Nenhum e-mail é enviado; geramos um link de
          acesso para você repassar, se possível.
        </p>
        <form onSubmit={vincularExistente} className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-2xl">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-1">E-mail já cadastrado</label>
            <input
              type="email"
              value={linkEmail}
              onChange={e => setLinkEmail(e.target.value)}
              placeholder="mesmo@email.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-sm font-medium text-foreground mb-1">Papel</label>
            <select
              value={linkPapel}
              onChange={e => setLinkPapel(e.target.value as 'advogado' | 'gestor')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="advogado">Advogado</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={linking || !linkEmail.trim()}
            className="inline-flex items-center justify-center gap-2 border border-border bg-white text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 disabled:opacity-50"
          >
            {linking ? <OmniSpinner size="xs" variant="dark" /> : <Link2 className="h-4 w-4" />}
            Vincular
          </button>
        </form>
      </section>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Membros ativos</h3>
        {loadingMem ? (
          <OmniSpinner size="sm" variant="dark" />
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {membros.map(m => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex items-center gap-2.5">
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-secondary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {m.full_name?.trim() || m.user_id.slice(0, 8) + '…'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{m.papel === 'gestor' ? 'Gestor' : 'Advogado'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remover(m.user_id)}
                  disabled={removing === m.user_id || m.user_id === escritorio.owner_id}
                  className="p-2 rounded-lg text-muted-foreground/70 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                  title={m.user_id === escritorio.owner_id ? 'Dono do escritório' : 'Remover'}
                >
                  {removing === m.user_id ? (
                    <OmniSpinner size="xs" variant="dark" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
