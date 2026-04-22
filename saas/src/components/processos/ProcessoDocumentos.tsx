'use client'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDocumentos, useUploadDocumento, useDeleteDocumento, useDocumentoSignedUrl } from '@/hooks/useDocumentos'
import { TIPO_DOCUMENTO_LABELS } from '@/lib/constants'
import type { Documento, TipoDocumento } from '@/types/database'
import { FileUp, Trash2, Download, PenLine, X } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import { formatDate } from '@/lib/formatters'

interface Props {
  processoId: string
  escritorioId: string
  responsavelId: string
}

export function ProcessoDocumentos({ processoId, escritorioId, responsavelId }: Props) {
  const qc = useQueryClient()
  const { data: docs = [], isLoading } = useDocumentos(processoId)
  const upload = useUploadDocumento(processoId)
  const remove = useDeleteDocumento(processoId)
  const getUrl = useDocumentoSignedUrl()
  const [tipo, setTipo] = useState<TipoDocumento>('outro')
  const [assinaturaDoc, setAssinaturaDoc] = useState<Documento | null>(null)
  const [sigForm, setSigForm] = useState({ nome: '', email: '', telefone: '' })
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await upload.mutateAsync({ file, escritorioId, tipo, responsavelId })
      toast.success('Arquivo enviado')
    } catch {
      toast.error('Falha no upload (confira o bucket Storage “documentos” no Supabase)')
    }
  }

  const baixar = async (d: Documento) => {
    try {
      const url = await getUrl(d.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Não foi possível gerar o link de download')
    }
  }

  const solicitarAssinatura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assinaturaDoc) return
    if (!sigForm.nome.trim() || !sigForm.email.trim()) {
      toast.error('Nome e e-mail do signatário são obrigatórios')
      return
    }
    setEnviandoAssinatura(true)
    try {
      const res = await fetch(`/api/documentos/${assinaturaDoc.id}/assinatura`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatario_nome: sigForm.nome.trim(),
          signatario_email: sigForm.email.trim(),
          signatario_telefone: sigForm.telefone.trim() || undefined,
        }),
      })
      const j = (await res.json()) as { error?: string; sign_url?: string | null }
      if (!res.ok) throw new Error(j.error ?? 'Falha')
      toast.success('Enviado à ZapSign. O signatário receberá o e-mail da plataforma.')
      await qc.invalidateQueries({ queryKey: ['documentos', processoId] })
      await qc.invalidateQueries({ queryKey: ['processos', processoId] })
      if (j.sign_url) {
        window.open(j.sign_url, '_blank', 'noopener,noreferrer')
      }
      setAssinaturaDoc(null)
      setSigForm({ nome: '', email: '', telefone: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar assinatura')
    } finally {
      setEnviandoAssinatura(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        PDFs podem ser enviados à <strong>ZapSign</strong> para assinatura (configure <code className="text-[10px]">ZAPSIGN_API_KEY</code> no servidor).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoDocumento)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white"
          >
            {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5">
          {upload.isPending ? <OmniSpinner size="xs" variant="dark" /> : <FileUp className="h-3.5 w-3.5" />}
          Enviar arquivo
          <input type="file" className="sr-only" onChange={onFile} disabled={upload.isPending} />
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <OmniSpinner size="md" />
        </div>
      )}
      {!isLoading && docs.length === 0 && (
        <p className="text-xs text-muted-foreground/70 text-center py-4">Nenhum documento neste processo.</p>
      )}
      <ul className="space-y-1.5">
        {docs.map(d => {
          const isPdf = (d.mime_type ?? '').toLowerCase().includes('pdf')
          return (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg border border-border hover:bg-secondary/60 group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-xs font-medium">{d.nome}</p>
                <p className="text-[10px] text-muted-foreground/70">
                  {TIPO_DOCUMENTO_LABELS[d.tipo] ?? d.tipo} · {formatDate(d.created_at)}
                  {d.tamanho_bytes != null && <> · {(d.tamanho_bytes / 1024).toFixed(1)} KB</>}
                </p>
                {d.assinatura_ref && (
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    ZapSign: {d.assinatura_status ?? '—'}
                    {d.assinatura_link && (
                      <>
                        {' · '}
                        <a href={d.assinatura_link} target="_blank" rel="noreferrer" className="underline">
                          abrir link
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {isPdf && !d.assinatura_ref && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssinaturaDoc(d)
                      setSigForm({ nome: '', email: '', telefone: '' })
                    }}
                    className="p-1.5 rounded text-primary hover:bg-primary/10"
                    title="Assinatura ZapSign"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => baixar(d)}
                  className="p-1.5 rounded text-muted-foreground/70 hover:text-primary"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Remover "${d.nome}"?`)) return
                    try {
                      await remove.mutateAsync(d)
                      toast.success('Documento removido')
                    } catch {
                      toast.error('Não foi possível excluir')
                    }
                  }}
                  className="p-1.5 rounded text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {assinaturaDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 relative">
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-secondary"
              onClick={() => setAssinaturaDoc(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <h4 className="text-sm font-semibold text-foreground pr-8">Assinatura ZapSign</h4>
            <p className="text-xs text-muted-foreground mt-1 mb-4 truncate">{assinaturaDoc.nome}</p>
            <form onSubmit={solicitarAssinatura} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome do signatário *</label>
                <input
                  value={sigForm.nome}
                  onChange={e => setSigForm(s => ({ ...s, nome: e.target.value }))}
                  className="mt-0.5 w-full text-sm border rounded-lg px-2 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">E-mail *</label>
                <input
                  type="email"
                  value={sigForm.email}
                  onChange={e => setSigForm(s => ({ ...s, email: e.target.value }))}
                  className="mt-0.5 w-full text-sm border rounded-lg px-2 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">WhatsApp (opcional, DDD+número)</label>
                <input
                  value={sigForm.telefone}
                  onChange={e => setSigForm(s => ({ ...s, telefone: e.target.value }))}
                  className="mt-0.5 w-full text-sm border rounded-lg px-2 py-1.5"
                  placeholder="11999999999"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAssinaturaDoc(null)} className="flex-1 text-xs border rounded-lg py-2">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoAssinatura}
                  className="flex-1 text-xs bg-primary text-white rounded-lg py-2 disabled:opacity-50 flex justify-center"
                >
                  {enviandoAssinatura ? <OmniSpinner size="xs" variant="dark" /> : 'Criar na ZapSign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
