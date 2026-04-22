'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Escritorio } from '@/types/database'

function isUniqueViolation(err: { code?: string; message?: string }) {
  return (
    err.code === '23505'
    || (err.message?.toLowerCase().includes('duplicate') ?? false)
    || (err.message?.toLowerCase().includes('unique') ?? false)
  )
}

/** Alinha à RLS (my_escritorio_id) com fallbacks se o RPC falhar ou retornar vazio. */
export async function fetchEscritorioAtual(supabase: SupabaseClient): Promise<Escritorio | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: escId, error: rpcErr } = await supabase.rpc('my_escritorio_id')
  if (!rpcErr && escId) {
    const { data, error } = await supabase.from('escritorios').select('*').eq('id', escId).single()
    if (!error && data) return data as Escritorio
  }

  const { data: owned, error: ownErr } = await supabase
    .from('escritorios')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!ownErr && owned) return owned as Escritorio

  const { data: visible, error: visErr } = await supabase.from('escritorios').select('*')
  if (visErr || !visible?.length) return null
  const asOwner = visible.find(r => r.owner_id === user.id)
  return (asOwner ?? visible[0]) as Escritorio
}

export function useCreateEscritorio() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Pick<Escritorio, 'nome'> & Partial<Pick<Escritorio, 'oab' | 'telefone'>>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const { data, error } = await supabase
        .from('escritorios')
        .insert({
          owner_id: user.id,
          nome: values.nome,
          oab: values.oab ?? null,
          telefone: values.telefone ?? null,
        })
        .select()
        .single()
      if (error) {
        if (isUniqueViolation(error)) {
          const existing = await fetchEscritorioAtual(supabase)
          if (existing) {
            qc.setQueryData(['escritorio'], existing)
            return existing
          }
        }
        throw error
      }
      return data as Escritorio
    },
    onSuccess: async (data) => {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (user) {
        await supa.from('profiles').update({ active_escritorio_id: data.id }).eq('id', user.id)
      }
      await qc.invalidateQueries({ queryKey: ['escritorio'] })
      await qc.invalidateQueries({ queryKey: ['meus-escritorios'] })
      await qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useEscritorio() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['escritorio'],
    queryFn: () => fetchEscritorioAtual(supabase),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateEscritorio() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Partial<Escritorio>) => {
      const esc = await fetchEscritorioAtual(supabase)
      if (!esc) throw new Error('Escritório não encontrado')
      const { data, error } = await supabase
        .from('escritorios')
        .update(values)
        .eq('id', esc.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['escritorio'] })
      qc.invalidateQueries({ queryKey: ['meu-papel-escritorio'] })
      qc.invalidateQueries({ queryKey: ['meus-escritorios'] })
    },
  })
}

/**
 * Alterna o escritório ativo (kanban, cadastros, RLS vía my_escritorio_id).
 */
export function useSetEscritorioAtivo() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (escritorioId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const { error } = await supabase
        .from('profiles')
        .update({ active_escritorio_id: escritorioId })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['escritorio'] }),
        qc.invalidateQueries({ queryKey: ['meu-papel-escritorio'] }),
        qc.invalidateQueries({ queryKey: ['etapas'] }),
        qc.invalidateQueries({ queryKey: ['processos'] }),
        qc.invalidateQueries({ queryKey: ['escritorio-membros'] }),
        qc.invalidateQueries({ queryKey: ['clientes'] }),
        qc.invalidateQueries({ queryKey: ['lancamentos'] }),
        qc.invalidateQueries({ queryKey: ['profile'] }),
        qc.invalidateQueries({ queryKey: ['prazos'] }),
        qc.invalidateQueries({ queryKey: ['meus-escritorios'] }),
      ])
    },
  })
}
