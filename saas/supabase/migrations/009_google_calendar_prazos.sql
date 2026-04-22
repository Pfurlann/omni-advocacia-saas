-- Integração Google Calendar: credenciais e preferências por utilizador, espelho do prazo no Google.
create table if not exists public.user_google_calendar (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  access_token       text not null,
  refresh_token      text not null,
  token_expires_at   timestamptz not null,
  default_calendar_id text,
  -- Calendários Google cujo conteúdo se mostra na agenda Omni (ids da Calendar API)
  visible_calendar_ids text[] not null default array['primary']::text[],
  show_omni_layer   boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_user_google_calendar_updated_at
  before update on public.user_google_calendar
  for each row execute function public.set_updated_at();

create index if not exists idx_user_google_calendar_updated on public.user_google_calendar (updated_at);

alter table public.prazos
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_synced_at timestamptz;

comment on column public.prazos.google_event_id is 'ID do evento na Google Calendar API (sincronizado a partir do responsável)';
comment on table public.user_google_calendar is 'Tokens OAuth Google: só a própria linha acessível ao utilizador; sync em servidor com service role para o responsável.';

alter table public.user_google_calendar enable row level security;

create policy "user_google_select_own" on public.user_google_calendar
  for select using (auth.uid() = user_id);
create policy "user_google_insert_own" on public.user_google_calendar
  for insert with check (auth.uid() = user_id);
create policy "user_google_update_own" on public.user_google_calendar
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_google_delete_own" on public.user_google_calendar
  for delete using (auth.uid() = user_id);

