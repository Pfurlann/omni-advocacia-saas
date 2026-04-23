'use client'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateProcesso, useEtapasKanban } from '@/hooks/useProcessos'
import { useClientes } from '@/hooks/useClientes'
import { useEscritorio } from '@/hooks/useEscritorio'
import { useMeuPapelEscritorio, useEscritorioMembros } from '@/hooks/useEscritorioMembros'
import { useOpcoesCadastro, useOpcaoIdPorSlug } from '@/hooks/useOpcoesCadastro'
import { DATAJUD_TRIBUNAIS } from '@/lib/datajud/tribunais'
import { X } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'

const schema = z.object({
  titulo: z.string().min(3, 'Título obrigatório'),
  cliente_id: z.string().min(1, 'Cliente obrigatório'),
  etapa_id: z.string().min(1, 'Etapa obrigatória'),
  area_id: z.string().min(1, 'Área obrigatória'),
  polo: z.string(),
  prioridade_id: z.string().min(1, 'Prioridade obrigatória'),
  numero_processo: z.string().optional(),
  vara_tribunal: z.string().optional(),
  valor_causa: z.number().optional(),
  descricao: z.string().optional(),
  datajud_tribunal_sigla: z.string().optional(),
  responsavel_id: z.string().optional(),
})
type Form = z.infer<typeof schema>

interface Props {
  etapaId?: string
  onClose: () => void
  onSuccess?: (id: string) => void
}

export function FormProcesso({ etapaId, onClose, onSuccess }: Props) {
  const { data: escritorio } = useEscritorio()
  const { data: etapas = [] } = useEtapasKanban()
  const { data: clientesData } = useClientes()
  const { data: me } = useMeuPapelEscritorio()
  const { data: membros = [] } = useEscritorioMembros()
  const createProcesso = useCreateProcesso()
  const { data: opcoes = [] } = useOpcoesCadastro()
  const opAreas = opcoes.filter(o => o.categoria === 'area' && o.ativo)
  const opPri = opcoes.filter(o => o.categoria === 'prioridade_processo' && o.ativo)
  const idCivil = useOpcaoIdPorSlug('area', 'civil', opcoes)
  const idP2 = useOpcaoIdPorSlug('prioridade_processo', 'p2', opcoes)

  const seededResponsavel = useRef(false)
  const seededListas = useRef(false)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { etapa_id: etapaId ?? etapas[0]?.id, polo: 'ativo', responsavel_id: '', area_id: '', prioridade_id: '' },
  })

  useEffect(() => {
    if (seededListas.current || !idCivil || !idP2) return
    seededListas.current = true
    setValue('area_id', idCivil)
    setValue('prioridade_id', idP2)
  }, [idCivil, idP2, setValue])

  useEffect(() => {
    if (seededResponsavel.current || !me?.isGestor || membros.length === 0) return
    seededResponsavel.current = true
    const first = membros.some(m => m.user_id === me.userId) ? me.userId! : membros[0].user_id
    setValue('responsavel_id', first)
  }, [me?.isGestor, me?.userId, membros, setValue])

  const onSubmit = async (data: Form) => {
    if (!escritorio || !me?.userId) return
    const responsavelId = me.isGestor ? (data.responsavel_id || '').trim() : me.userId
    if (me.isGestor && !responsavelId) {
      toast.error('Selecione o advogado responsável.')
      return
    }
    try {
      const result = await createProcesso.mutateAsync({
        ...data,
        escritorio_id: escritorio.id,
        responsavel_id: responsavelId,
        titulo: data.titulo,
        cliente_id: data.cliente_id,
        etapa_id: data.etapa_id,
        area_id: data.area_id,
        prioridade_id: data.prioridade_id,
        polo: data.polo as any,
        numero_processo: data.numero_processo || null,
        vara_tribunal: data.vara_tribunal || null,
        valor_causa: data.valor_causa || null,
        descricao: data.descricao || null,
        kanban_ordem: 0,
        comarca: null,
        fase_processual: null,
        valor_acordo: null,
        data_distribuicao: null,
        data_encerramento: null,
        arquivado: false,
        datajud_tribunal_sigla: data.datajud_tribunal_sigla || null,
        datajud_synced_at: null,
        datajud_sync_error: null,
      })
      toast.success('Processo criado!')
      onSuccess?.(result.id)
      onClose()
    } catch {
      toast.error('Erro ao criar processo')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">Novo Processo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
            <input {...register('titulo')} placeholder="Ação Trabalhista – João Silva" className="input" />
            {errors.titulo && <p className="err">{errors.titulo.message}</p>}
          </div>

          {me?.isGestor && membros.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Advogado responsável *</label>
              <select {...register('responsavel_id')} className="input">
                {membros.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name?.trim() || m.user_id.slice(0, 8) + '…'} ({m.papel === 'gestor' ? 'Gestor' : 'Advogado'})
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
              <select {...register('area_id')} className="input">
                <option value="">Selecione...</option>
                {opAreas.map(a => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
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
              <select {...register('prioridade_id')} className="input">
                <option value="">Selecione...</option>
                {opPri.map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Valor da causa</label>
              <input {...register('valor_causa', { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" className="input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Número do processo (CNJ)</label>
            <input {...register('numero_processo')} placeholder="20 dígitos — ex: 0000000-00.0000.0.00.0000" className="input" />
            <p className="text-xs text-muted-foreground/70 mt-1">Necessário para sincronizar movimentações no DataJud.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tribunal (DataJud)</label>
            <select {...register('datajud_tribunal_sigla')} className="input">
              <option value="">Opcional — escolha ao usar DataJud</option>
              {DATAJUD_TRIBUNAIS.map(t => (
                <option key={t.sigla} value={t.sigla}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Vara / Tribunal</label>
            <input {...register('vara_tribunal')} placeholder="1ª Vara do Trabalho de São Paulo" className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <textarea {...register('descricao')} rows={3} placeholder="Resumo do caso..." className="input resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary/60">
              Cancelar
            </button>
            <button type="submit" disabled={createProcesso.isPending} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {createProcesso.isPending && <OmniSpinner size="xs" variant="dark" />}
              Criar Processo
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`.input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.875rem; outline: none; } .input:focus { ring: 2px solid #1e3a5f; } .err { color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem; }`}</style>
    </div>
  )
}
