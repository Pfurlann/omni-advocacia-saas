'use client'
import { useMemo, useState } from 'react'
import { useDataJudAutoSync, useDataJudMovimentos } from '@/hooks/useDataJud'
import { useUpdateProcesso } from '@/hooks/useProcessos'
import { DATAJUD_TRIBUNAIS } from '@/lib/datajud/tribunais'
import { countCnjDigits } from '@/lib/datajud/normalize'
import { FILTRO_LABELS, type FiltroMovimentacao, passaNoFiltro } from '@/lib/datajud/categorize'
import { formatDate, formatDateRelative } from '@/lib/formatters'
import { Scale, AlertCircle } from 'lucide-react'
import { OmniSpinner } from '@/components/brand/OmniSpinner'
import type { Processo } from '@/types/database'

interface Props {
  processo: Processo
}

function Linkified({ text }: { text: string }) {
  const segments = text.split(/(https?:\/\/\S+)/g)
  return (
    <>
      {segments.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all hover:text-primary/80"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

const FILTROS: FiltroMovimentacao[] = ['todos', 'publicacoes', 'decisoes', 'arquivamento']

export function DataJudPanel({ processo }: Props) {
  const { data: movs = [], isLoading: loadingMovs } = useDataJudMovimentos(processo.id)
  const autoSync = useDataJudAutoSync(processo)
  const update = useUpdateProcesso()
  const [filtro, setFiltro] = useState<FiltroMovimentacao>('todos')

  const digitosCnj = countCnjDigits(processo.numero_processo)
  const cnjOk = digitosCnj === 20

  const filtradas = useMemo(() => {
    return movs.filter(m => passaNoFiltro(filtro, m.nome, m.complemento))
  }, [movs, filtro])

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Scale className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Tribunal (DataJud / CNJ)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Movimentações públicas da base nacional. A sincronização ocorre ao abrir esta ficha (e a cada alguns minutos se
              os dados estiverem desatualizados). Não substitui o sistema do tribunal.
            </p>
          </div>
        </div>
        {autoSync.isFetching && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            <OmniSpinner size="xs" variant="dark" />
            Sincronizando com o DataJud…
          </div>
        )}
        {autoSync.isError && (
          <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{autoSync.error instanceof Error ? autoSync.error.message : 'Erro ao sincronizar'}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3 bg-slate-50/50 border-b border-border">
        {processo.numero_processo && (
          <p className="text-xs text-muted-foreground">
            Dígitos no número do processo:{' '}
            <span className={cnjOk ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'}>
              {digitosCnj}/20
            </span>
            {!cnjOk && digitosCnj > 0 && (
              <span className="text-amber-800"> — ajuste o número CNJ no processo para sincronizar.</span>
            )}
          </p>
        )}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tribunal na API DataJud</label>
          <select
            value={processo.datajud_tribunal_sigla ?? ''}
            onChange={e => {
              const v = e.target.value || null
              update.mutate({ id: processo.id, datajud_tribunal_sigla: v })
            }}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Selecione o tribunal onde o processo tramita…</option>
            {DATAJUD_TRIBUNAIS.map(t => (
              <option key={t.sigla} value={t.sigla}>
                {t.nome} ({t.sigla})
              </option>
            ))}
          </select>
        </div>
        {processo.datajud_sync_error && !autoSync.isFetching && (
          <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{processo.datajud_sync_error}</span>
          </div>
        )}
        {processo.datajud_synced_at && (
          <p className="text-xs text-muted-foreground/70">
            Última sincronização: {formatDateRelative(processo.datajud_synced_at)} ({formatDate(processo.datajud_synced_at)})
          </p>
        )}
      </div>

      <div className="px-3 pt-3 border-b border-border flex flex-wrap gap-1.5">
        {FILTROS.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setFiltro(key)}
            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              filtro === key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-muted-foreground border-border hover:border-border'
            }`}
          >
            {FILTRO_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground/70 border-b border-border/40">
        Filtros por palavras-chave nos textos. O que não se encaixar aparece apenas em &quot;Tudo&quot;. Links nos complementos abrem
        em nova aba.
      </p>

      <div className="max-h-[420px] overflow-y-auto">
        {(loadingMovs || autoSync.isFetching) && movs.length === 0 && (
          <div className="flex justify-center py-10">
            <OmniSpinner size="md" />
          </div>
        )}
        {!loadingMovs && !autoSync.isFetching && filtradas.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground/70 text-center">
            {movs.length === 0
              ? 'Nenhuma movimentação importada. Informe o CNJ (20 dígitos) e o tribunal para sincronizar ao abrir o processo.'
              : filtro === 'todos'
                ? 'Nenhuma movimentação.'
                : `Nenhuma movimentação classificada como “${FILTRO_LABELS[filtro]}”. Veja em “Tudo” ou ajuste os termos na base do CNJ.`}
          </p>
        )}
        {filtradas.map(m => (
          <div key={m.id} className="p-4 border-b border-border/40 last:border-0 flex gap-3">
            <div className="w-px bg-slate-200 shrink-0 self-stretch min-h-[3rem]" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{m.nome}</span>
                {m.codigo && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">cód. {m.codigo}</span>
                )}
              </div>
              {m.complemento && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                  <Linkified text={m.complemento} />
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1.5">
                {m.ocorrido_em ? `${formatDate(m.ocorrido_em)} · ${formatDateRelative(m.ocorrido_em)}` : 'Sem data'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
