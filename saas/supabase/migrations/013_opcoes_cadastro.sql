-- Listas configuráveis por escritório: áreas do direito, prioridades de processo, tipos de prazo.

create type public.categoria_cadastro as enum (
  'area',
  'prioridade_processo',
  'tipo_prazo'
);

create table public.opcoes_cadastro (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  categoria       public.categoria_cadastro not null,
  slug            text not null,
  rotulo          text not null,
  ordem           int not null default 0,
  /** Hex (#rrggbb) para áreas; para prioridade: classe badge (ex: badge-danger). */
  cor             text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_opcoes_esc_cat_slug unique (escritorio_id, categoria, slug)
);

create index idx_opcoes_esc_cat on public.opcoes_cadastro (escritorio_id, categoria, ordem)
  where ativo;

create trigger trg_opcoes_updated_at
  before update on public.opcoes_cadastro
  for each row execute function public.set_updated_at();

-- Seed idempotente (novos escritórios / migração).
create or replace function public.seed_opcoes_cadastro(p_escritorio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Áreas (mesmos slugs do enum antigo area_direito)
  insert into public.opcoes_cadastro (escritorio_id, categoria, slug, rotulo, ordem, cor) values
    (p_escritorio_id, 'area', 'trabalhista', 'Trabalhista', 1, '#f97316'),
    (p_escritorio_id, 'area', 'civil', 'Civil', 2, '#3b82f6'),
    (p_escritorio_id, 'area', 'criminal', 'Criminal', 3, '#ef4444'),
    (p_escritorio_id, 'area', 'tributario', 'Tributário', 4, '#8b5cf6'),
    (p_escritorio_id, 'area', 'previdenciario', 'Previdenciário', 5, '#06b6d4'),
    (p_escritorio_id, 'area', 'empresarial', 'Empresarial', 6, '#0ea5e9'),
    (p_escritorio_id, 'area', 'familia', 'Família', 7, '#ec4899'),
    (p_escritorio_id, 'area', 'consumidor', 'Consumidor', 8, '#22c55e'),
    (p_escritorio_id, 'area', 'administrativo', 'Administrativo', 9, '#f59e0b'),
    (p_escritorio_id, 'area', 'imobiliario', 'Imobiliário', 10, '#6366f1'),
    (p_escritorio_id, 'area', 'outro', 'Outro', 11, '#6b7280')
  on conflict (escritorio_id, categoria, slug) do nothing;

  -- Prioridade de processo (p1 = alta …)
  insert into public.opcoes_cadastro (escritorio_id, categoria, slug, rotulo, ordem, cor) values
    (p_escritorio_id, 'prioridade_processo', 'p1', 'Alta', 1, 'badge-danger'),
    (p_escritorio_id, 'prioridade_processo', 'p2', 'Normal', 2, 'badge-primary'),
    (p_escritorio_id, 'prioridade_processo', 'p3', 'Baixa', 3, 'badge-muted')
  on conflict (escritorio_id, categoria, slug) do nothing;

  -- Tipos de prazo (slugs = enum antigo tipo_prazo)
  insert into public.opcoes_cadastro (escritorio_id, categoria, slug, rotulo, ordem) values
    (p_escritorio_id, 'tipo_prazo', 'prazo_fatal', '⚠️ Prazo Fatal', 1),
    (p_escritorio_id, 'tipo_prazo', 'prazo_interno', 'Prazo Interno', 2),
    (p_escritorio_id, 'tipo_prazo', 'audiencia', 'Audiência', 3),
    (p_escritorio_id, 'tipo_prazo', 'pericia', 'Perícia', 4),
    (p_escritorio_id, 'tipo_prazo', 'intimacao', 'Intimação', 5),
    (p_escritorio_id, 'tipo_prazo', 'protocolo', 'Protocolo', 6),
    (p_escritorio_id, 'tipo_prazo', 'reuniao_cliente', 'Reunião c/ Cliente', 7),
    (p_escritorio_id, 'tipo_prazo', 'outro', 'Outro', 8)
  on conflict (escritorio_id, categoria, slug) do nothing;
end;
$$;

comment on table public.opcoes_cadastro is
  'Listas por escritório (áreas, prioridades de processo, tipos de prazo) — ERP / Kanban.';

-- Escritórios existentes
do $$
declare r record;
begin
  for r in select id from public.escritorios loop
    perform public.seed_opcoes_cadastro(r.id);
  end loop;
end;
$$;

create or replace function public.trg_seed_opcoes_novo_escritorio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_opcoes_cadastro(new.id);
  return new;
end;
$$;

create trigger trg_escritorio_seed_opcoes
  after insert on public.escritorios
  for each row execute function public.trg_seed_opcoes_novo_escritorio();

-- Novas colunas FK
alter table public.processos
  add column if not exists area_id uuid references public.opcoes_cadastro(id) on delete restrict,
  add column if not exists prioridade_id uuid references public.opcoes_cadastro(id) on delete restrict;

alter table public.prazos
  add column if not exists tipo_prazo_id uuid references public.opcoes_cadastro(id) on delete restrict;

-- Backfill a partir dos enums / inteiros antigos
update public.processos p
set area_id = o.id
from public.opcoes_cadastro o
where o.escritorio_id = p.escritorio_id
  and o.categoria = 'area'
  and o.slug = p.area::text;

update public.processos p
set prioridade_id = o.id
from public.opcoes_cadastro o
where o.escritorio_id = p.escritorio_id
  and o.categoria = 'prioridade_processo'
  and o.slug = case p.prioridade when 1 then 'p1' when 2 then 'p2' when 3 then 'p3' else 'p2' end;

update public.prazos z
set tipo_prazo_id = o.id
from public.opcoes_cadastro o
where o.escritorio_id = z.escritorio_id
  and o.categoria = 'tipo_prazo'
  and o.slug = z.tipo::text;

-- Garantir NOT NULL
alter table public.processos alter column area_id set not null;
alter table public.processos alter column prioridade_id set not null;
alter table public.prazos alter column tipo_prazo_id set not null;

-- Views que referenciam area / prioridade / prazos.tipo: remover antes de dropar colunas
drop view if exists public.v_processos_por_etapa;
drop view if exists public.v_prazos_proximos;

-- Remover colunas antigas
alter table public.processos drop column area;
alter table public.processos drop column prioridade;

alter table public.prazos drop column tipo;

drop type public.area_direito;
drop type public.tipo_prazo;

create index idx_processos_area_id on public.processos (escritorio_id, area_id);
create index idx_processos_prioridade_id on public.processos (escritorio_id, prioridade_id);

-- View dashboard: alta prioridade = slug p1
create or replace view public.v_processos_por_etapa as
select
  e.escritorio_id,
  e.id as etapa_id,
  e.nome as etapa_nome,
  e.cor,
  e.ordem,
  count(p.id) as total_processos,
  count(p.id) filter (
    where po.slug = 'p1' and po.categoria = 'prioridade_processo'
  ) as total_alta_prioridade
from public.etapas_kanban e
left join public.processos p on p.etapa_id = e.id and p.arquivado = false
left join public.opcoes_cadastro po on po.id = p.prioridade_id
group by e.escritorio_id, e.id, e.nome, e.cor, e.ordem;

-- Mesma lógica do 001_initial_schema, agora com colunas novas (p.* inclui tipo_prazo_id)
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

-- RLS
alter table public.opcoes_cadastro enable row level security;

create policy "opcoes_select" on public.opcoes_cadastro
  for select using (escritorio_id = public.my_escritorio_id());

create policy "opcoes_insert" on public.opcoes_cadastro
  for insert with check (
    escritorio_id = public.my_escritorio_id()
    and public.is_escritorio_gestor(escritorio_id)
  );

create policy "opcoes_update" on public.opcoes_cadastro
  for update using (
    escritorio_id = public.my_escritorio_id()
    and public.is_escritorio_gestor(escritorio_id)
  );

create policy "opcoes_delete" on public.opcoes_cadastro
  for delete using (
    escritorio_id = public.my_escritorio_id()
    and public.is_escritorio_gestor(escritorio_id)
  );

grant select on public.opcoes_cadastro to authenticated;
grant insert, update, delete on public.opcoes_cadastro to authenticated;
