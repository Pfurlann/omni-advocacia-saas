-- Plano de contas, DFC, CFOP, notas fiscais, vínculo em lançamentos
-- (competência e classificação analítica)

create type public.tipo_dfc as enum (
  'operacional',
  'investimento',
  'financiamento'
);

create type public.tipo_cfop_mov as enum (
  'entrada',
  'saida',
  'ambos'
);

create type public.tipo_nota_fiscal as enum (
  'entrada',
  'saida'
);

create table public.plano_contas (
  id              uuid primary key default uuid_generate_v4(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  parent_id       uuid references public.plano_contas(id) on delete set null,
  codigo          text not null,
  nome            text not null,
  descricao       text,
  e_sintetica     boolean not null default false,
  tipo_razao      public.tipo_lancamento,
  natureza_dfc    public.tipo_dfc,
  ativo           boolean not null default true,
  ordem           int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint c_plano_sintetica_tipo
    check (
      (e_sintetica = true  and tipo_razao is null)
      or
      (e_sintetica = false and tipo_razao is not null)
    ),
  unique (escritorio_id, codigo)
);

create index idx_plano_contas_esc on public.plano_contas(escritorio_id);
create index idx_plano_contas_parent on public.plano_contas(escritorio_id, parent_id);

create trigger trg_plano_contas_updated
  before update on public.plano_contas
  for each row execute function public.set_updated_at();

-- CFOP: subconjunto configurado pelo escritório
create table public.fiscal_cfop (
  id                uuid primary key default uuid_generate_v4(),
  escritorio_id     uuid not null references public.escritorios(id) on delete cascade,
  codigo            char(4) not null,
  descricao         text not null,
  tipo_mov          public.tipo_cfop_mov not null default 'ambos',
  plano_conta_id    uuid references public.plano_contas(id) on delete set null,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (escritorio_id, codigo)
);

create index idx_fiscal_cfop_esc on public.fiscal_cfop(escritorio_id);

create trigger trg_fiscal_cfop_updated
  before update on public.fiscal_cfop
  for each row execute function public.set_updated_at();

-- Notas fiscais (entrada / saída) — registo manual e futura integração
create table public.notas_fiscais (
  id                 uuid primary key default uuid_generate_v4(),
  escritorio_id      uuid not null references public.escritorios(id) on delete cascade,
  tipo               public.tipo_nota_fiscal not null,
  chave_nfe          text
    constraint c_nfe_chave_len
      check (chave_nfe is null or char_length(btrim(chave_nfe)) = 44),
  numero             text,
  serie              text,
  participante_nome  text,
  participante_doc   text,
  data_emissao       date not null,
  data_entrada_saida date,
  valor_total        numeric(12,2) not null check (valor_total >= 0),
  base_calculo       numeric(12,2),
  total_tributos     numeric(12,2),
  cfop_codigo        text,
  fiscal_cfop_id     uuid references public.fiscal_cfop(id) on delete set null,
  lancamento_id      uuid references public.lancamentos(id) on delete set null,
  natureza           text,
  observacoes        text,
  comprovante_url    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_notas_fiscais_esc on public.notas_fiscais(escritorio_id, data_emissao desc);
create index idx_notas_fiscais_tipo on public.notas_fiscais(escritorio_id, tipo);

create trigger trg_notas_fiscais_updated
  before update on public.notas_fiscais
  for each row execute function public.set_updated_at();

-- Lançamentos: competência (DRE) e conta analítica (plano)
alter table public.lancamentos
  add column if not exists data_competencia date,
  add column if not exists plano_conta_id uuid references public.plano_contas(id) on delete set null;

create index if not exists idx_lancamentos_data_pagamento
  on public.lancamentos(escritorio_id, data_pagamento)
  where data_pagamento is not null and status = 'pago';

create index if not exists idx_lancamentos_competencia
  on public.lancamentos(escritorio_id, data_competencia);

create index if not exists idx_lancamentos_plano
  on public.lancamentos(escritorio_id, plano_conta_id)
  where plano_conta_id is not null;

comment on column public.lancamentos.data_competencia is
  'Competência contábil (DRE). Se nulo, a UI trata o vencimento como competência.';
comment on column public.lancamentos.plano_conta_id is
  'Conta analítica do plano de contas.';

-- RLS
alter table public.plano_contas enable row level security;
alter table public.fiscal_cfop enable row level security;
alter table public.notas_fiscais enable row level security;

create policy "plano_contas_select" on public.plano_contas
  for select using (escritorio_id = public.my_escritorio_id());
create policy "plano_contas_insert" on public.plano_contas
  for insert with check (escritorio_id = public.my_escritorio_id());
create policy "plano_contas_update" on public.plano_contas
  for update using (escritorio_id = public.my_escritorio_id());
create policy "plano_contas_delete" on public.plano_contas
  for delete using (escritorio_id = public.my_escritorio_id());

create policy "fiscal_cfop_select" on public.fiscal_cfop
  for select using (escritorio_id = public.my_escritorio_id());
create policy "fiscal_cfop_insert" on public.fiscal_cfop
  for insert with check (escritorio_id = public.my_escritorio_id());
create policy "fiscal_cfop_update" on public.fiscal_cfop
  for update using (escritorio_id = public.my_escritorio_id());
create policy "fiscal_cfop_delete" on public.fiscal_cfop
  for delete using (escritorio_id = public.my_escritorio_id());

create policy "notas_fiscais_select" on public.notas_fiscais
  for select using (escritorio_id = public.my_escritorio_id());
create policy "notas_fiscais_insert" on public.notas_fiscais
  for insert with check (escritorio_id = public.my_escritorio_id());
create policy "notas_fiscais_update" on public.notas_fiscais
  for update using (escritorio_id = public.my_escritorio_id());
create policy "notas_fiscais_delete" on public.notas_fiscais
  for delete using (escritorio_id = public.my_escritorio_id());
