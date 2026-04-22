-- Múltiplos escritórios por dono, escritório "ativo" no perfil, trigger membro, storage branding

-- 1) Escritório atual no perfil
alter table public.profiles
  add column if not exists active_escritorio_id uuid references public.escritorios(id) on delete set null;

-- 2) Vários escritórios com o mesmo dono
alter table public.escritorios drop constraint if exists escritorios_owner_id_key;

-- 3) Preencher active (antes de trocar a função)
update public.profiles p
set active_escritorio_id = sub.id
from (
  select
    p2.id as profile_id,
    coalesce(
      (select e.id from public.escritorios e
       where e.owner_id = p2.id
       order by e.created_at asc nulls last limit 1),
      (select m.escritorio_id from public.escritorio_membros m
       where m.user_id = p2.id and m.ativo
       order by m.created_at asc nulls last limit 1)
    ) as id
  from public.profiles p2
) sub
where p.id = sub.profile_id
  and p.active_escritorio_id is null
  and sub.id is not null;

-- 4) my_escritorio_id respeita o perfil (quando acessível)
create or replace function public.my_escritorio_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  chosen uuid;
  uid  uuid := auth.uid();
begin
  if uid is null then
    return null;
  end if;
  select p.active_escritorio_id into chosen from public.profiles p where p.id = uid;
  if chosen is not null then
    if exists (select 1 from public.escritorios e where e.id = chosen and e.owner_id = uid) then
      return chosen;
    end if;
    if exists (
      select 1 from public.escritorio_membros m
      where m.escritorio_id = chosen and m.user_id = uid and m.ativo
    ) then
      return chosen;
    end if;
  end if;
  return coalesce(
    (select e.id from public.escritorios e where e.owner_id = uid order by e.created_at asc nulls last limit 1),
    (select m.escritorio_id from public.escritorio_membros m
     where m.user_id = uid and m.ativo
     order by m.created_at asc nulls last limit 1)
  );
end;
$$;

-- 5) Membros: gestor pode inserir em qualquer escritório em que for gestor (ex.: após criar outro)
drop policy if exists "membros_insert" on public.escritorio_membros;
create policy "membros_insert" on public.escritorio_membros
  for insert with check (public.is_escritorio_gestor(escritorio_id));

-- 6) Garante dono como gestor em todo escritório novo
create or replace function public.escritorio_apos_insert_membro_dono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.escritorio_membros (escritorio_id, user_id, papel, ativo)
  values (new.id, new.owner_id, 'gestor'::public.papel_escritorio, true)
  on conflict (escritorio_id, user_id) do update set
    papel = 'gestor'::public.papel_escritorio, ativo = true;
  return new;
end;
$$;

drop trigger if exists trg_escritorio_membro_dono on public.escritorios;
create trigger trg_escritorio_membro_dono
  after insert on public.escritorios
  for each row execute function public.escritorio_apos_insert_membro_dono();

-- 7) Atualizar perfil: active_escritorio_id só se o usuário pertence ao escritório
drop policy if exists "profile_update" on public.profiles;
create policy "profile_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      active_escritorio_id is null
      or exists (
        select 1 from public.escritorios e
        where e.id = active_escritorio_id and e.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.escritorio_membros m
        where m.escritorio_id = active_escritorio_id
          and m.user_id = auth.uid() and m.ativo
      )
    )
  );

-- 8) Storage público: avatares e logos
insert into storage.buckets (id, name, public) values ('branding', 'branding', true)
  on conflict (id) do update set public = true;

drop policy if exists "branding_select_public" on storage.objects;
create policy "branding_select_public"
  on storage.objects for select
  using (bucket_id = 'branding');

drop policy if exists "branding_insert_avatar" on storage.objects;
create policy "branding_insert_avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "branding_update_own_avatar" on storage.objects;
create policy "branding_update_own_avatar"
  on storage.objects for update
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "branding_delete_own_avatar" on storage.objects;
create policy "branding_delete_own_avatar"
  on storage.objects for delete
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "branding_insert_logo" on storage.objects;
create policy "branding_insert_logo"
  on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'logos'
    and public.is_escritorio_gestor( ((storage.foldername(name))[2])::uuid )
  );

drop policy if exists "branding_update_logo" on storage.objects;
create policy "branding_update_logo"
  on storage.objects for update
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'logos'
    and public.is_escritorio_gestor( ((storage.foldername(name))[2])::uuid )
  );

drop policy if exists "branding_delete_logo" on storage.objects;
create policy "branding_delete_logo"
  on storage.objects for delete
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'logos'
    and public.is_escritorio_gestor( ((storage.foldername(name))[2])::uuid )
  );

comment on column public.profiles.active_escritorio_id is
  'Escritório visível (kanban, RLS) ao alternar; deve ser um que o usuário acessa.';
