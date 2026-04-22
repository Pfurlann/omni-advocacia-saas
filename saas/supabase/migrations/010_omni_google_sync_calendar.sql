-- Calendário Google dedicado aos prazos Omni (id + preferências de nome/cor)
alter table public.user_google_calendar
  add column if not exists omni_sync_calendar_id text,
  add column if not exists omni_sync_calendar_name text,
  add column if not exists omni_sync_calendar_color_id text;

comment on column public.user_google_calendar.omni_sync_calendar_id is
  'ID do calendário Google criado para prazos Omni; se nulo, usa-se default_calendar_id (ou primary)';
