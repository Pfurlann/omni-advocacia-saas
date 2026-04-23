'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchEscritorioAtual, useEscritorio } from '@/hooks/useEscritorio'
import type { PapelEscritorio } from '@/types/database'

export interface MembroComNome {
  user_id: string
  papel: PapelEscritorio
  full_name: string | null
  avatar_url: string | null
}

export interface MeuPapelEscritorio {
  userId: string
  escritorioId: string | null
  /** Dono do escritório ou membro com papel gestor */
  isGestor: boolean
  papel: PapelEscritorio | null
}

export function useMeuPapelEscritorio() {
  return useQuery({
    queryKey: ['meu-papel-escritorio'],
    queryFn: async (): Promise<MeuPapelEscritorio | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const esc = await fetchEscritorioAtual(supabase)
      if (!esc) {
        return { userId: user.id, escritorioId: null, isGestor: false, papel: null }
      }
      if (esc.owner_id === user.id) {
        return {
          userId: user.id,
          escritorioId: esc.id,
          isGestor: true,
          papel: 'gestor',
        }
      }
      const { data: mem, error: memErr } = await supabase
        .from('escritorio_membros')
        .select('papel')
        .eq('escritorio_id', esc.id)
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle()
      if (memErr) throw memErr
      if (!mem) {
        return { userId: user.id, escritorioId: esc.id, isGestor: false, papel: null }
      }
      return {
        userId: user.id,
        escritorioId: esc.id,
        isGestor: mem.papel === 'gestor',
        papel: mem.papel as PapelEscritorio,
      }
    },
    staleTime: 60 * 1000,
  })
}

export function useEscritorioMembros() {
  const { data: escritorio } = useEscritorio()
  return useQuery({
    queryKey: ['escritorio-membros', escritorio?.id],
    queryFn: async (): Promise<MembroComNome[]> => {
      if (!escritorio) return []
      const res = await fetch('/api/escritorio/membros', { credentials: 'include' })
      const j = (await res.json()) as { membros?: MembroComNome[]; error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar equipe')
      return j.membros ?? []
    },
    enabled: !!escritorio,
    staleTime: 60 * 1000,
  })
}
