/**
 * Cliente da API pública DataJud (CNJ).
 * @see https://datajud-wiki.cnj.jus.br/api-publica/acesso/
 */

const BASE = 'https://api-publica.datajud.cnj.jus.br'

export type DataJudMovimentoParsed = {
  codigo: string
  nome: string
  ocorrido_em: string | null
  complemento: string | null
  id_externo: string
}

function extractComplemento(m: Record<string, unknown>): string | null {
  const c = m.complemento
  if (typeof c === 'string') return c
  const ct = m.complementoTabelado
  if (ct && typeof ct === 'object' && ct !== null) {
    const o = ct as Record<string, unknown>
    const t = [o.descricao, o.nome, o.texto].find(x => typeof x === 'string' && (x as string).length)
    if (t) return t as string
  }
  const arr = m.complementosTabelados
  if (Array.isArray(arr) && arr.length > 0) {
    const parts = arr
      .map((x: unknown) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        return [o.descricao, o.nome, String(o.valor ?? '')].filter(Boolean).join(' — ')
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }
  return null
}

function parseMovimentos(source: Record<string, unknown>): DataJudMovimentoParsed[] {
  const raw = source.movimentos
  if (!Array.isArray(raw)) return []

  const out: DataJudMovimentoParsed[] = []
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i] as Record<string, unknown>
    const codigo = String(m.codigo ?? m.codigoNacional ?? '')
    const nome = String(m.nome ?? m.tipo ?? 'Movimentação')
    const dataRaw = m.dataHora ?? m.data_hora ?? m['dataHora']
    let ocorrido_em: string | null = null
    if (typeof dataRaw === 'string') {
      ocorrido_em = dataRaw
    }
    const complemento = extractComplemento(m)
    const idBase = [ocorrido_em, codigo, nome, complemento ?? '', i].join('|')
    const id_externo = simpleHash(idBase)
    out.push({ codigo, nome, ocorrido_em, complemento, id_externo })
  }
  return out
}

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
  return `dj_${Math.abs(h).toString(36)}_${s.length}`
}

export type DataJudSearchResult = {
  encontrado: boolean
  movimentos: DataJudMovimentoParsed[]
  tribunal: string
  raw_error?: string
}

export async function searchProcessoNoTribunal(params: {
  tribunalSigla: string
  numeroCnj20: string
  apiKey: string
}): Promise<DataJudSearchResult> {
  const sigla = params.tribunalSigla.toLowerCase().replace(/^api_publica_/, '')
  const url = `${BASE}/api_publica_${sigla}/_search`

  const body = {
    size: 5,
    query: {
      match: { numeroProcesso: params.numeroCnj20 },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `APIKey ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    return {
      encontrado: false,
      movimentos: [],
      tribunal: sigla,
      raw_error: text.slice(0, 500) || res.statusText,
    }
  }

  let json: { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    return { encontrado: false, movimentos: [], tribunal: sigla, raw_error: 'Resposta inválida da API' }
  }

  const first = json.hits?.hits?.[0]?._source
  if (!first) {
    return { encontrado: false, movimentos: [], tribunal: sigla }
  }

  const movimentos = parseMovimentos(first)
  return { encontrado: true, movimentos, tribunal: sigla }
}
