# CURSOR AGENT PROMPT — LexFlow MVP
## Gestor completo de escritório de advocacia

Cole este texto inteiro no Cursor Agent (Cmd+I → modo Agent) para gerar o projeto.

---

## VISÃO DO PRODUTO

**LexFlow** é um gestor completo para advogados autônomos e pequenos escritórios.  
Pense num cruzamento de **Trello + Notion + controle financeiro**, com foco em advocacia.

**Módulos:**
1. **Kanban de Processos** — arrastar cards entre etapas (Captação → Em Andamento → Encerrado)
2. **Detalhe do Processo** — timeline, tarefas, prazos, documentos, financeiro (tudo numa tela)
3. **Prazos** — agenda de prazos fatais e audiências com alertas de proximidade
4. **Clientes** — ficha completa, histórico de processos
5. **Financeiro** — lançamentos (receitas/despesas), DRE, dashboard
6. **Configurações** — escritório, kanban customizável

---

## STACK OBRIGATÓRIA

- Next.js 14+ com App Router (TypeScript)
- Supabase (auth + database + storage)
- Tailwind CSS + shadcn/ui
- TanStack Query v5 (React Query)
- react-hook-form + zod
- Recharts (gráficos)
- @dnd-kit/core + @dnd-kit/sortable (drag and drop do kanban)
- sonner (toasts)
- date-fns (datas)
- lucide-react (ícones)

---

## MODELO DE DADOS (já existe no Supabase)

```
escritorios      — tenant raiz (1 por usuário)
etapas_kanban    — colunas do kanban, configuráveis
clientes         — PF ou PJ
processos        — card central do kanban
  ├── prazos     — datas críticas do processo
  ├── tarefas    — to-dos do processo
  ├── documentos — arquivos no Supabase Storage
  ├── movimentacoes — timeline/log de eventos
  └── honorarios — contrato financeiro
      └── lancamentos — entradas/saídas de caixa
```

**Enums importantes:**
- `area_direito`: trabalhista, civil, criminal, tributario, previdenciario, empresarial, familia, consumidor, administrativo, imobiliario, outro
- `tipo_prazo`: prazo_fatal, prazo_interno, audiencia, pericia, intimacao, protocolo, reuniao_cliente, outro
- `status_prazo`: pendente, concluido, cancelado, perdido
- `status_tarefa`: todo, in_progress, done, cancelada
- `tipo_movimentacao`: nota_interna, movimentacao_judicial, comunicacao_cliente, mudanca_etapa, prazo_adicionado, tarefa_concluida, documento_adicionado, honorario_recebido, outro

---

## ESTRUTURA DE PASTAS

```
src/
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── cadastro/page.tsx
│   │   └── onboarding/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx
│       ├── dashboard/page.tsx
│       ├── kanban/page.tsx
│       ├── processos/
│       │   ├── page.tsx              (lista)
│       │   └── [id]/page.tsx         (detalhe)
│       ├── prazos/page.tsx
│       ├── clientes/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── financeiro/
│       │   ├── page.tsx              (dashboard financeiro)
│       │   └── lancamentos/page.tsx
│       └── configuracoes/page.tsx
├── components/
│   ├── kanban/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColuna.tsx
│   │   ├── KanbanCard.tsx
│   │   └── KanbanCardDetalhes.tsx
│   ├── processos/
│   │   ├── FormProcesso.tsx
│   │   ├── ProcessoTimeline.tsx
│   │   ├── ProcessoTarefas.tsx
│   │   ├── ProcessoPrazos.tsx
│   │   └── ProcessoDocumentos.tsx
│   ├── prazos/
│   │   ├── CalendarioPrazos.tsx
│   │   └── FormPrazo.tsx
│   ├── clientes/
│   │   └── FormCliente.tsx
│   ├── financeiro/
│   │   ├── CardKPI.tsx
│   │   ├── GraficoMensal.tsx
│   │   └── FormLancamento.tsx
│   └── ui/  (shadcn components)
├── hooks/
│   ├── useEscritorio.ts
│   ├── useProcessos.ts
│   ├── usePrazos.ts
│   ├── useTarefas.ts
│   ├── useClientes.ts
│   ├── useLancamentos.ts
│   └── useDashboard.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── formatters.ts
│   └── constants.ts
├── types/
│   └── database.ts
└── middleware.ts
```

---

## GERAÇÃO PASSO A PASSO

### PASSO 1 — Setup base

**`src/lib/supabase/client.ts`**
```typescript
// createBrowserClient do @supabase/ssr
```

