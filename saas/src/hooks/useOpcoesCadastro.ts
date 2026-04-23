'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CategoriaCadastro, OpcaoCadastro } from '@/types/database'

export function useOpcoesCadastro(categoria?: CategoriaCadastro) {
  return useQuery({
    queryKey: ['opcoes-cadastro', categoria ?? 'all'],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('opcoes_cadastro')
        .select('*')
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true })
      if (categoria) q = q.eq('categoria', categoria)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as OpcaoCadastro[]
    },
    staleTime: 2 * 60_000,
  })
}

function slugifyBase(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'item'
}

export function useCreateOpcaoCadastro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      categoria: CategoriaCadastro
      rotulo: string
      cor?: string | null
      /** Se omitido, gera a partir do rótulo + sufixo se colidir. */
      slug?: string
    }) => {
      const supabase = createClient()
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) throw new Error('Não autenticado')
      const { data: me } = await supabase.from('profiles').select('active_escritorio_id').eq('id', u.user.id).single()
      const esc = (me as { active_escritorio_id: string | null } | null)?.active_escritorio_id
      if (!esc) throw new Error('Escritório não selecionado')
      const base = input.slug ? slugifyBase(input.slug) : slugifyBase(input.rotulo)
      const { data: exist } = await supabase
        .from('opcoes_cadastro')
        .select('slug')
        .eq('escritorio_id', esc)
        .eq('categoria', input.categoria)
      const slugs = new Set((exist ?? []).map((r: { slug: string }) => r.slug))
      let slug = base
      let n = 0
      while (slugs.has(slug)) {
        n += 1
        slug = `${base}_${n}`
      }
      const { data: maxRow } = await supabase
        .from('opcoes_cadastro')
        .select('ordem')
        .eq('escritorio_id', esc)
        .eq('categoria', input.categoria)
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle()
      const ordem = (maxRow as { ordem: number } | null)?.ordem != null ? (maxRow as { ordem: number }).ordem + 1 : 0
      const { data, error } = await supabase
        .from('opcoes_cadastro')
        .insert({
          escritorio_id: esc,
          categoria: input.categoria,
          slug,
          rotulo: input.rotulo.trim(),
          ordem,
          cor: input.cor ?? null,
          ativo: true,
        })
        .select()
        .single()
      if (error) throw error
      return data as OpcaoCadastro
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['opcoes-cadastro'] })
      void qc.invalidateQueries({ queryKey: ['processos'] })
      void qc.invalidateQueries({ queryKey: ['prazos'] })
    },
  })
}

export function useUpdateOpcaoCadastro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<OpcaoCadastro, 'rotulo' | 'ordem' | 'cor' | 'ativo'>> & { id: string }) => {
      const { id, ...rest } = patch
      const supabase = createClient()
      const { data, error } = await supabase
        .from('opcoes_cadastro')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as OpcaoCadastro
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['opcoes-cadastro'] })
      void qc.invalidateQueries({ queryKey: ['processos'] })
      void qc.invalidateQueries({ queryKey: ['prazos'] })
    },
  })
}

export function useDeleteOpcaoCadastro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('opcoes_cadastro').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['opcoes-cadastro'] })
      void qc.invalidateQueries({ queryKey: ['processos'] })
      void qc.invalidateQueries({ queryKey: ['prazos'] })
    },
  })
}

export function useOpcaoIdPorSlug(
  categoria: CategoriaCadastro,
  slug: string,
  lista: OpcaoCadastro[] | undefined,
): string | undefined {
  return lista?.find(o => o.categoria === categoria && o.slug === slug && o.ativo)?.id
}
