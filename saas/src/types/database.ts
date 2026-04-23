export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Enums ───────────────────────────────────────────────────────────────────
export type TipoPessoa = 'PF' | 'PJ'
export type StatusCliente = 'ativo' | 'inativo' | 'prospecto'
export type PoloCliente = 'ativo' | 'passivo' | 'terceiro' | 'consulta'
/** Listas por escritório (Configurações → Listas) — slugs legados: civil, p1, prazo_interno, etc. */
export type CategoriaCadastro = 'area' | 'prioridade_processo' | 'tipo_prazo'
export type StatusPrazo = 'pendente' | 'concluido' | 'cancelado' | 'perdido'
export type StatusTarefa = 'todo' | 'in_progress' | 'done' | 'cancelada'
export type PrioridadeTarefa = 'alta' | 'normal' | 'baixa'
export type TipoDocumento = 'peticao' | 'contrato' | 'procuracao' | 'sentenca' | 'acordao' | 'despacho' | 'notificacao' | 'comprovante' | 'identidade' | 'outro'
export type TipoMovimentacao = 'nota_interna' | 'movimentacao_judicial' | 'comunicacao_cliente' | 'mudanca_etapa' | 'prazo_adicionado' | 'tarefa_concluida' | 'documento_adicionado' | 'honorario_recebido' | 'outro'
export type TipoHonorario = 'fixo_mensal' | 'por_ato' | 'exito' | 'consultoria' | 'outro'
export type StatusHonorario = 'ativo' | 'encerrado' | 'suspenso' | 'proposta'
export type TipoLancamento = 'receita' | 'despesa'
/** Agrupamento CPC 03 (DFC) em contas analíticas. */
export type TipoDfc = 'operacional' | 'investimento' | 'financiamento'
export type TipoCfopMov = 'entrada' | 'saida' | 'ambos'
export type TipoNotaFiscal = 'entrada' | 'saida'
export type StatusLancamento = 'pago' | 'pendente' | 'inadimplente' | 'cancelado'
export type CategoriaLancamento = 'honorario_fixo' | 'honorario_exito' | 'consultoria' | 'custas_processuais' | 'outros_receitas' | 'acordo_parcelado' | 'aluguel' | 'internet_telefone' | 'software' | 'marketing' | 'contador' | 'material_escritorio' | 'outros_despesas'
export type PapelEscritorio = 'gestor' | 'advogado'
/** Cadastro CRM/ERP: quem cobra, de quem compra, ou os dois. */
export type PapelErp = 'cliente' | 'fornecedor' | 'ambos'

export interface OpcaoCadastro {
  id: string
  escritorio_id: string
  categoria: CategoriaCadastro
  slug: string
  rotulo: string
  ordem: number
  cor: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

// ─── Tabelas base ─────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  active_escritorio_id: string | null
  created_at: string
  updated_at: string
}

export interface EscritorioMembro {
  id: string
  escritorio_id: string
  user_id: string
  papel: PapelEscritorio
  ativo: boolean
  created_at: string
}

export interface Escritorio {
  id: string
  owner_id: string
  nome: string
  oab: string | null
  telefone: string | null
  email: string | null
  logo_url: string | null
  meta_mensal: number
  cor_primaria: string
  created_at: string
  updated_at: string
}

export interface EtapaKanban {
  id: string
  escritorio_id: string
  nome: string
  cor: string
  ordem: number
  is_inicial: boolean
  is_final: boolean
  created_at: string
}

