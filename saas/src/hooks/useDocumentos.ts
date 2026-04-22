'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Documento, TipoDocumento } from '@/types/database'

export function useDocumentos(processoId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['documentos', processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Documento[]
    },
    enabled: !!processoId,
  })
}

export function useUploadDocumento(processoId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      file: File
      escritorioId: string
      tipo: TipoDocumento
      responsavelId: string
    }) => {
      const safeName = args.file.name.replace(/[^\w.\- ()\u00C0-\u024F]/g, '_').slice(0, 180)
      const path = `${args.escritorioId}/${processoId}/${crypto.randomUUID()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, args.file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      const { data: row, error: insErr } = await supabase
        .from('documentos')
        .insert({
          escritorio_id: args.escritorioId,
          processo_id: processoId,
          responsavel_id: args.responsavelId,
          cliente_id: null,
          tipo: args.tipo,
          nome: args.file.name,
          descricao: null,
          storage_path: path,
          mime_type: args.file.type || null,
          tamanho_bytes: args.file.size,
        })
        .select()
        .single()
      if (insErr) {
        await supabase.storage.from('documentos').remove([path])
        throw insErr
      }
      return row as Documento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos', processoId] })
      qc.invalidateQueries({ queryKey: ['processos', processoId] })
    },
  })
}

export function useDeleteDocumento(processoId: string) {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: Documento) => {
      const { error: stErr } = await supabase.storage.from('documentos').remove([doc.storage_path])
      if (stErr) throw stErr
      const { error } = await supabase.from('documentos').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos', processoId] })
      qc.invalidateQueries({ queryKey: ['processos', processoId] })
    },
  })
}

export function useDocumentoSignedUrl() {
  const supabase = createClient()
  return async (storagePath: string) => {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(storagePath, 120)
    if (error) throw error
    return data.signedUrl
  }
}
