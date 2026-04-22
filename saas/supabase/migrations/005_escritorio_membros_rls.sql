-- Membros do escritório (gestor / advogado) + responsável por processo + RLS granular

create type public.papel_escritorio as enum ('gestor', 'advogado');

create table public.escritorio_membros (
  id            uuid primary key default uuid_generate_v4(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  papel         public.papel_escritorio not null default 'advogado',
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (escritorio_id, user_id)
);

create index idx_esc_membros_user on public.escritorio_membros(user_id) where ativo;
create index idx_esc_membros_esc on public.escritorio_membros(escritorio_id) where ativo;

-- Dono do escritório = gestor na equipe
insert into public.escritorio_membros (escritorio_id, user_id, papel, ativo)
select e.id, e.owner_id, 'gestor'::public.papel_escritorio, true
from public.escritorios e
on conflict (escritorio_id, user_id) do nothing;

alter table public.processos
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

update public.processos p
set responsavel_id = e.owner_id
from public.escritorios e
where p.escritorio_id = e.id and p.responsavel_id is null;

alter table public.processos alter column responsavel_id set not null;

create index idx_processos_responsavel on public.processos(escritorio_id, responsavel_id);

alter table public.prazos
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

update public.prazos z
set responsavel_id = coalesce(
  (select pr.responsavel_id from public.processos pr where pr.id = z.processo_id),
  (select e.owner_id from public.escritorios e where e.id = z.escritorio_id)
)
where z.responsavel_id is null;

alter table public.prazos alter column responsavel_id set not null;

alter table public.tarefas
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

update public.tarefas t
set responsavel_id = coalesce(
  (select pr.responsavel_id from public.processos pr where pr.id = t.processo_id),
  (select e.owner_id from public.escritorios e where e.id = t.escritorio_id)
)
where t.responsavel_id is null;

alter table public.tarefas alter column responsavel_id set not null;

alter table public.documentos
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

update public.documentos d
set responsavel_id = coalesce(
  (select pr.responsavel_id from public.processos pr where pr.id = d.processo_id),
  (select e.owner_id from public.escritorios e where e.id = d.escritorio_id)
)
where d.responsavel_id is null;

alter table public.documentos alter column responsavel_id set not null;

-- ─── Helpers RLS ───────────────────────────────────────────────────────────

create or replace function public.my_escritorio_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.id from public.escritorios e where e.owner_id = auth.uid() limit 1),
    (select m.escritorio_id from public.escritorio_membros m
     where m.user_id = auth.uid() and m.ativo limit 1)
  );
$$;

create or replace function public.is_escritorio_gestor(esc_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.escritorios o
    where o.id = esc_id and o.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.escritorio_membros m
    where m.escritorio_id = esc_id and m.user_id = auth.uid()
      and m.papel = 'gestor' and m.ativo
  );
$$;

create or replace function public.can_access_processo(p_processo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.processos p
    where p.id = p_processo_id
      and p.escritorio_id = public.my_escritorio_id()
      and (
        public.is_escritorio_gestor(p.escritorio_id)
        or p.responsavel_id = auth.uid()
      )
  );
$$;

-- ─── Profiles: ver colegas do mesmo escritório ─────────────────────────────

drop policy if exists "profile_select" on public.profiles;
create policy "profile_select" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.escritorio_membros m1
    join public.escritorio_membros m2 on m1.escritorio_id = m2.escritorio_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
      and m1.ativo and m2.ativo
  )
  or exists (
    select 1 from public.escritorios e
    where e.owner_id = auth.uid() and e.owner_id = profiles.id
  )
  or exists (
    select 1 from public.escritorios e
    join public.escritorio_membros m on m.escritorio_id = e.id
    where e.owner_id = auth.uid() and m.user_id = profiles.id and m.ativo
  )
);

-- ─── Escritórios: membros enxergam; update só gestor ───────────────────────

drop policy if exists "esc_select" on public.escritorios;
drop policy if exists "esc_update" on public.escritorios;

create policy "esc_select" on public.escritorios for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.escritorio_membros m
    where m.escritorio_id = escritorios.id and m.user_id = auth.uid() and m.ativo
  )
);

create policy "esc_update" on public.escritorios for update using (
  public.is_escritorio_gestor(id)
);

-- ─── Membros ───────────────────────────────────────────────────────────────

alter table public.escritorio_membros enable row level security;

create policy "membros_select" on public.escritorio_membros
  for select using (escritorio_id = public.my_escritorio_id());

create policy "membros_insert" on public.escritorio_membros
  for insert with check (
    public.is_escritorio_gestor(escritorio_id)
    and escritorio_id = public.my_escritorio_id()
  );

create policy "membros_update" on public.escritorio_membros
  for update using (public.is_escritorio_gestor(escritorio_id));

create policy "membros_delete" on public.escritorio_membros
  for delete using (public.is_escritorio_gestor(escritorio_id));

-- ─── Processos ─────────────────────────────────────────────────────────────

drop policy if exists "proc_select" on public.processos;
drop policy if exists "proc_insert" on public.processos;
drop policy if exists "proc_update" on public.processos;
drop policy if exists "proc_delete" on public.processos;

create policy "proc_select" on public.processos for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "proc_insert" on public.processos for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "proc_update" on public.processos for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "proc_delete" on public.processos for delete using (
  escritorio_id = public.my_escritorio_id()
  and public.is_escritorio_gestor(escritorio_id)
);