export interface Cliente {
  id: string
  escritorio_id: string
  nome: string
  tipo: TipoPessoa
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  status: StatusCliente
  /** Cliente, fornecedor ou ambos (ERP / contas). */
  papel_erp: PapelErp
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Processo {
  id: string
  escritorio_id: string
  /** Advogado responsável (visibilidade de processo/prazos para não gestores) */
  responsavel_id: string
  cliente_id: string
  etapa_id: string
  titulo: string
  numero_processo: string | null
  area_id: string
  prioridade_id: string
  polo: PoloCliente
  vara_tribunal: string | null
  comarca: string | null
  fase_processual: string | null
  valor_causa: number | null
  valor_acordo: number | null
  descricao: string | null
  kanban_ordem: number
  data_distribuicao: string | null
  data_encerramento: string | null
  arquivado: boolean
  /** Alias tribunal DataJud (CNJ), ex: tjsp, trt2 */
  datajud_tribunal_sigla: string | null
  datajud_synced_at: string | null
  datajud_sync_error: string | null
  created_at: string
  updated_at: string
}

/** Movimentações públicas cacheadas da API DataJud (CNJ) */
export interface DataJudMovimentacao {
  id: string
  escritorio_id: string
  processo_id: string
  ocorrido_em: string | null
  codigo: string | null
  nome: string
  complemento: string | null
  id_externo: string
  created_at: string
}

export interface Prazo {
  id: string
  escritorio_id: string
  responsavel_id: string
  processo_id: string | null
  titulo: string
  tipo_prazo_id: string
  data_prazo: string
  hora_prazo: string | null
  status: StatusPrazo
  alerta_dias: number
  descricao: string | null
  concluido_em: string | null
  /** Último dia em que o cron enviou lembrete por e-mail (evita duplicar no mesmo dia) */
  ultimo_lembrete_em: string | null
  /** Sincronização com Google Calendar (agenda do responsável) */
  google_event_id: string | null
  google_calendar_id: string | null
  google_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface Tarefa {
  id: string
  escritorio_id: string
  responsavel_id: string
  processo_id: string | null
  titulo: string
  descricao: string | null
  status: StatusTarefa
  prioridade: PrioridadeTarefa
  data_vencimento: string | null
  concluida_em: string | null
  created_at: string
  updated_at: string
}

export interface Documento {
  id: string
  escritorio_id: string
  responsavel_id: string
  processo_id: string | null
  cliente_id: string | null
  tipo: TipoDocumento
  nome: string
  descricao: string | null
  storage_path: string
  mime_type: string | null
  tamanho_bytes: number | null
  assinatura_provedor: string | null
  assinatura_ref: string | null
  assinatura_status: string | null
  assinatura_link: string | null
  assinatura_atualizado_em: string | null
  created_at: string
}

export interface Movimentacao {
  id: string
  escritorio_id: string
  processo_id: string
  tipo: TipoMovimentacao
  titulo: string | null
  conteudo: string | null
  metadata: Json
  criado_por: string | null
  created_at: string
}

export interface Honorario {
  id: string
  escritorio_id: string
  processo_id: string | null
  cliente_id: string
  descricao: string
  tipo: TipoHonorario
  valor: number
  percentual_exito: number | null
  data_inicio: string
  data_fim: string | null
  status: StatusHonorario
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface Lancamento {
  id: string
  escritorio_id: string
  processo_id: string | null
  cliente_id: string | null
  honorario_id: string | null
  tipo: TipoLancamento
  categoria: CategoriaLancamento
  descricao: string
  valor: number
  data_vencimento: string
  /** Competência contábil (DRE / gestão). Se nulo, usa-se o vencimento. */
  data_competencia: string | null
  data_pagamento: string | null
  status: StatusLancamento
  forma_pagamento: string | null
  comprovante_url: string | null
  observacoes: string | null
  acordo_grupo_id: string | null
  numero_processo_referencia: string | null
  /** Null: avulso. 0: entrada. ≥1: parcela */
  parcela_numero: number | null
  plano_conta_id: string | null
  created_at: string
  updated_at: string
}

export interface PlanoConta {
  id: string
  escritorio_id: string
  parent_id: string | null
  codigo: string
  nome: string
  descricao: string | null
  e_sintetica: boolean
  tipo_razao: TipoLancamento | null
  natureza_dfc: TipoDfc | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export interface FiscalCfop {
  id: string
  escritorio_id: string
  codigo: string
  descricao: string
  tipo_mov: TipoCfopMov
  plano_conta_id: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface NotaFiscal {
  id: string
  escritorio_id: string
  tipo: TipoNotaFiscal
  chave_nfe: string | null
  numero: string | null
  serie: string | null
  participante_nome: string | null
  participante_doc: string | null
  data_emissao: string
  data_entrada_saida: string | null
  valor_total: number
  base_calculo: number | null
  total_tributos: number | null
  cfop_codigo: string | null
  fiscal_cfop_id: string | null
  lancamento_id: string | null
  natureza: string | null
  observacoes: string | null
  comprovante_url: string | null
  created_at: string
  updated_at: string
}

// ─── Tipos enriquecidos (joins) ───────────────────────────────────────────────
export type ProcessoPrazoResumo = Pick<Prazo, 'id' | 'data_prazo' | 'status' | 'tipo_prazo_id'> & {
  tipo_prazo?: Pick<OpcaoCadastro, 'id' | 'slug' | 'rotulo' | 'ordem' | 'cor'> | null
}

export interface ProcessoComCliente extends Processo {
  cliente: Pick<Cliente, 'id' | 'nome' | 'tipo'>
  etapa: Pick<EtapaKanban, 'id' | 'nome' | 'cor' | 'ordem'>
  area?: Pick<OpcaoCadastro, 'id' | 'slug' | 'rotulo' | 'ordem' | 'cor'> | null
  prioridade?: Pick<OpcaoCadastro, 'id' | 'slug' | 'rotulo' | 'ordem' | 'cor'> | null
  prazos?: ProcessoPrazoResumo[]
  _count?: {
    tarefas: number
    tarefas_concluidas: number
    prazos_proximos: number
  }
}

export interface ProcessoDetalhado extends ProcessoComCliente {
  movimentacoes: Movimentacao[]
  tarefas: Tarefa[]
  prazos: (Prazo & { dias_restantes: number })[]
  documentos: Documento[]
  honorarios: Honorario[]
  lancamentos: Lancamento[]
}

export interface PrazoComProcesso extends Prazo {
  dias_restantes: number
  tipo_prazo?: Pick<OpcaoCadastro, 'id' | 'slug' | 'rotulo' | 'ordem' | 'cor'> | null
  processo?: Pick<Processo, 'id' | 'titulo' | 'numero_processo'> & {
    cliente: Pick<Cliente, 'id' | 'nome'>
  }
}

export interface LancamentoComRelacoes extends Lancamento {
  cliente?: Pick<Cliente, 'id' | 'nome'>
  processo?: Pick<Processo, 'id' | 'titulo'>
}

export interface KpiDashboard {
  receita_mes: number
  despesa_mes: number
  resultado_mes: number
  inadimplencia_total: number
  processos_ativos: number
  prazos_urgentes: number
}

export interface DreMensal {
  mes: string
  receitas: number
  despesas: number
  resultado: number
}

export interface ProcessosPorEtapa {
  etapa_id: string
  etapa_nome: string
  cor: string
  ordem: number
  total_processos: number
  total_alta_prioridade: number
}
