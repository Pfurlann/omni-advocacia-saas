/**
 * Classificação aproximada de movimentações DataJud para filtros na UI.
 * Baseada em termos comuns dos nomes/complementos (CNJ não expõe um “tipo” único uniforme).
 */

export type FiltroMovimentacao = 'todos' | 'publicacoes' | 'decisoes' | 'arquivamento'

const PUBLICACOES =
  /di[áa]rio|public|intim|notifica|cit(a[çc][ãa]o|cao)|edital|comunica|expedi|publica[çc][ãa]o/i
const DECISOES =
  /senten[çc]a|ac[óo]rd[ãa]o|julg|decis[ãa]o|tutela|liminar|homolog|acordo|transa[çc][ãa]o|recurso\s+provido|improvido|negad[oa]|parcial/i
const ARQUIVAMENTO =
  /arquiv|desarquiv|extin[çc][ãa]o|baixa|sobrest|remess|devolu[çc][ãa]o|tr[âa]nsito\s+em\s+julgado/i

export function classificarMovimentacao(nome: string, complemento: string | null): FiltroMovimentacao[] {
  const t = `${nome} ${complemento ?? ''}`
  const out: FiltroMovimentacao[] = []
  if (PUBLICACOES.test(t)) out.push('publicacoes')
  if (DECISOES.test(t)) out.push('decisoes')
  if (ARQUIVAMENTO.test(t)) out.push('arquivamento')
  return out
}

export function passaNoFiltro(
  filtro: FiltroMovimentacao,
  nome: string,
  complemento: string | null,
): boolean {
  if (filtro === 'todos') return true
  const cats = classificarMovimentacao(nome, complemento)
  if (cats.length === 0) return false
  return cats.includes(filtro)
}

export const FILTRO_LABELS: Record<FiltroMovimentacao, string> = {
  todos: 'Tudo',
  publicacoes: 'Publicações e intimações',
  decisoes: 'Decisões e acordos',
  arquivamento: 'Arquivamento e encerramento',
}
