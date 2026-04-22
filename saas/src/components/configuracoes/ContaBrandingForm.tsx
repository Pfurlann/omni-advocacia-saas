'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { uploadAvatarPublic } from '@/lib/branding/upload'
import { Button, Input, Label } from '@/components/ui'
import { User } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'

export function ContaBrandingForm() {
  const { data: profile, isLoading } = useProfile()
  const update = useUpdateProfile()
  const [nome, setNome] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (profile?.full_name != null) setNome(profile.full_name)
  }, [profile?.full_name])

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <OmniSpinner size="md" />
      </div>
    )
  }

  const onSaveNome = async () => {
    try {
      await update.mutateAsync({ full_name: nome.trim() || null })
      toast.success('Nome atualizado')
    } catch {
      toast.error('Não foi possível salvar')
    }
  }

  const onFoto = async (f: File | null) => {
    if (!f || !f.size) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sessão inválida')
      return
    }
    if (f.size > 2_000_000) {
      toast.error('Imagem até 2 MB')
      return
    }
    setSending(true)
    try {
      const url = await uploadAvatarPublic(supabase, user.id, f)
      await update.mutateAsync({ avatar_url: url })
      toast.success('Foto de perfil atualizada')
    } catch (e) {
      console.error(e)
      toast.error('Falha no upload. Verifique o bucket "branding" e as policies.')
    } finally {
      setSending(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover border border-border bg-muted"
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
              <User className="h-8 w-8" />
            </div>
          )}
          {sending && (
            <div className="absolute inset-0 rounded-2xl bg-background/60 flex items-center justify-center">
              <OmniSpinner size="md" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={e => { void onFoto(e.target.files?.[0] ?? null) }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
          >
            Alterar foto
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 2 MB.</p>
        </div>
      </div>

      <div>
        <Label>Nome exibido</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome"
            className="max-w-md"
          />
          <Button
            type="button"
            onClick={() => { void onSaveNome() }}
            loading={update.isPending}
            disabled={sending}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}
