-- =============================================================================
-- LEXFLOW — Gestor completo de escritório de advocacia
-- Stack: Supabase (Postgres 15) + Next.js App Router
-- Modelo: multi-tenant — 1 user → 1 escritório → N tudo
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensões
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES — espelho de auth.users
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ESCRITÓRIOS — tenant raiz
-- ─────────────────────────────────────────────────────────────────────────────
create table public.escritorios (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  nome          text not null,
  oab           text,
  telefone      text,
  email         text,
  logo_url      text,
  meta_mensal   numeric(12,2) default 0,
  cor_primaria  text default '#1e3a5f',  -- personalizável
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id)
);

create trigger trg_escritorios_updated_at
  before update on public.escritorios
  for each row execute function set_updated_at();

create index idx_escritorios_owner on public.escritorios(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CLIENTES
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_pessoa as enum ('PF', 'PJ');
create type public.status_cliente as enum ('ativo', 'inativo', 'prospecto');

create table public.clientes (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  nome            text not null,
  tipo            tipo_pessoa not null default 'PF',
  cpf_cnpj        text,
  email           text,
  telefone        text,
  endereco        text,
  status          status_cliente not null default 'ativo',
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function set_updated_at();

create index idx_clientes_escritorio on public.clientes(escritorio_id);
create index idx_clientes_nome_trgm on public.clientes using gin(nome gin_trgm_ops);
create index idx_clientes_status on public.clientes(escritorio_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ETAPAS DO KANBAN — configuráveis por escritório
--    Cada escritório define suas próprias colunas/etapas
-- ─────────────────────────────────────────────────────────────────────────────
create table public.etapas_kanban (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  nome            text not null,
  cor             text default '#6366f1',   -- hex color do badge
  ordem           int not null default 0,
  is_inicial      boolean default false,    -- etapa de entrada padrão
  is_final        boolean default false,    -- etapa de encerramento
  created_at      timestamptz not null default now()
);

create index idx_etapas_escritorio on public.etapas_kanban(escritorio_id, ordem);

-- Insere etapas padrão quando escritório é criado
create or replace function public.criar_etapas_padrao()
returns trigger language plpgsql security definer as $$
begin
  insert into public.etapas_kanban (escritorio_id, nome, cor, ordem, is_inicial, is_final) values
    (new.id, 'Captação',              '#8b5cf6', 0, true,  false),
    (new.id, 'Análise',               '#f59e0b', 1, false, false),
    (new.id, 'Em Andamento',          '#3b82f6', 2, false, false),
    (new.id, 'Aguardando Cliente',    '#f97316', 3, false, false),
    (new.id, 'Aguardando Tribunal',   '#06b6d4', 4, false, false),
    (new.id, 'Recurso',               '#ec4899', 5, false, false),
    (new.id, 'Encerrado – Ganho',     '#22c55e', 6, false, true),
    (new.id, 'Encerrado – Perdido',   '#ef4444', 7, false, true),
    (new.id, 'Arquivado',             '#6b7280', 8, false, true);
  return new;
end;
$$;

create trigger on_escritorio_created
  after insert on public.escritorios
  for each row execute function public.criar_etapas_padrao();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PROCESSOS — entidade central do kanban
-- ─────────────────────────────────────────────────────────────────────────────
create type public.area_direito as enum (
  'trabalhista',
  'civil',
  'criminal',
  'tributario',
  'previdenciario',
  'empresarial',
  'familia',
  'consumidor',
  'administrativo',
  'imobiliario',
  'outro'
);

create type public.polo_cliente as enum ('ativo', 'passivo', 'terceiro', 'consulta');

create table public.processos (
  id                uuid primary key default uuid_generate_v4(),
  escritorio_id     uuid not null references public.escritorios(id) on delete cascade,
  cliente_id        uuid not null references public.clientes(id) on delete restrict,
  etapa_id          uuid not null references public.etapas_kanban(id) on delete restrict,

  -- Identificação
  titulo            text not null,               -- "Ação Trabalhista – Maria Silva"
  numero_processo   text,                        -- "0001234-56.2024.5.02.0001"
  area              area_direito not null default 'civil',
  polo              polo_cliente not null default 'ativo',

  -- Informações do caso
  vara_tribunal     text,
  comarca           text,
  fase_processual   text,                        -- texto livre: "instrução", "sentença", etc.
  valor_causa       numeric(12,2),
  valor_acordo      numeric(12,2),               -- preenchido quando há acordo

  -- Descrição rich text (markdown)
  descricao         text,

  -- Kanban
  kanban_ordem      int default 0,               -- posição dentro da etapa
  prioridade        int default 2 check (prioridade between 1 and 3), -- 1=alta 2=normal 3=baixa

  -- Datas
  data_distribuicao date,
  data_encerramento date,

  -- Controle
  arquivado         boolean default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_processos_updated_at
  before update on public.processos
  for each row execute function set_updated_at();

create index idx_processos_escritorio on public.processos(escritorio_id);
create index idx_processos_etapa on public.processos(etapa_id, kanban_ordem);
create index idx_processos_cliente on public.processos(cliente_id);
create index idx_processos_numero on public.processos(numero_processo);
create index idx_processos_titulo_trgm on public.processos using gin(titulo gin_trgm_ops);
create index idx_processos_area on public.processos(escritorio_id, area);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PRAZOS — datas críticas (prazos fatais para advogados)
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_prazo as enum (
  'prazo_fatal',         -- prazo processual improrrogável
  'prazo_interno',       -- meta interna do escritório
  'audiencia',
  'pericia',
  'intimacao',
  'protocolo',
  'reuniao_cliente',
  'outro'
);

create type public.status_prazo as enum ('pendente', 'concluido', 'cancelado', 'perdido');

create table public.prazos (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  processo_id     uuid references public.processos(id) on delete cascade,
  titulo          text not null,
  tipo            tipo_prazo not null default 'prazo_interno',
  data_prazo      date not null,
  hora_prazo      time,
  status          status_prazo not null default 'pendente',
  alerta_dias     int default 3,              -- alertar X dias antes
  descricao       text,
  concluido_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_prazos_updated_at
  before update on public.prazos
  for each row execute function set_updated_at();

create index idx_prazos_escritorio on public.prazos(escritorio_id, data_prazo);
create index idx_prazos_processo on public.prazos(processo_id);
create index idx_prazos_status on public.prazos(escritorio_id, status, data_prazo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TAREFAS — to-dos vinculados a processos ou soltos
-- ─────────────────────────────────────────────────────────────────────────────
create type public.status_tarefa as enum ('todo', 'in_progress', 'done', 'cancelada');
create type public.prioridade_tarefa as enum ('alta', 'normal', 'baixa');

create table public.tarefas (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  processo_id     uuid references public.processos(id) on delete cascade,
  titulo          text not null,
  descricao       text,
  status          status_tarefa not null default 'todo',
  prioridade      prioridade_tarefa not null default 'normal',
  data_vencimento date,
  concluida_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_tarefas_updated_at
  before update on public.tarefas
  for each row execute function set_updated_at();

create index idx_tarefas_escritorio on public.tarefas(escritorio_id);
create index idx_tarefas_processo on public.tarefas(processo_id);
create index idx_tarefas_status on public.tarefas(escritorio_id, status, data_vencimento);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. DOCUMENTOS — arquivos vinculados a processos/clientes
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_documento as enum (
  'peticao',
  'contrato',
  'procuracao',
  'sentenca',
  'acordao',
  'despacho',
  'notificacao',
  'comprovante',
  'identidade',
  'outro'
);

create table public.documentos (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  processo_id     uuid references public.processos(id) on delete cascade,
  cliente_id      uuid references public.clientes(id) on delete cascade,
  tipo            tipo_documento not null default 'outro',
  nome            text not null,               -- nome do arquivo
  descricao       text,
  storage_path    text not null,               -- path no Supabase Storage
  mime_type       text,
  tamanho_bytes   bigint,
  created_at      timestamptz not null default now()
);

create index idx_documentos_escritorio on public.documentos(escritorio_id);
create index idx_documentos_processo on public.documentos(processo_id);
create index idx_documentos_cliente on public.documentos(cliente_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. MOVIMENTAÇÕES — timeline/log de eventos por processo
--     Inspirado no Notion: cada entry pode ter texto rico
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_movimentacao as enum (
  'nota_interna',        -- anotação do advogado
  'movimentacao_judicial', -- publicação no tribunal
  'comunicacao_cliente',
  'mudanca_etapa',       -- registrada automaticamente ao mover kanban
  'prazo_adicionado',
  'tarefa_concluida',
  'documento_adicionado',
  'honorario_recebido',
  'outro'
);

create table public.movimentacoes (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  processo_id     uuid not null references public.processos(id) on delete cascade,
  tipo            tipo_movimentacao not null default 'nota_interna',
  titulo          text,
  conteudo        text,                        -- markdown
  metadata        jsonb default '{}',          -- dados extras (ex: etapa anterior/nova)
  criado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_movimentacoes_processo on public.movimentacoes(processo_id, created_at desc);
create index idx_movimentacoes_escritorio on public.movimentacoes(escritorio_id);

-- Trigger: log automático de mudança de etapa no kanban
create or replace function public.log_mudanca_etapa()
returns trigger language plpgsql security definer as $$
declare
  etapa_anterior text;
  etapa_nova     text;
begin
  if old.etapa_id is distinct from new.etapa_id then
    select nome into etapa_anterior from public.etapas_kanban where id = old.etapa_id;
    select nome into etapa_nova     from public.etapas_kanban where id = new.etapa_id;

    insert into public.movimentacoes (escritorio_id, processo_id, tipo, titulo, metadata)
    values (
      new.escritorio_id,
      new.id,
      'mudanca_etapa',
      'Etapa alterada',
      jsonb_build_object('de', etapa_anterior, 'para', etapa_nova)
    );
  end if;
  return new;
end;
$$;

create trigger trg_log_mudanca_etapa
  after update on public.processos
  for each row execute function public.log_mudanca_etapa();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. HONORÁRIOS — contrato financeiro do processo
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_honorario as enum (
  'fixo_mensal', 'por_ato', 'exito', 'consultoria', 'outro'
);

create type public.status_honorario as enum (
  'ativo', 'encerrado', 'suspenso', 'proposta'
);

create table public.honorarios (
  id               uuid primary key default uuid_generate_v4(),
  escritorio_id    uuid not null references public.escritorios(id) on delete cascade,
  processo_id      uuid references public.processos(id) on delete set null,
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  descricao        text not null,
  tipo             tipo_honorario not null default 'fixo_mensal',
  valor            numeric(12,2) not null default 0,
  percentual_exito numeric(5,2),
  data_inicio      date not null,
  data_fim         date,
  status           status_honorario not null default 'ativo',
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_honorarios_updated_at
  before update on public.honorarios
  for each row execute function set_updated_at();

create index idx_honorarios_escritorio on public.honorarios(escritorio_id);
create index idx_honorarios_processo on public.honorarios(processo_id);
create index idx_honorarios_cliente on public.honorarios(cliente_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. LANÇAMENTOS — financeiro
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_lancamento as enum ('receita', 'despesa');

create type public.status_lancamento as enum (
  'pago', 'pendente', 'inadimplente', 'cancelado'
);

create type public.categoria_lancamento as enum (
  'honorario_fixo', 'honorario_exito', 'consultoria', 'custas_processuais', 'outros_receitas',
  'aluguel', 'internet_telefone', 'software', 'marketing', 'contador',
  'material_escritorio', 'outros_despesas'
);

create table public.lancamentos (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  processo_id     uuid references public.processos(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  honorario_id    uuid references public.honorarios(id) on delete set null,
  tipo            tipo_lancamento not null,
  categoria       categoria_lancamento not null,
  descricao       text not null,
  valor           numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento  date,
  status          status_lancamento not null default 'pendente',
  forma_pagamento text,
  comprovante_url text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_lancamentos_updated_at
  before update on public.lancamentos
  for each row execute function set_updated_at();

create index idx_lancamentos_escritorio on public.lancamentos(escritorio_id);
create index idx_lancamentos_processo on public.lancamentos(processo_id);
create index idx_lancamentos_cliente on public.lancamentos(cliente_id);
create index idx_lancamentos_vencimento on public.lancamentos(escritorio_id, data_vencimento);
create index idx_lancamentos_status on public.lancamentos(escritorio_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. VIEWS ANALÍTICAS
-- ─────────────────────────────────────────────────────────────────────────────

-- DRE mensal
create or replace view public.v_dre_mensal as
select
  escritorio_id,
  date_trunc('month', data_vencimento)::date as mes,
  tipo, categoria, status,
  count(*)       as qtd,
  sum(valor)     as total
from public.lancamentos
group by 1, 2, 3, 4, 5;

-- Prazos próximos (próximos 30 dias, pendentes)
create or replace view public.v_prazos_proximos as
select
  p.*,
  pr.titulo as processo_titulo,
  pr.numero_processo,
  c.nome as cliente_nome,
  (p.data_prazo - current_date) as dias_restantes
from public.prazos p
left join public.processos pr on pr.id = p.processo_id
left join public.clientes c on c.id = pr.cliente_id
where p.status = 'pendente'
  and p.data_prazo >= current_date
  and p.data_prazo <= current_date + interval '30 days';

-- Dashboard: contagem de processos por etapa
create or replace view public.v_processos_por_etapa as
select
  e.escritorio_id,
  e.id as etapa_id,
  e.nome as etapa_nome,
  e.cor,
  e.ordem,
  count(p.id) as total_processos,
  count(p.id) filter (where p.prioridade = 1) as total_alta_prioridade
from public.etapas_kanban e
left join public.processos p on p.etapa_id = e.id and p.arquivado = false
group by e.escritorio_id, e.id, e.nome, e.cor, e.ordem;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.escritorios   enable row level security;
alter table public.etapas_kanban enable row level security;
alter table public.clientes      enable row level security;
alter table public.processos     enable row level security;
alter table public.prazos        enable row level security;
alter table public.tarefas       enable row level security;
alter table public.documentos    enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.honorarios    enable row level security;
alter table public.lancamentos   enable row level security;

-- Helper: id do escritório do usuário corrente
create or replace function public.my_escritorio_id()
returns uuid language sql stable security definer as $$
  select id from public.escritorios where owner_id = auth.uid() limit 1;
$$;

-- Macro para aplicar RLS padrão (select/insert/update/delete por escritorio_id)
-- (aplica manualmente abaixo, mais legível)

-- PROFILES
create policy "profile_select" on public.profiles for select using (id = auth.uid());
create policy "profile_update" on public.profiles for update using (id = auth.uid());

-- ESCRITÓRIOS
create policy "esc_select" on public.escritorios for select using (owner_id = auth.uid());
create policy "esc_insert" on public.escritorios for insert with check (owner_id = auth.uid());
create policy "esc_update" on public.escritorios for update using (owner_id = auth.uid());
create policy "esc_delete" on public.escritorios for delete using (owner_id = auth.uid());

-- ETAPAS KANBAN
create policy "etapas_select" on public.etapas_kanban for select using (escritorio_id = my_escritorio_id());
create policy "etapas_insert" on public.etapas_kanban for insert with check (escritorio_id = my_escritorio_id());
create policy "etapas_update" on public.etapas_kanban for update using (escritorio_id = my_escritorio_id());
create policy "etapas_delete" on public.etapas_kanban for delete using (escritorio_id = my_escritorio_id());

-- CLIENTES
create policy "clientes_select" on public.clientes for select using (escritorio_id = my_escritorio_id());
create policy "clientes_insert" on public.clientes for insert with check (escritorio_id = my_escritorio_id());
create policy "clientes_update" on public.clientes for update using (escritorio_id = my_escritorio_id());
create policy "clientes_delete" on public.clientes for delete using (escritorio_id = my_escritorio_id());

-- PROCESSOS
create policy "proc_select" on public.processos for select using (escritorio_id = my_escritorio_id());
create policy "proc_insert" on public.processos for insert with check (escritorio_id = my_escritorio_id());
create policy "proc_update" on public.processos for update using (escritorio_id = my_escritorio_id());
create policy "proc_delete" on public.processos for delete using (escritorio_id = my_escritorio_id());

-- PRAZOS
create policy "prazos_select" on public.prazos for select using (escritorio_id = my_escritorio_id());
create policy "prazos_insert" on public.prazos for insert with check (escritorio_id = my_escritorio_id());
create policy "prazos_update" on public.prazos for update using (escritorio_id = my_escritorio_id());
create policy "prazos_delete" on public.prazos for delete using (escritorio_id = my_escritorio_id());

-- TAREFAS
create policy "tarefas_select" on public.tarefas for select using (escritorio_id = my_escritorio_id());
create policy "tarefas_insert" on public.tarefas for insert with check (escritorio_id = my_escritorio_id());
create policy "tarefas_update" on public.tarefas for update using (escritorio_id = my_escritorio_id());
create policy "tarefas_delete" on public.tarefas for delete using (escritorio_id = my_escritorio_id());

-- DOCUMENTOS
create policy "docs_select" on public.documentos for select using (escritorio_id = my_escritorio_id());
create policy "docs_insert" on public.documentos for insert with check (escritorio_id = my_escritorio_id());
create policy "docs_delete" on public.documentos for delete using (escritorio_id = my_escritorio_id());

-- MOVIMENTAÇÕES
create policy "movs_select" on public.movimentacoes for select using (escritorio_id = my_escritorio_id());
create policy "movs_insert" on public.movimentacoes for insert with check (escritorio_id = my_escritorio_id());

-- HONORÁRIOS
create policy "hon_select" on public.honorarios for select using (escritorio_id = my_escritorio_id());
create policy "hon_insert" on public.honorarios for insert with check (escritorio_id = my_escritorio_id());
create policy "hon_update" on public.honorarios for update using (escritorio_id = my_escritorio_id());
create policy "hon_delete" on public.honorarios for delete using (escritorio_id = my_escritorio_id());

-- LANÇAMENTOS
create policy "lanc_select" on public.lancamentos for select using (escritorio_id = my_escritorio_id());
create policy "lanc_insert" on public.lancamentos for insert with check (escritorio_id = my_escritorio_id());
create policy "lanc_update" on public.lancamentos for update using (escritorio_id = my_escritorio_id());
create policy "lanc_delete" on public.lancamentos for delete using (escritorio_id = my_escritorio_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. STORAGE BUCKET para documentos
-- ─────────────────────────────────────────────────────────────────────────────
-- Execute no dashboard do Supabase: Storage → New bucket → "documentos" (private)
-- Ou via SQL:
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict do nothing;

create policy "Advogado acessa seus docs"
  on storage.objects for all
  using (
    bucket_id = 'documentos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (select id::text from public.escritorios where owner_id = auth.uid() limit 1)
  );

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================
