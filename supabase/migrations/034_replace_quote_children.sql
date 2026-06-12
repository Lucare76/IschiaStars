create or replace function public.replace_quote_children(
  p_quote_id uuid,
  p_children_data jsonb
) returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.quote_children where quote_id = p_quote_id;

  if jsonb_typeof(coalesce(p_children_data, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_children_data, '[]'::jsonb)) > 0 then
    insert into public.quote_children (quote_id, birth_date, age)
    select
      p_quote_id,
      nullif(child->>'birth_date', '')::date,
      nullif(child->>'age', '')::integer
    from jsonb_array_elements(p_children_data) as child;
  end if;

  update public.quotes
  set children_count = jsonb_array_length(coalesce(p_children_data, '[]'::jsonb)),
      updated_at = now()
  where id = p_quote_id;
end;
$$;

revoke execute on function public.replace_quote_children(uuid, jsonb) from public;
revoke execute on function public.replace_quote_children(uuid, jsonb) from authenticated;
grant execute on function public.replace_quote_children(uuid, jsonb) to service_role;
