'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, StatusCliente } from '@/types/database'

interface ClientesFiltros {
  search?: string
  status?: StatusCliente
  page?: number
  pageSize?: number
}

export function useClientes(filtros: ClientesFiltros = {}) {
  const supabase = createClient()
  const { search, status, page = 1, pageSize = 20 } = filtros
  return useQuery({
    queryKey: ['clientes', filtros],
    queryFn: async () => {
      let q = supabase.from('clientes').select('*', { count: 'exact' }).order('nome')
      if (search?.trim()) {
        const t = search.trim()
        const digits = t.replace(/\D/g, '')
        const safe = t.replace(/%/g, '\\%').replace(/,/g, ' ')
        if (digits.length >= 3) {
          q = q.or(`nome.ilike.%${safe}%,cpf_cnpj.ilike.%${digits}%`)
        } else {
          q = q.ilike('nome', `%${safe}%`)
        }
      }
      if (status) q = q.eq('status', status)
      const from = (page - 1) * pageSize
      q = q.range(from, from + pageSize - 1)
      const { data, error, count } = await q
      if (error) throw error
      return { clientes: (data ?? []) as Cliente[], total: count ?? 0 }
    },
  })
}

export function useCliente(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single()
      if (error) throw error
      return data as Cliente
    },
    enabled: !!id,
  })
}

export function useCreateCliente() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('clientes').insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

export function useUpdateCliente() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Cliente> & { id: string }) => {
      const { data, error } = await supabase.from('clientes').update(values).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['clientes', vars.id] })
    },
  })
}
