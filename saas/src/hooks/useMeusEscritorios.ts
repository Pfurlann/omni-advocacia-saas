'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Escritorio } from '@/types/database'

/**
 * Todos os escritórios em que o usuário é dono ou membro ativo.
 */
export function useMeusEscritorios() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['meus-escritorios'],
    queryFn: async (): Promise<Escritorio[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: own, error: oErr } = await supabase.from('escritorios').select('*').eq('owner_id', user.id)
      if (oErr) throw oErr
      const { data: mem, error: mErr } = await supabase
        .from('escritorio_membros')
        .select('escritorio_id')
        .eq('user_id', user.id)
        .eq('ativo', true)
      if (mErr) throw mErr
      const set = new Map<string, Escritorio>()
      for (const e of (own ?? []) as Escritorio[]) {
        set.set(e.id, e)
      }
      const faltas = (mem ?? [])
        .map(r => r.escritorio_id as string)
        .filter(id => !set.has(id))
      if (faltas.length) {
        const { data: more, error: fErr } = await supabase
          .from('escritorios')
          .select('*')
          .in('id', faltas)
        if (fErr) throw fErr
        for (const e of (more ?? []) as Escritorio[]) {
          set.set(e.id, e)
        }
      }
      return [...set.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    staleTime: 60_000,
  })
}
