'use client'
import { useState } from 'react'
import {
  useOpcoesCadastro,
  useCreateOpcaoCadastro,
  useUpdateOpcaoCadastro,
  useDeleteOpcaoCadastro,
} from '@/hooks/useOpcoesCadastro'
import { useMeuPapelEscritorio } from '@/hooks/useEscritorioMembros'
import type { CategoriaCadastro, OpcaoCadastro } from '@/types/database'
import { Button, Input, Label } from '@/components/ui'
import { toast } from 'sonner'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const GRUPO: Record<CategoriaCadastro, { titulo: string; desc: string; corPlaceholder: string }> = {
  area: {
    titulo: 'Áreas do direito',
    desc: 'Usadas no Kanban e no cadastro de processos. Cor em hex (#rrggbb) para o chip.',
    corPlaceholder: '#3b82f6',
  },
  prioridade_processo: {
    titulo: 'Prioridades (processo)',
    desc: 'Ex.: Alta / Normal / Baixa. A cor usa classes do design system (ex: badge-danger, badge-primary, badge-muted).',
    corPlaceholder: 'badge-primary',
  },
  tipo_prazo: {
    titulo: 'Tipos de prazo',
    desc: 'Classificação dos prazos (audiência, intimação, etc.).',
    corPlaceholder: '—',
  },
}

const ORDEM_CAT: CategoriaCadastro[] = ['area', 'prioridade_processo', 'tipo_prazo']

function BlocoCategoria({
  categoria,
  itens,
  canEdit,
  onAdd,
  onSave,
  onRemove,
  savingId,
  deletingId,
}: {
  categoria: CategoriaCadastro
  itens: OpcaoCadastro[]
  canEdit: boolean
  onAdd: (rotulo: string) => void
  onSave: (o: OpcaoCadastro) => void
  onRemove: (id: string) => void
  savingId: string | null
  deletingId: string | null
}) {
  const g = GRUPO[categoria]
  const [novo, setNovo] = useState('')

  return (
    <div className="omni-card omni-card-body space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{g.titulo}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
      </div>
      {canEdit && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={e => {
            e.preventDefault()
            if (!novo.trim()) return
            onAdd(novo.trim())
            setNovo('')
          }}
        >
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Novo item</Label>
            <Input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome exibido" />
          </div>
          <Button type="submit" size="sm" variant="secondary">Adicionar</Button>
        </form>
      )}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rótulo</th>
              <th className="px-3 py-2 w-20">Ordem</th>
              <th className="px-3 py-2">Cor / estilo</th>
              <th className="px-3 py-2 w-20">Ativo</th>
              {canEdit ? <th className="w-10" /> : null}
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhum item</td>
              </tr>
            )}
            {itens.map(o => (
              <LinhaOpcao
                key={o.id}
                o={o}
                canEdit={canEdit}
                onSave={onSave}
                onRemove={() => onRemove(o.id)}
                busy={savingId === o.id}
                removing={deletingId === o.id}
                corPlaceholder={g.corPlaceholder}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LinhaOpcao({
  o,
  canEdit,
  onSave,
  onRemove,
  busy,
  removing,
  corPlaceholder,
}: {
  o: OpcaoCadastro
  canEdit: boolean
  onSave: (o: OpcaoCadastro) => void
  onRemove: () => void
  busy: boolean
  removing: boolean
  corPlaceholder: string
}) {
  const [rotulo, setRotulo] = useState(o.rotulo)
  const [ordem, setOrdem]   = useState(String(o.ordem))
  const [cor, setCor]       = useState(o.cor ?? '')
  const [ativo, setAtivo]   = useState(o.ativo)
  if (!canEdit) {
    return (
      <tr key={o.id} className="border-t border-border">
        <td className="px-3 py-2">{o.rotulo}</td>
        <td className="px-3 py-2 font-mono text-xs">{o.ordem}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{o.cor || '—'}</td>
        <td className="px-3 py-2 text-xs">{o.ativo ? 'Sim' : 'Não'}</td>
      </tr>
    )
  }
  return (
    <tr key={o.id} className="border-t border-border">
      <td className="px-2 py-1.5">
        <input
          value={rotulo}
          onChange={e => setRotulo(e.target.value)}
          onBlur={() => { if (rotulo.trim() && rotulo !== o.rotulo) onSave({ ...o, rotulo: rotulo.trim() }) }}
          className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          value={ordem}
          onChange={e => setOrdem(e.target.value)}
          onBlur={() => {
            const n = parseInt(ordem, 10)
            if (!Number.isNaN(n) && n !== o.ordem) onSave({ ...o, ordem: n })
          }}
          className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={cor}
          onChange={e => setCor(e.target.value)}
          onBlur={() => { if (cor !== (o.cor ?? '')) onSave({ ...o, cor: cor || null }) }}
          className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background font-mono"
          placeholder={corPlaceholder}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={ativo}
          onChange={e => {
            setAtivo(e.target.checked)
            onSave({ ...o, ativo: e.target.checked })
          }}
        />
      </td>
      <td className="px-1 py-1.5 text-right">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy || removing}
          className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
          title="Remover (só se não estiver em uso)"
        >
          {removing ? <OmniSpinner size="xs" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </td>
    </tr>
  )
}

export function OpcoesCadastroSettings() {
  const { data: me } = useMeuPapelEscritorio()
  const { data: rows = [], isLoading } = useOpcoesCadastro()
  const create = useCreateOpcaoCadastro()
  const update = useUpdateOpcaoCadastro()
  const remove = useDeleteOpcaoCadastro()
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canEdit = me?.isGestor ?? false

  const byCat = (c: CategoriaCadastro) => rows.filter(r => r.categoria === c).sort((a, b) => a.ordem - b.ordem)

  const onSave = async (o: OpcaoCadastro) => {
    setSavingId(o.id)
      try {
        await update.mutateAsync({ id: o.id, rotulo: o.rotulo, ordem: o.ordem, cor: o.cor, ativo: o.ativo })
      } catch {
      toast.error('Não foi possível salvar')
    } finally {
      setSavingId(null)
    }
  }

  const onAdd = async (categoria: CategoriaCadastro, rotulo: string) => {
    try {
      await create.mutateAsync({ categoria, rotulo })
      toast.success('Item adicionado')
    } catch {
      toast.error('Erro ao adicionar')
    }
  }

  const onRemove = async (id: string) => {
    setDeletingId(id)
    try {
      await remove.mutateAsync(id)
      toast.success('Removido')
    } catch {
      toast.error('Não removido — pode estar vinculado a processo ou prazo')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><OmniSpinner size="md" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Listas do sistema</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Área do processo, prioridade e tipo de prazo passam a ser editáveis aqui. Valores padrão são criados com o escritório;
          gestores podem ajustar rótulos, ordem, cor e inativar itens.
        </p>
        {!canEdit && (
          <p className={cn('text-sm mt-2 text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2')}>
            Só o gestor do escritório altera estas listas. Você pode visualizar os itens.
          </p>
        )}
      </div>
      {ORDEM_CAT.map(cat => (
        <BlocoCategoria
          key={cat}
          categoria={cat}
          itens={byCat(cat)}
          canEdit={canEdit}
          onAdd={r => { void onAdd(cat, r) }}
          onSave={o => { void onSave(o) }}
          onRemove={id => { void onRemove(id) }}
          savingId={savingId}
          deletingId={deletingId}
        />
      ))}
    </div>
  )
}
