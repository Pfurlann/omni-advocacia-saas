import type { EtapaKanban, ProcessoComCliente } from '@/types/database'
import { arrayMove } from '@dnd-kit/sortable'
import { pointerWithin, type CollisionDetection, closestCorners } from '@dnd-kit/core'

/**
 * dnd: priorizar onde o ponteiro está (colunas rolagem horizontal); depois o canto mais próximo.
 * Evita retângulo que perde a coluna certa.
 */
export const colisaoKanban: CollisionDetection = args => {
  const a = pointerWithin(args)
  if (a.length) return a
  return closestCorners(args)
}

/**
 * Reinsere o card arrastado na lista plana, já ordenada por etapa.ordem + kanban.
 */
export function inserirProcessoAposMover(
  base: ProcessoComCliente[],
  activeId: string,
  overId: string,
  targetEtapaId: string,
  isOverColumn: boolean,
  etapas: EtapaKanban[],
): ProcessoComCliente[] {
  const fromIdx = base.findIndex(p => p.id === activeId)
  if (fromIdx < 0) return base
  const ativo = base[fromIdx]
  const sem = base.filter((_, i) => i !== fromIdx)
  const movido: ProcessoComCliente = { ...ativo, etapa_id: targetEtapaId }

  if (isOverColumn) {
    const aindaNessaColuna = sem.some(p => p.etapa_id === targetEtapaId)
    let insertAt: number
    if (aindaNessaColuna) {
      let last = -1
      for (let i = 0; i < sem.length; i++) {
        if (sem[i].etapa_id === targetEtapaId) last = i
      }
      insertAt = last + 1
    } else {
      const te = etapas.find(e => e.id === targetEtapaId)
      const ordT = te?.ordem ?? 0
      insertAt = sem.findIndex(p => (etapas.find(e => e.id === p.etapa_id)?.ordem ?? 999) > ordT)
      if (insertAt < 0) insertAt = sem.length
    }
    const res = [...sem]
    res.splice(insertAt, 0, movido)
    return res
  }

  const alvoI = sem.findIndex(p => p.id === overId)
  if (alvoI < 0) return base
  const res = [...sem]
  res.splice(alvoI, 0, movido)
  return res
}

export function reordenarMesmaColuna(
  base: ProcessoComCliente[],
  activeId: string,
  overId: string,
): ProcessoComCliente[] {
  const oldIdx = base.findIndex(p => p.id === activeId)
  const newIdx = base.findIndex(p => p.id === overId)
  if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return base
  return arrayMove(base, oldIdx, newIdx)
}

/** Monta updates de etapa + kanban_ordem a partir do layout listado (igual ordem do board). */
export function layoutParaAtualizacoes(
  list: ProcessoComCliente[],
  etapas: EtapaKanban[],
): { id: string; etapa_id: string; kanban_ordem: number }[] {
  const out: { id: string; etapa_id: string; kanban_ordem: number }[] = []
  for (const e of etapas) {
    const naCol = list.filter(p => p.etapa_id === e.id)
    naCol.forEach((p, i) => {
      out.push({ id: p.id, etapa_id: e.id, kanban_ordem: i })
    })
  }
  return out
}

/** Coluna vazia / área da coluna: manda o card pro fim do bloco dessa etapa. */
export function moverParaFimDaColuna(
  base: ProcessoComCliente[],
  activeId: string,
  etapaId: string,
): ProcessoComCliente[] {
  const fromIdx = base.findIndex(p => p.id === activeId)
  if (fromIdx < 0) return base
  const m = { ...base[fromIdx] }
  if (m.etapa_id !== etapaId) {
    m.etapa_id = etapaId
  }
  const sem = base.filter((_, i) => i !== fromIdx)
  let last = -1
  for (let i = 0; i < sem.length; i++) {
    if (sem[i].etapa_id === etapaId) last = i
  }
  const res = [...sem]
  res.splice(last + 1, 0, m)
  return res
}