**`src/lib/supabase/server.ts`**
```typescript
// createServerClient do @supabase/ssr, lê cookies via next/headers
```

**`src/middleware.ts`**
- Usa createServerClient com cookies
- Chama `supabase.auth.getUser()` pra refresh da sessão
- Rotas públicas: `/`, `/login`, `/cadastro`
- Redireciona não-autenticados para `/login`
- Redireciona autenticados que tentam `/login` para `/kanban`

**`src/types/database.ts`**
- Types para todas as tabelas
- Interfaces auxiliares: `ProcessoComCliente`, `ProcessoDetalhado`, `PrazoComProcesso`, `LancamentoComProcesso`

**`src/lib/constants.ts`**
```typescript
export const AREA_LABELS: Record<string, string> = { trabalhista: 'Trabalhista', civil: 'Civil', ... }
export const AREA_CORES: Record<string, string> = { trabalhista: '#f97316', civil: '#3b82f6', ... }
export const STATUS_PRAZO_LABELS = { pendente: 'Pendente', concluido: 'Concluído', ... }
export const STATUS_PRAZO_CORES = { pendente: '#f59e0b', concluido: '#22c55e', perdido: '#ef4444', ... }
export const PRIORIDADE_LABELS = { 1: 'Alta', 2: 'Normal', 3: 'Baixa' }
export const PRIORIDADE_CORES = { 1: '#ef4444', 2: '#3b82f6', 3: '#6b7280' }
```

**`src/lib/formatters.ts`**
```typescript
export const formatCurrency = (value: number) => ...
export const formatDate = (date: string | Date) => ...  // DD/MM/AAAA
export const formatDateRelative = (date: string | Date) => ... // "em 3 dias", "ontem"
export const formatCPF = (cpf: string) => ...
export const formatCNPJ = (cnpj: string) => ...
```

---

### PASSO 2 — Layouts e Auth

**`src/app/layout.tsx`**
- QueryClientProvider, Toaster (sonner), fonte Inter

**`src/app/(auth)/login/page.tsx`**
- Card centralizado com logo
- Form: email + senha
- `supabase.auth.signInWithPassword` → redireciona para `/kanban`
- Link para /cadastro

**`src/app/(auth)/cadastro/page.tsx`**
- Form: nome + email + senha + confirmação
- `supabase.auth.signUp` com `data.full_name`
- Após cadastro → `/onboarding`

**`src/app/(auth)/onboarding/page.tsx`**
- Tela de boas-vindas
- Form: Nome do escritório* + OAB (opcional)
- INSERT em `escritorios`
- Após criar → `/kanban`

**`src/app/(dashboard)/layout.tsx`**
- Sidebar com ícones e labels
- Itens: Dashboard (LayoutDashboard), Kanban (Kanban), Processos (FileText), Prazos (Calendar), Clientes (Users), Financeiro (DollarSign), Config (Settings)
- Badge vermelho no item "Prazos" com count de prazos fatais próximos (≤3 dias)
- Header: nome do escritório + avatar + dropdown (perfil, sair)
- Mobile: sidebar como Sheet (slide-in)

---

### PASSO 3 — Kanban (módulo principal)

**`src/app/(dashboard)/kanban/page.tsx`** — Server Component
- Busca etapas + processos não arquivados
- Passa para KanbanBoard (client component)

**`src/components/kanban/KanbanBoard.tsx`** — Client Component
```
Usa @dnd-kit:
- DndContext com sensors (PointerSensor, KeyboardSensor)
- SortableContext para cada coluna
- onDragEnd: detecta se mudou de coluna → UPDATE processo.etapa_id + kanban_ordem
  (otimistic update + invalidate query)
Layout: flex row, scroll horizontal, colunas com largura fixa (280px)
```

**`src/components/kanban/KanbanColuna.tsx`**
```
Props: etapa (com nome, cor, ordem), processos[], total
- Header: badge colorido com nome + contador
- Scroll vertical se muitos cards
- Botão "+" no header → abre Sheet para criar processo nessa etapa
- Droppable zone com indicação visual
```

**`src/components/kanban/KanbanCard.tsx`**
```
Props: processo (com cliente, área, prioridade)
- Draggable via useSortable do @dnd-kit
- Exibe: título truncado, nome do cliente, badge área, badge prioridade
- Indicadores: ícone Calendar se tem prazo próximo (≤7 dias), ícone AlertCircle se prazo fatal (≤3 dias) em vermelho
- Contador de tarefas: "2/5 tarefas"  
- Ao clicar (não drag): navega para /processos/[id]
```

