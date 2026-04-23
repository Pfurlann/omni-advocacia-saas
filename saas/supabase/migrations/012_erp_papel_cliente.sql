-- ERP: distinguir cliente, fornecedor ou ambos na mesma tabela de cadastros.

do $$ begin
  create type public.papel_erp as enum ('cliente', 'fornecedor', 'ambos');
exception
  when duplicate_object then null;
end $$;

alter table public.clientes
  add column if not exists papel_erp public.papel_erp not null default 'cliente';

comment on column public.clientes.papel_erp is
  'Papel comercial: cliente (cobrança), fornecedor (contas a pagar), ambos.';

create index if not exists idx_clientes_papel_erp on public.clientes (escritorio_id, papel_erp) where status = 'ativo';
