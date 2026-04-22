import type { CategoriaLancamento, Lancamento, StatusLancamento } from '@/types/database'

function adicionarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function gerarLancamentosAcordoParcelado(params: {
  acordoGrupoId: string
  escritorioId: string
  clienteId: string
  processoId: string | null
  numeroExibicao: string | null
  temEntrada: boolean
  valorEntrada: number
  dataEntrada: string
  qtdParcelas: number
  valorParcela: number
  dataPrimeiraParcela: string
  intervaloDias: number
  status: StatusLancamento
}): Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>[] {
  const {
    acordoGrupoId,
    escritorioId,
    clienteId,
    processoId,
    numeroExibicao,
    temEntrada,
    valorEntrada,
    dataEntrada,
    qtdParcelas,
    valorParcela,
    dataPrimeiraParcela,
    intervaloDias,
    status,
  } = params

  const ref = numeroExibicao?.trim() || 's/ nº'
  const baseObs = 'Gerado a partir de acordo parcelado.'
  const categoria: CategoriaLancamento = 'acordo_parcelado'
  const rows: Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>[] = []

  if (temEntrada && valorEntrada > 0) {
    rows.push({
      escritorio_id: escritorioId,
      processo_id: processoId,
      cliente_id: clienteId,
      honorario_id: null,
      tipo: 'receita',
      categoria,
      descricao: `Acordo — Entrada — ${ref}`,
      valor: valorEntrada,
      data_vencimento: dataEntrada,
      data_competencia: dataEntrada,
      data_pagamento: null,
      status,
      forma_pagamento: null,
      comprovante_url: null,
      observacoes: baseObs,
      acordo_grupo_id: acordoGrupoId,
      numero_processo_referencia: numeroExibicao?.trim() || null,
      parcela_numero: 0,
      plano_conta_id: null,
    })
  }

  for (let i = 0; i < qtdParcelas; i++) {
    const data = adicionarDias(dataPrimeiraParcela, i * intervaloDias)
    rows.push({
      escritorio_id: escritorioId,
      processo_id: processoId,
      cliente_id: clienteId,
      honorario_id: null,
      tipo: 'receita',
      categoria,
      descricao: `Acordo — Parcela ${i + 1}/${qtdParcelas} — ${ref}`,
      valor: valorParcela,
      data_vencimento: data,
      data_competencia: data,
      data_pagamento: null,
      status,
      forma_pagamento: null,
      comprovante_url: null,
      observacoes: baseObs,
      acordo_grupo_id: acordoGrupoId,
      numero_processo_referencia: numeroExibicao?.trim() || null,
      parcela_numero: i + 1,
      plano_conta_id: null,
    })
  }

  return rows
}
