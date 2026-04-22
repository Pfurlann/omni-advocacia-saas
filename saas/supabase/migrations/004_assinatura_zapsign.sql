-- ZapSign: rastreamento de assinatura eletrônica por documento (PDF no Storage)

alter table public.documentos
  add column if not exists assinatura_provedor text,
  add column if not exists assinatura_ref text,
  add column if not exists assinatura_status text,
  add column if not exists assinatura_link text,
  add column if not exists assinatura_atualizado_em timestamptz;

comment on column public.documentos.assinatura_provedor is 'ex: zapsign';
comment on column public.documentos.assinatura_ref is 'token do documento na ZapSign';
comment on column public.documentos.assinatura_status is 'pending, signed, canceled, etc.';
comment on column public.documentos.assinatura_link is 'URL de assinatura do 1º signatário ou link curto';

drop policy if exists "docs_update" on public.documentos;
create policy "docs_update" on public.documentos
  for update using (escritorio_id = public.my_escritorio_id());
