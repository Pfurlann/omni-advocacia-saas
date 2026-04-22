-- DataJud (CNJ): cache de movimentações públicas por processo
-- Requer DATAJUD_API_KEY no servidor (nunca expor ao browser)

alter table public.processos
  add column if not exists datajud_tribunal_sigla text,
  add column if not exists datajud_synced_at timestamptz,
  add column if not exists datajud_sync_error text;

comment on column public.processos.datajud_tribunal_sigla is 'Alias DataJud do tribunal (ex: tjsp, trf3) — ver lista em lib/datajud/tribunais';
comment on column public.processos.datajud_synced_at is 'Última sincronização bem-sucedida com a API pública DataJud';
comment on column public.processos.datajud_sync_error is 'Última mensagem de erro ao sincronizar (se houver)';

create table public.datajud_movimentacoes (
  id uuid primary key default uuid_generate_v4(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  ocorrido_em timestamptz,
  codigo text,
  nome text not null,
  complemento text,
  id_externo text not null,
  created_at timestamptz not null default now(),
  unique (processo_id, id_externo)
);

create index idx_datajud_mov_processo on public.datajud_movimentacoes(processo_id, ocorrido_em desc nulls last);
create index idx_datajud_mov_escritorio on public.datajud_movimentacoes(escritorio_id);

alter table public.datajud_movimentacoes enable row level security;

create policy "datajud_mov_select" on public.datajud_movimentacoes
  for select using (escritorio_id = public.my_escritorio_id());

create policy "datajud_mov_insert" on public.datajud_movimentacoes
  for insert with check (escritorio_id = public.my_escritorio_id());

create policy "datajud_mov_update" on public.datajud_movimentacoes
  for update using (escritorio_id = public.my_escritorio_id());

create policy "datajud_mov_delete" on public.datajud_movimentacoes
  for delete using (escritorio_id = public.my_escritorio_id());
