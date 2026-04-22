-- Acordos parcelados: agrupamento e referência a processo (número livre ou processo vinculado)
alter type public.categoria_lancamento add value if not exists 'acordo_parcelado';

alter table public.lancamentos
  add column if not exists acordo_grupo_id uuid,
  add column if not exists numero_processo_referencia text,
  add column if not exists parcela_numero int;

comment on column public.lancamentos.acordo_grupo_id is
  'Mesmo UUID em todos os lançamentos do mesmo acordo (entrada + parcelas).';
comment on column public.lancamentos.numero_processo_referencia is
  'Número do processo (texto) quando não há processo_id ou para exibição.';
comment on column public.lancamentos.parcela_numero is
  'Null: lançamento comum. 0: entrada. 1+ ordem da parcela.';

create index if not exists idx_lancamentos_acordo_grupo
  on public.lancamentos(escritorio_id, acordo_grupo_id)
  where acordo_grupo_id is not null;
