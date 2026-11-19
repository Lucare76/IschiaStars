-- Localization data is stored beside existing metadata, without overwriting other keys.
create or replace function public.set_quote_localization(p_quote_id uuid, p_language text, p_translations jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if p_language not in ('it', 'en') or jsonb_typeof(p_translations) <> 'object' then
    raise exception 'Invalid quote localization';
  end if;
  update public.quotes set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('language', p_language, 'english_translations', p_translations), updated_at = now() where id = p_quote_id;
  if not found then raise exception 'Quote not found'; end if;
end $$;
revoke all on function public.set_quote_localization(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.set_quote_localization(uuid,text,jsonb) to service_role;

create or replace function public.create_localized_quote_with_options(p_quote_data jsonb, p_children_data jsonb, p_hotel_options_data jsonb)
returns uuid language plpgsql set search_path = public as $$
declare quote_id uuid;
begin
  quote_id := public.create_quote_with_options(p_quote_data, p_children_data, p_hotel_options_data);
  perform public.set_quote_localization(quote_id, coalesce(p_quote_data->>'language','it'), coalesce(p_quote_data->'english_translations','{}'::jsonb));
  return quote_id;
end $$;
revoke all on function public.create_localized_quote_with_options(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_localized_quote_with_options(jsonb,jsonb,jsonb) to service_role;