---

### PASSO 4 — Detalhe do Processo

**`src/app/(dashboard)/processos/[id]/page.tsx`**
Layout em duas colunas:
- **Coluna esquerda (60%):** Timeline + Editor de nota
- **Coluna direita (40%):** Tabs (Tarefas | Prazos | Documentos | Financeiro)

**Header da página:**
- Título do processo (editável inline)
- Badge área + badge prioridade
- Select de etapa (muda coluna do kanban)
- Menu ações (arquivar, excluir)
- Nome do cliente com link para /clientes/[id]

**`src/components/processos/ProcessoTimeline.tsx`**
```
Lista de movimentações (mais recentes primeiro)
Cada item:
- Ícone + cor por tipo_movimentacao
- Título + conteudo (renderizado como markdown simples)
- Timestamp relativo ("há 2 horas")
- Para tipo 'mudanca_etapa': mostra "De: X → Para: Y" do metadata
```

**Editor de nota inline:**
```
Textarea simples com placeholder "Adicionar nota ao processo..."
Botão submit → INSERT em movimentacoes (tipo: nota_interna)
Invalida query da timeline
```

**`src/components/processos/ProcessoTarefas.tsx`**
```
Lista de tarefas com checkbox
Checkbox marca done + data concluida_em
Botão "+" → input inline para criar tarefa
Drag para reordenar (opcional)
Filtro: todas / pendentes / concluídas
```

**`src/components/processos/ProcessoPrazos.tsx`**
```
Lista de prazos do processo, ordenados por data
Badge colorido por dias_restantes: vermelho ≤3, amarelo ≤7, verde >7
Badge tipo_prazo
Botão "Novo Prazo" → Sheet com FormPrazo
Botão concluir inline
```

**`src/components/processos/ProcessoDocumentos.tsx`**
```
Upload de arquivo (drag & drop ou click) → Supabase Storage
path: {escritorio_id}/{processo_id}/{filename}
Lista de arquivos com: nome, tipo badge, tamanho, data upload
Download direto via signed URL (getSignedUrl)
```

**Aba Financeiro no processo:**
```
Lista de honorários do processo
Lista de lançamentos do processo
Mini resumo: total recebido / total pendente / inadimplência
Botão "Novo Lançamento" → Sheet com FormLancamento (pré-preenchido com processo_id)
```

---

### PASSO 5 — Prazos

**`src/app/(dashboard)/prazos/page.tsx`**
Duas seções:

**Seção 1 — Alertas urgentes**
```
Cards destacados: prazos com status=pendente e data_prazo ≤ 7 dias
Ordenados por proximidade
Card com borda vermelha se ≤3 dias, amarela se ≤7 dias
Mostra: título, tipo, processo, cliente, dias_restantes
```

**Seção 2 — Todos os prazos**
```
Tabela: Data, Título, Tipo, Processo, Cliente, Status, Ações
Filtros: status, tipo, mês
Botão "Novo Prazo" geral
```

**`src/components/prazos/FormPrazo.tsx`**
```
Campos: titulo*, tipo*, data_prazo*, hora_prazo, processo_id (select com busca), alerta_dias, descricao
Submit: INSERT ou UPDATE prazos
```

---

### PASSO 6 — Clientes

**`src/app/(dashboard)/clientes/page.tsx`**
```
Tabela: Nome, CPF/CNPJ, Tipo, Status, Processos Ativos, Total Recebido
Busca por nome (ilike %termo%)
Filtro status
Paginação 20/página
```

**`src/app/(dashboard)/clientes/[id]/page.tsx`**
```
Header: nome, tipo, status, CPF/CNPJ, email, telefone
Tabs: Processos | Documentos | Financeiro
Aba Processos: cards mini dos processos com link
Aba Financeiro: extrato de lançamentos do cliente
```

---

### PASSO 7 — Dashboard (home)

**`src/app/(dashboard)/dashboard/page.tsx`**
Grid de widgets:

**Row 1 — KPIs do mês:**
- Receita do mês
- Despesas do mês
- Resultado líquido
- Inadimplência total

**Row 2:**
- Gráfico barras: receitas vs despesas últimos 6 meses (Recharts)
- Lista: próximos 5 prazos (com badges urgência)

**Row 3:**
- Funil do kanban: `v_processos_por_etapa` como mini barras horizontais
- Lista: 5 últimos lançamentos inadimplentes

---

