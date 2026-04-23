// ─── Área do Direito ────────────────────────────────────────────────────────
export const AREA_LABELS: Record<string, string> = {
  trabalhista:    'Trabalhista',
  civil:          'Civil',
  criminal:       'Criminal',
  tributario:     'Tributário',
  previdenciario: 'Previdenciário',
  empresarial:    'Empresarial',
  familia:        'Família',
  consumidor:     'Consumidor',
  administrativo: 'Administrativo',
  imobiliario:    'Imobiliário',
  outro:          'Outro',
}

export const AREA_CORES: Record<string, string> = {
  trabalhista:    '#f97316',
  civil:          '#3b82f6',
  criminal:       '#ef4444',
  tributario:     '#8b5cf6',
  previdenciario: '#06b6d4',
  empresarial:    '#0ea5e9',
  familia:        '#ec4899',
  consumidor:     '#22c55e',
  administrativo: '#f59e0b',
  imobiliario:    '#6366f1',
  outro:          '#6b7280',
}

// ─── Prioridade ──────────────────────────────────────────────────────────────
export const PRIORIDADE_LABELS: Record<number, string> = {
  1: 'Alta',
  2: 'Normal',
  3: 'Baixa',
}

export const PRIORIDADE_CORES: Record<number, string> = {
  1: 'badge-danger',           // Alta    → destructive
  2: 'badge-primary',          // Normal  → primary (#4F52E8)
  3: 'badge-muted',            // Baixa   → muted
}

export const PRIORIDADE_ICONE_COR: Record<number, string> = {
  1: 'text-destructive',
  2: 'text-primary',
  3: 'text-muted-foreground',
}

// ─── Status Prazo ────────────────────────────────────────────────────────────
export const STATUS_PRAZO_LABELS: Record<string, string> = {
  pendente:   'Pendente',
  concluido:  'Concluído',
  cancelado:  'Cancelado',
  perdido:    'Perdido',
}

export const STATUS_PRAZO_CORES: Record<string, string> = {
  pendente:   'badge-warning',
  concluido:  'badge-success',
  cancelado:  'badge-muted',
  perdido:    'badge-danger',
}

// ─── Tipo Prazo ──────────────────────────────────────────────────────────────
export const TIPO_PRAZO_LABELS: Record<string, string> = {
  prazo_fatal:    '⚠️ Prazo Fatal',
  prazo_interno:  'Prazo Interno',
  audiencia:      'Audiência',
  pericia:        'Perícia',
  intimacao:      'Intimação',
  protocolo:      'Protocolo',
  reuniao_cliente:'Reunião c/ Cliente',
  outro:          'Outro',
}

// ─── Status Tarefa ───────────────────────────────────────────────────────────
export const STATUS_TAREFA_LABELS: Record<string, string> = {
  todo:        'A Fazer',
  in_progress: 'Em Andamento',
  done:        'Concluída',
  cancelada:   'Cancelada',
}

// ─── Tipo Movimentação ───────────────────────────────────────────────────────
export const TIPO_MOV_LABELS: Record<string, string> = {
  nota_interna:           'Nota',
  movimentacao_judicial:  'Movimentação Judicial',
  comunicacao_cliente:    'Comunicação com Cliente',
  mudanca_etapa:          'Mudança de Etapa',
  prazo_adicionado:       'Prazo Adicionado',
  tarefa_concluida:       'Tarefa Concluída',
  documento_adicionado:   'Documento Adicionado',
  honorario_recebido:     'Honorário Recebido',
  outro:                  'Evento',
}

export const TIPO_MOV_CORES: Record<string, string> = {
  nota_interna:           'badge-primary',     // primary
  movimentacao_judicial:  'badge-primary',     // primary
  comunicacao_cliente:    'badge-success',
  mudanca_etapa:          'badge-gold',        // gold
  prazo_adicionado:       'badge-danger',
  tarefa_concluida:       'badge-success',
  documento_adicionado:   'badge-primary',
  honorario_recebido:     'badge-gold',        // gold — receita financeira
  outro:                  'badge-muted',
}

// ─── Financeiro ──────────────────────────────────────────────────────────────
export const STATUS_LANCAMENTO_LABELS: Record<string, string> = {
  pago:        'Pago',
  pendente:    'Pendente',
  inadimplente:'Inadimplente',
  cancelado:   'Cancelado',
}

export const STATUS_LANCAMENTO_CORES: Record<string, string> = {
  pago:        'badge-success',
  pendente:    'badge-warning',
  inadimplente:'badge-danger',
  cancelado:   'badge-muted',
}

export const CATEGORIA_RECEITA_LABELS: Record<string, string> = {
  honorario_fixo:    'Honorário Fixo',
  honorario_exito:   'Honorário de Êxito',
  consultoria:       'Consultoria',
  custas_processuais:'Restituição de Custas',
  acordo_parcelado:  'Acordo parcelado',
  outros_receitas:   'Outros',
}

export const CATEGORIA_DESPESA_LABELS: Record<string, string> = {
  aluguel:           'Aluguel',
  internet_telefone: 'Internet / Telefone',
  software:          'Software',
  marketing:         'Marketing',
  contador:          'Contador',
  custas_processuais:'Custas Processuais',
  material_escritorio:'Material de Escritório',
  outros_despesas:   'Outros',
}

// ─── Tipo Documento ──────────────────────────────────────────────────────────
export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  peticao:      'Petição',
  contrato:     'Contrato',
  procuracao:   'Procuração',
  sentenca:     'Sentença',
  acordao:      'Acórdão',
  despacho:     'Despacho',
  notificacao:  'Notificação',
  comprovante:  'Comprovante',
  identidade:   'Documento de Identidade',
  outro:        'Outro',
}

// ─── Polo do cliente no processo ─────────────────────────────────────────────
export const POLO_LABELS: Record<string, string> = {
  ativo:    'Polo Ativo (Autor)',
  passivo:  'Polo Passivo (Réu)',
  terceiro: 'Terceiro',
  consulta: 'Consulta',
}

/** Cadastro ERP: cliente de serviços, fornecedor, ou ambos. */
export const PAPEL_ERP_LABELS: Record<string, string> = {
  cliente:     'Cliente',
  fornecedor:  'Fornecedor',
  ambos:       'Cliente e fornecedor',
}
