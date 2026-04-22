-- Permite que o cliente alinhe a UI ao mesmo escritório usado nas políticas RLS (my_escritorio_id).

grant execute on function public.my_escritorio_id() to authenticated;