### PASSO 8 — Financeiro

**`src/app/(dashboard)/financeiro/page.tsx`**
```
KPIs do mês (igual dashboard, mais detalhado)
Gráfico de pizza: breakdown por categoria
DRE simplificada: tabela mês a mês (últimos 12 meses)
```

**`src/app/(dashboard)/financeiro/lancamentos/page.tsx`**
```
Tabela completa de lançamentos
Filtros: tipo, status, categoria, mês/ano, processo, cliente
Totalizadores no rodapé
Export CSV (client-side com papaparse)
```

---

### PASSO 9 — Configurações

**`src/app/(dashboard)/configuracoes/page.tsx`**
Tabs:

**Escritório:**
- Form: nome, OAB, telefone, email, meta_mensal, cor_primaria (color picker)

**Kanban:**
```
Lista das etapas com DnD para reordenar (@dnd-kit)
Editar nome e cor de cada etapa
Botão "Nova Etapa"
Deletar etapa (só se não tiver processos)
```

**Conta:**
- Alterar senha (email reset via Supabase)
- Zona de perigo: deletar conta

---

### PASSO 10 — Hooks

**`useProcessos.ts`**
```typescript
// Listagem: busca com filtros (etapa_id, area, cliente_id, search, arquivado)
// Detail: processo único com joins (cliente, etapa)
// Mutations: criar, atualizar etapa (kanban), atualizar campos, arquivar
```

**`usePrazos.ts`**
```typescript
// Listar prazos (filtros: status, processo_id, dias_restantes)
// Count de prazos urgentes (≤7 dias) — para badge no nav
// Mutations: criar, concluir, cancelar
```

**`useTarefas.ts`**
```typescript
// Por processo
// Mutations: criar, marcar done, deletar
```

**`useMovimentacoes.ts`**
```typescript
// Por processo, ordenado por created_at DESC
// Mutation: adicionar nota
```

**`useDocumentos.ts`**
```typescript
// Upload para Supabase Storage + INSERT em documentos
// Download via signed URL
// Deletar
```

**`useLancamentos.ts`**
```typescript
// Listar com filtros
// Mutations: criar, marcar pago, deletar
```

**`useDashboard.ts`**
```typescript
// KPIs do mês corrente
// Dados dos últimos 6 meses para gráfico
// Processos por etapa (v_processos_por_etapa)
```

---

## DETALHES DE UX CRÍTICOS

### Kanban
- Drag & drop fluido com preview do card sendo arrastado
- Quando solta em nova coluna: toast "Processo movido para [etapa]"
- Optimistic update (UI atualiza antes da API confirmar)
- Coluna com scroll independente se tiver muitos cards

### Prazos fatais
- **Sempre visíveis** no topo da página de Prazos e no Dashboard
- Badge vermelho pulsante (animate-pulse) quando ≤3 dias
- No KanbanCard: ícone de alerta vermelho se o processo tem prazo fatal próximo

### Timeline do processo
- Entrada automática ao mover no kanban: "Etapa alterada: Em Andamento → Aguardando Tribunal"
- Markdown simples no campo de nota (negrito, itálico, listas)
- Timestamps relativos que atualizam automaticamente

### Financeiro integrado
- Lançamento pode ser criado direto do processo (pré-preenche processo_id)
- No detalhe do processo: mini-resumo financeiro sempre visível na sidebar direita

---

## PACKAGES

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install react-hook-form @hookform/resolvers zod
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts
npm install sonner
npm install date-fns
npm install lucide-react
npm install papaparse @types/papaparse
npx shadcn@latest init
npx shadcn@latest add button card input label select sheet dialog table badge tabs skeleton toast avatar dropdown-menu separator progress scroll-area textarea popover calendar
```

---

## ORDEM DE GERAÇÃO RECOMENDADA

1. `types/database.ts` + `lib/constants.ts` + `lib/formatters.ts`
2. `lib/supabase/client.ts` + `lib/supabase/server.ts` + `middleware.ts`
3. Layouts (root → dashboard → auth)
4. Páginas de auth (login → cadastro → onboarding)
5. Hooks base (useEscritorio, useClientes)
6. **Kanban** (KanbanBoard → KanbanColuna → KanbanCard) + hooks/useProcessos
7. Detalhe do processo + sub-componentes + hooks relacionados
8. Prazos
9. Clientes
10. Dashboard
11. Financeiro
12. Configurações

---

Comece pelo Passo 1 (tipos e utilitários). Confirme ao finalizar cada passo antes de avançar.
