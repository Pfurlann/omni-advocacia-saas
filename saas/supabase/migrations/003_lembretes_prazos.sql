-- Controle de envio de lembretes por e-mail (cron + Resend)

alter table public.prazos
  add column if not exists ultimo_lembrete_em date;

comment on column public.prazos.ultimo_lembrete_em is 'Último dia (UTC) em que enviamos e-mail de lembrete; evita duplicar no mesmo dia';
