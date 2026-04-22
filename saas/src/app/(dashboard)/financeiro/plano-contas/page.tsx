'use client'

import { useMemo, useState } from 'react'
import { usePlanoContas, useCreatePlanoConta, useDeletePlanoConta, useSeedPlanoSugerido } from '@/hooks/usePlanoContas'
import { useEscritorio } from '@/hooks/useEscritorio'
import { Plus, Sprout, Trash2 } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { Button, Label, Input, Select, Modal } from '@/components/ui'
import { toast } from 'sonner'
import type { TipoDfc, TipoLancamento } from '@/types/database'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const DFC_L: Record<TipoDfc, string> = {
  operacional: 'Operacional',
  investimento: 'Investimento',
  financiamento: 'Financiamento',
}

function depthFromCodigo(codigo: string) {
  return codigo.split('.').length - 1
}

export default function PlanoContasPage() {
  const { data: escritorio } = useEscritorio()
  const { data: contas = [], isLoading, refetch } = usePlanoContas()
  const seed = useSeedPlanoSugerido()
  const deletar = useDeletePlanoConta()
  const criar = useCreatePlanoConta()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    parentId: '' as string,
    codigo: '',
    nome: '',
    e_sintetica: 'analitica' as 'analitica' | 'sintetica',
    tipo_razao: 'receita' as TipoLancamento,
    natureza_dfc: 'operacional' as TipoDfc,
  })

  const { data: childCount = {} } = useQuery({
    queryKey: ['plano-children', contas.length],
    enabled: contas.length > 0,
    queryFn: async () => {
      const supabase = createClient()
      const map: Record<string, number> = {}
      for (const c of contas) {
        const { count } = await supabase
          .from('plano_contas')
          .select('id', { count: 'exact', head: true })
          .eq('parent_id', c.id)
        map[c.id] = count ?? 0
      }
      return map
    },
  })

  const parents = useMemo(
    () => contas.filter(c => c.e_sintetica).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [contas],
  )

  const ordered = useMemo(
    () => [...contas].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })),
    [contas],
  )

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Plano de contas</h1>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Plano de contas analítico e sintético</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Mapeia lançamentos e alimenta a DFC. Contas <strong>analíticas</strong> têm natureza (receita/despesa) e
            grupo DFC; as <strong>sintéticas</strong> servem de agrupamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!escritorio || seed.isPending || contas.length > 0}
            onClick={async () => {
              if (!escritorio) return
              try {
                await seed.mutateAsync(escritorio.id)
                toast.success('Plano sugerido criado.')
                await refetch()
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Não foi possível criar o plano (já existem contas ou erro de rede).')
              }
            }}
          >
            <Sprout className="h-4 w-4" />
            {contas.length ? 'Plano já criado' : 'Criar plano sugerido'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)} disabled={!escritorio}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <OmniSpinner size="lg" />
        </div>
      ) : contas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Sem contas. Use o plano sugerido ou crie a primeira conta analítica.</p>
      ) : (
        <div className="omni-card p-0 overflow-hidden">
          <table className="omni-table text-sm">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>DFC</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordered.map(p => {
                const pad = 10 + Math.min(24, depthFromCodigo(p.codigo) * 12)
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs whitespace-nowrap" style={{ paddingLeft: pad }}>
                      {p.codigo}
                    </td>
                    <td>
                      {p.nome}
                      {!p.ativo && <span className="ml-2 text-xs text-amber-600">(inativa)</span>}
                    </td>
                    <td>
                      {p.e_sintetica ? <span className="text-muted-foreground">Sintética</span> : p.tipo_razao}
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {p.e_sintetica || !p.natureza_dfc ? '—' : (DFC_L[p.natureza_dfc] ?? p.natureza_dfc)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30"
                        disabled={deletar.isPending || (childCount[p.id] ?? 0) > 0}
                        title={(childCount[p.id] ?? 0) > 0 ? 'Remova as contas filhas primeiro' : 'Excluir'}
                        onClick={async () => {
                          if (!confirm('Excluir esta conta?')) return
                          try {
                            await deletar.mutateAsync(p.id)
                            toast.success('Conta excluída')
                          } catch {
                            toast.error('Não foi possível excluir (pode ter lançamentos vinculados).')
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {escritorio && showAdd && (
        <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nova conta">
          <form
            className="p-5 space-y-3"
            onSubmit={e => {
              e.preventDefault()
              if (!escritorio) return
              const e_sintetica = form.e_sintetica === 'sintetica'
              const parent_id = form.parentId || null
              void (async () => {
                try {
                  await criar.mutateAsync({
                    escritorioId: escritorio.id,
                    parent_id,
                    codigo: form.codigo,
                    nome: form.nome,
                    e_sintetica,
                    tipo_razao: e_sintetica ? null : form.tipo_razao,
                    natureza_dfc: e_sintetica ? null : form.natureza_dfc,
                  })
                  toast.success('Conta criada')
                  setShowAdd(false)
                  setForm(f => ({ ...f, codigo: '', nome: '' }))
                } catch {
                  toast.error('Código em duplicado ou dados inválidos')
                }
              })()
            }}
          >
            <div>
              <Label>Conta pai (opcional)</Label>
              <Select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">Nenhum (raiz)</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Código *</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} required placeholder="1.3" />
              </div>
              <div>
                <Label>Natureza da conta *</Label>
                <Select value={form.e_sintetica} onChange={e => setForm(f => ({ ...f, e_sintetica: e.target.value as 'analitica' | 'sintetica' }))}>
                  <option value="analitica">Analítica (movimento)</option>
                  <option value="sintetica">Sintética (grupo)</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
            </div>
            {form.e_sintetica === 'analitica' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Receita ou despesa *</Label>
                  <Select value={form.tipo_razao} onChange={e => setForm(f => ({ ...f, tipo_razao: e.target.value as TipoLancamento }))}>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </Select>
                </div>
                <div>
                  <Label>Grupo DFC (CPC 03) *</Label>
                  <Select value={form.natureza_dfc} onChange={e => setForm(f => ({ ...f, natureza_dfc: e.target.value as TipoDfc }))}>
                    {(Object.keys(DFC_L) as TipoDfc[]).map(k => (
                      <option key={k} value={k}>{DFC_L[k]}</option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAdd(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" loading={criar.isPending}>Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
