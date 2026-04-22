'use client'

import { useState } from 'react'
import { useNotasFiscais, useUpsertNotaFiscal, useDeleteNotaFiscal } from '@/hooks/useNotasFiscais'
import { useEscritorio } from '@/hooks/useEscritorio'
import { useFiscalCfop } from '@/hooks/useFiscalCfop'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { Button, Input, Label, Select, Modal } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import type { TipoNotaFiscal } from '@/types/database'
import { cn } from '@/lib/utils'

const TABS: { k: TipoNotaFiscal; l: string }[] = [
  { k: 'entrada', l: 'Entradas' },
  { k: 'saida', l: 'Saída / faturamento' },
]

export default function NotasFiscaisPage() {
  const { data: esc } = useEscritorio()
  const [tab, setTab] = useState<TipoNotaFiscal>('entrada')
  const { data: notas = [], isLoading } = useNotasFiscais({ tipo: tab })
  const { data: cfops = [] } = useFiscalCfop()
  const upsert = useUpsertNotaFiscal()
  const del = useDeleteNotaFiscal()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    tipo: 'entrada' as TipoNotaFiscal,
    chave_nfe: '',
    numero: '',
    serie: '',
    participante_nome: '',
    participante_doc: '',
    data_emissao: new Date().toISOString().slice(0, 10),
    data_entrada_saida: '' as string,
    valor_total: 0,
    base_calculo: '' as string,
    total_tributos: '' as string,
    cfop_codigo: '',
    fiscal_cfop_id: '' as string,
    natureza: '',
    observacoes: '',
  })

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Notas fiscais</h1>
      <div>
        <p className="text-sm font-medium text-foreground">Notas fiscais de entrada e de saída</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Registe NF-e, NFS-e e documentos fiscais relevantes. O vínculo com <strong>CFOP</strong> reforça a trilha de auditoria; em fases
          futuras, é possível integrar importação e SPED. Integração e-mail ou API é roadmap.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {TABS.map(t => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              tab === t.k ? 'bg-primary text-primary-foreground' : 'bg-secondary',
            )}
          >
            {t.l}
          </button>
        ))}
        <Button className="ml-auto" size="sm" onClick={() => { setForm(f => ({ ...f, tipo: tab })); setOpen(true) }}>
          <Plus className="h-4 w-4" /> Registar nota
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <OmniSpinner size="sm" variant="dark" />
        </div>
      ) : notas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada registado neste separador.</p>
      ) : (
        <div className="omni-card p-0 overflow-x-auto">
          <table className="omni-table text-sm min-w-[720px]">
            <thead>
              <tr>
                <th>Data</th>
                <th>N.º / Série</th>
                <th>Parte</th>
                <th>CFOP</th>
                <th className="text-right">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notas.map(n => (
                <tr key={n.id}>
                  <td className="whitespace-nowrap">{formatDate(n.data_emissao)}</td>
                  <td>
                    {n.numero || '—'}
                    {n.serie ? <span className="text-muted-foreground"> s. {n.serie}</span> : null}
                    {n.chave_nfe && <p className="text-[9px] text-muted-foreground font-mono max-w-[160px] truncate" title={n.chave_nfe ?? ''}>{n.chave_nfe}</p>}
                  </td>
                  <td>
                    {n.participante_nome || '—'}
                    {n.participante_doc && <p className="text-xs text-muted-foreground">{n.participante_doc}</p>}
                  </td>
                  <td className="font-mono text-xs">{n.cfop_codigo || '—'}</td>
                  <td className="text-right font-medium">{formatCurrency(n.valor_total)}</td>
                  <td>
                    <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm('Excluir esta nota?')) return
                        try {
                          await del.mutateAsync(n.id)
                          toast.success('Registo excluído')
                        } catch {
                          toast.error('Falha ao excluir')
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {esc && open && (
        <Modal open={open} onClose={() => setOpen(false)} title="Registar nota fiscal">
          <form
            className="p-5 space-y-2 max-h-[80vh] overflow-y-auto"
            onSubmit={e => {
              e.preventDefault()
              if (!esc) return
              void (async () => {
                try {
                  await upsert.mutateAsync({
                    escritorioId: esc.id,
                    row: {
                      tipo: form.tipo,
                      chave_nfe: form.chave_nfe?.trim() || null,
                      numero: form.numero?.trim() || null,
                      serie: form.serie?.trim() || null,
                      participante_nome: form.participante_nome?.trim() || null,
                      participante_doc: form.participante_doc?.trim() || null,
                      data_emissao: form.data_emissao,
                      data_entrada_saida: form.data_entrada_saida || null,
                      valor_total: form.valor_total,
                      base_calculo: form.base_calculo ? Number(form.base_calculo) : null,
                      total_tributos: form.total_tributos ? Number(form.total_tributos) : null,
                      cfop_codigo: form.cfop_codigo?.replace(/\D/g, '').padStart(4, '0').slice(0, 4) || null,
                      fiscal_cfop_id: form.fiscal_cfop_id || null,
                      natureza: form.natureza || null,
                      observacoes: form.observacoes || null,
                      comprovante_url: null,
                      lancamento_id: null,
                    },
                  })
                  toast.success('Nota guardada')
                  setOpen(false)
                } catch {
                  toast.error('Falha ao guardar (verifica chave NFe, valor e data).')
                }
              })()
            }}
          >
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoNotaFiscal }))}>
                <option value="entrada">Entrada (compra / serviço tomado)</option>
                <option value="saida">Saída / faturamento</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data emissão *</Label>
                <Input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} required />
              </div>
              <div>
                <Label>Data entrada / saída</Label>
                <Input type="date" value={form.data_entrada_saida} onChange={e => setForm(f => ({ ...f, data_entrada_saida: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>N.º nota</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={form.serie} onChange={e => setForm(f => ({ ...f, serie: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Chave NFe (44 car.)</Label>
              <Input value={form.chave_nfe} onChange={e => setForm(f => ({ ...f, chave_nfe: e.target.value }))} maxLength={44} className="font-mono text-xs" />
            </div>
            <div>
              <Label>Emitente / destinatário (nome)</Label>
              <Input value={form.participante_nome} onChange={e => setForm(f => ({ ...f, participante_nome: e.target.value }))} />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <Input value={form.participante_doc} onChange={e => setForm(f => ({ ...f, participante_doc: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor total (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_total || ''} onChange={e => setForm(f => ({ ...f, valor_total: parseFloat(e.target.value) || 0 }))} required />
              </div>
              <div>
                <Label>CFOP (ou escolhe)</Label>
                <Input value={form.cfop_codigo} onChange={e => setForm(f => ({ ...f, cfop_codigo: e.target.value }))} placeholder="5.102" className="font-mono" />
              </div>
            </div>
            <div>
              <Label>CFOP cadastrado</Label>
              <Select value={form.fiscal_cfop_id} onChange={e => setForm(f => ({ ...f, fiscal_cfop_id: e.target.value }))}>
                <option value="">— Nenhum / ou informar acima</option>
                {cfops.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" loading={upsert.isPending}>Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
