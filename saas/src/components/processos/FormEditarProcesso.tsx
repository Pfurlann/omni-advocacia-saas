'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useEtapasKanban, useUpdateProcesso } from '@/hooks/useProcessos'
import { useClientes } from '@/hooks/useClientes'
import { useMeuPapelEscritorio, useEscritorioMembros } from '@/hooks/useEscritorioMembros'
import { AREA_LABELS } from '@/lib/constants'
import { DATAJUD_TRIBUNAIS } from '@/lib/datajud/tribunais'
import type { AreaDireito, PoloCliente, Processo } from '@/types/database'
import { X } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

const schema = z.object({
  titulo: z.string().min(3, 'Título obrigatório'),
  cliente_id: z.string().min(1, 'Cliente obrigatório'),
  etapa_id: z.string().min(1, 'Etapa obrigatória'),
  area: z.string(),
  polo: z.string(),
  prioridade: z.number(),
  numero_processo: z.string().optional(),
  vara_tribunal: z.string().optional(),
  valor_causa: z.number().optional(),
  descricao: z.string().optional(),
  datajud_tribunal_sigla: z.string().optional(),
  responsavel_id: z.string().optional(),
})
type Form = z.infer<typeof schema>

type ProcessoEdit = Processo & { cliente?: { id: string; nome: string } | null }

interface Props {
  processo: ProcessoEdit
  open: boolean
  onClose: () => void
}

export function FormEditarProcesso({ processo, open, onClose }: Props) {
  const { data: etapas = [] } = useEtapasKanban()
  const { data: clientesData } = useClientes({ pageSize: 500 })
  const { data: me } = useMeuPapelEscritorio()
  const { data: membros = [] } = useEscritorioMembros()
  const updateProcesso = useUpdateProcesso()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!open) return
    reset({
      titulo: processo.titulo,
      cliente_id: processo.cliente_id,
      etapa_id: processo.etapa_id,
      area: processo.area,
      polo: processo.polo,
      prioridade: processo.prioridade,
      numero_processo: processo.numero_processo ?? '',
      vara_tribunal: processo.vara_tribunal ?? '',
      valor_causa: processo.valor_causa ?? undefined,
      descricao: processo.descricao ?? '',
      datajud_tribunal_sigla: processo.datajud_tribunal_sigla ?? '',
      responsavel_id: processo.responsavel_id,
    })
  }, [open, processo, reset])

  const onSubmit = async (data: Form) => {
    try {
      const payload: Parameters<typeof updateProcesso.mutateAsync>[0] = {
        id: processo.id,
        titulo: data.titulo,
        cliente_id: data.cliente_id,
        etapa_id: data.etapa_id,
        area: data.area as AreaDireito,
        polo: data.polo as PoloCliente,
        prioridade: data.prioridade as 1 | 2 | 3,
        numero_processo: data.numero_processo || null,
        vara_tribunal: data.vara_tribunal || null,
        valor_causa: data.valor_causa || null,
        descricao: data.descricao || null,
        datajud_tribunal_sigla: data.datajud_tribunal_sigla || null,
      }
      if (me?.isGestor && data.responsavel_id) {
        payload.responsavel_id = data.responsavel_id
      }
      await updateProcesso.mutateAsync(payload)
      toast.success('Processo atualizado!')
      onClose()
    } catch {
      toast.error('Erro ao salvar alterações')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">Editar processo</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input {...register('titulo')} className="input" />
            {errors.titulo && <p className="err">{errors.titulo.message}</p>}
          </div>

          {me?.isGestor && membros.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Advogado responsável</label>
              <select {...register('responsavel_id')} className="input">
                {membros.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name?.trim() || m.user_id.slice(0, 8) + '…'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cliente *</label>
              <select {...register('cliente_id')} className="input">
                <option value="">Selecione...</option>
                {clientesData?.clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              {errors.cliente_id && <p className="err">{errors.cliente_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Etapa *</label>
              <select {...register('etapa_id')} className="input">
                {etapas.map(e => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Área</label>
              <select {...register('area')} className="input">
                {Object.entries(AREA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Polo do cliente</label>
              <select {...register('polo')} className="input">
                <option value="ativo">Ativo (Autor)</option>
                <option value="passivo">Passivo (Réu)</option>
                <option value="terceiro">Terceiro</option>
                <option value="consulta">Consulta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Prioridade</label>
              <select {...register('prioridade', { valueAsNumber: true })} className="input">
                <option value={1}>Alta</option>
                <option value={2}>Normal</option>
                <option value={3}>Baixa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor da causa</label>
              <input {...register('valor_causa', { valueAsNumber: true })} type="number" step="0.01" className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Número do processo (CNJ)</label>
            <input {...register('numero_processo')} placeholder="20 dígitos" className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tribunal (DataJud)</label>
            <select {...register('datajud_tribunal_sigla')} className="input">
              <option value="">Opcional</option>
              {DATAJUD_TRIBUNAIS.map(t => (
                <option key={t.sigla} value={t.sigla}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Vara / Tribunal</label>
            <input {...register('vara_tribunal')} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <textarea {...register('descricao')} rows={3} className="input resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary/60">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateProcesso.isPending}
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updateProcesso.isPending && <OmniSpinner size="xs" variant="dark" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`.input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.875rem; outline: none; } .input:focus { ring: 2px solid #1e3a5f; } .err { color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem; }`}</style>
    </div>
  )
}
