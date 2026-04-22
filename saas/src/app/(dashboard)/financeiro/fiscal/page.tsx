'use client'

import { useState } from 'react'
import { useFiscalCfop, useUpsertFiscalCfop, useDeleteFiscalCfop } from '@/hooks/useFiscalCfop'
import { usePlanoContas } from '@/hooks/usePlanoContas'
import { useEscritorio } from '@/hooks/useEscritorio'
import { Button, Input, Label, Select } from '@/components/ui'
import { Trash2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { toast } from 'sonner'
import type { TipoCfopMov } from '@/types/database'

const MOV: { v: TipoCfopMov; l: string }[] = [
  { v: 'entrada', l: 'Entrada' },
  { v: 'saida', l: 'Saída' },
  { v: 'ambos', l: 'Ambos' },
]

export default function FiscalCfopPage() {
  const { data: esc } = useEscritorio()
  const { data: cfops = [], isLoading } = useFiscalCfop()
  const { data: contas = [] } = usePlanoContas()
  const upsert = useUpsertFiscalCfop()
  const del = useDeleteFiscalCfop()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({
    codigo: '',
    descricao: '',
    tipo_mov: 'ambos' as TipoCfopMov,
    plano_conta_id: '' as string,
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="sr-only">Configuração de CFOP</h1>
      <div>
        <p className="text-sm font-medium text-foreground">CFOP — Classificação fiscal</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cadastre os CFOP que o escritório utiliza, com ligação opcional ao <strong>plano de contas</strong> para
          alimentar notas fiscais e conciliações. A tabela completa (SPED) é extensa: mantenha aqui o subconjunto relevante
          (compras, faturamento a clientes, serviços, etc.).
        </p>
      </div>

      <form
        className="omni-card p-4 space-y-3"
        onSubmit={e => {
          e.preventDefault()
          if (!esc) return
          void (async () => {
            try {
              await upsert.mutateAsync({
                id: editing ?? undefined,
                escritorioId: esc.id,
                codigo: form.codigo,
                descricao: form.descricao,
                tipo_mov: form.tipo_mov,
                plano_conta_id: form.plano_conta_id || null,
              })
              toast.success(editing ? 'Atualizado' : 'CFOP adicionado')
              setForm({ codigo: '', descricao: '', tipo_mov: 'ambos', plano_conta_id: '' })
              setEditing(null)
            } catch {
              toast.error('Código duplicado ou inválido (4 algarismos).')
            }
          })()
        }}
      >
        <p className="text-xs font-semibold text-foreground/90">Novo ou editar</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label>CFOP (4 dígitos) *</Label>
            <Input
              value={form.codigo}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
              maxLength={6}
              placeholder="5.102"
            />
          </div>
          <div>
            <Label>Deslocamento *</Label>
            <Select value={form.tipo_mov} onChange={e => setForm(f => ({ ...f, tipo_mov: e.target.value as TipoCfopMov }))}>
              {MOV.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label>Descrição (uso interno) *</Label>
          <Input
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex.: Aquisição de serviço de terceiros"
            required
          />
        </div>
        <div>
          <Label>Conta contábil sugerida (opcional)</Label>
          <Select value={form.plano_conta_id} onChange={e => setForm(f => ({ ...f, plano_conta_id: e.target.value }))}>
            <option value="">— Nenhum —</option>
            {contas
              .filter(c => !c.e_sintetica)
              .map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
              ))}
          </Select>
        </div>
        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm({ codigo: '', descricao: '', tipo_mov: 'ambos', plano_conta_id: '' }) }}>
              Cancelar edição
            </Button>
          )}
          <Button type="submit" loading={upsert.isPending}>{editing ? 'Atualizar' : 'Registar'}</Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <OmniSpinner size="sm" variant="dark" />
        </div>
      ) : (
        <div className="omni-card p-0 overflow-hidden">
          <table className="omni-table text-sm">
            <thead>
              <tr>
                <th>CFOP</th>
                <th>Descrição</th>
                <th>Mov.</th>
                <th>Conta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cfops.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Ainda sem CFOP configurados</td></tr>
              )}
              {cfops.map(c => (
                <tr key={c.id}>
                  <td className="font-mono font-medium">{c.codigo}</td>
                  <td>{c.descricao}</td>
                  <td className="text-xs">{c.tipo_mov}</td>
                  <td className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {c.plano_conta ? `${c.plano_conta.codigo} — ${c.plano_conta.nome}` : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditing(c.id)
                        setForm({ codigo: c.codigo, descricao: c.descricao, tipo_mov: c.tipo_mov, plano_conta_id: c.plano_conta_id ?? '' })
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm('Remover este CFOP?')) return
                        try {
                          await del.mutateAsync(c.id)
                          toast.success('Removido')
                        } catch {
                          toast.error('Não removido (pode estar em uso).')
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
    </div>
  )
}