-- ─── Prazos ────────────────────────────────────────────────────────────────

drop policy if exists "prazos_select" on public.prazos;
drop policy if exists "prazos_insert" on public.prazos;
drop policy if exists "prazos_update" on public.prazos;
drop policy if exists "prazos_delete" on public.prazos;

create policy "prazos_select" on public.prazos for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "prazos_insert" on public.prazos for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "prazos_update" on public.prazos for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "prazos_delete" on public.prazos for delete using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

-- ─── Tarefas ───────────────────────────────────────────────────────────────

drop policy if exists "tarefas_select" on public.tarefas;
drop policy if exists "tarefas_insert" on public.tarefas;
drop policy if exists "tarefas_update" on public.tarefas;
drop policy if exists "tarefas_delete" on public.tarefas;

create policy "tarefas_select" on public.tarefas for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "tarefas_insert" on public.tarefas for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "tarefas_update" on public.tarefas for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "tarefas_delete" on public.tarefas for delete using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

-- ─── Documentos ────────────────────────────────────────────────────────────

drop policy if exists "docs_select" on public.documentos;
drop policy if exists "docs_insert" on public.documentos;
drop policy if exists "docs_delete" on public.documentos;
drop policy if exists "docs_update" on public.documentos;

create policy "docs_select" on public.documentos for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "docs_insert" on public.documentos for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "docs_update" on public.documentos for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

create policy "docs_delete" on public.documentos for delete using (
  escritorio_id = public.my_escritorio_id()
  and (
    public.is_escritorio_gestor(escritorio_id)
    or responsavel_id = auth.uid()
  )
);

-- ─── Movimentações ─────────────────────────────────────────────────────────

drop policy if exists "movs_select" on public.movimentacoes;
drop policy if exists "movs_insert" on public.movimentacoes;

create policy "movs_select" on public.movimentacoes for select using (
  public.can_access_processo(processo_id)
);

create policy "movs_insert" on public.movimentacoes for insert with check (
  public.can_access_processo(processo_id)
);

-- ─── Honorários ────────────────────────────────────────────────────────────

drop policy if exists "hon_select" on public.honorarios;
drop policy if exists "hon_insert" on public.honorarios;
drop policy if exists "hon_update" on public.honorarios;
drop policy if exists "hon_delete" on public.honorarios;

create policy "hon_select" on public.honorarios for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "hon_insert" on public.honorarios for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "hon_update" on public.honorarios for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "hon_delete" on public.honorarios for delete using (
  escritorio_id = public.my_escritorio_id()
  and public.is_escritorio_gestor(escritorio_id)
);

-- ─── Lançamentos ───────────────────────────────────────────────────────────

drop policy if exists "lanc_select" on public.lancamentos;
drop policy if exists "lanc_insert" on public.lancamentos;
drop policy if exists "lanc_update" on public.lancamentos;
drop policy if exists "lanc_delete" on public.lancamentos;

create policy "lanc_select" on public.lancamentos for select using (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "lanc_insert" on public.lancamentos for insert with check (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "lanc_update" on public.lancamentos for update using (
  escritorio_id = public.my_escritorio_id()
  and (
    (processo_id is not null and public.can_access_processo(processo_id))
    or (processo_id is null and public.is_escritorio_gestor(escritorio_id))
  )
);

create policy "lanc_delete" on public.lancamentos for delete using (
  escritorio_id = public.my_escritorio_id()
  and public.is_escritorio_gestor(escritorio_id)
);

-- ─── DataJud ─────────────────────────────────────────────────────────────────

drop policy if exists "datajud_mov_select" on public.datajud_movimentacoes;
drop policy if exists "datajud_mov_insert" on public.datajud_movimentacoes;
drop policy if exists "datajud_mov_update" on public.datajud_movimentacoes;
drop policy if exists "datajud_mov_delete" on public.datajud_movimentacoes;

create policy "datajud_mov_select" on public.datajud_movimentacoes
  for select using (public.can_access_processo(processo_id));

create policy "datajud_mov_insert" on public.datajud_movimentacoes
  for insert with check (public.can_access_processo(processo_id));

create policy "datajud_mov_update" on public.datajud_movimentacoes
  for update using (public.can_access_processo(processo_id));

create policy "datajud_mov_delete" on public.datajud_movimentacoes
  for delete using (public.can_access_processo(processo_id));

-- ─── Storage: pasta = id do escritório (dono ou membro) ───────────────────

drop policy if exists "Advogado acessa seus docs" on storage.objects;

create policy "Advogado acessa seus docs"
  on storage.objects for all
  using (
    bucket_id = 'documentos'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] in (
        select e.id::text from public.escritorios e
        where e.owner_id = auth.uid()
      )
      or (storage.foldername(name))[1] in (
        select m.escritorio_id::text from public.escritorio_membros m
        where m.user_id = auth.uid() and m.ativo
      )
    )
  )
  with check (
    bucket_id = 'documentos'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] in (
        select e.id::text from public.escritorios e
        where e.owner_id = auth.uid()
      )
      or (storage.foldername(name))[1] in (
        select m.escritorio_id::text from public.escritorio_membros m
        where m.user_id = auth.uid() and m.ativo
      )
    )
  );
