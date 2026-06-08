alter table public.quote_hotel_options
  add column if not exists commitment_note text default null;

create or replace function public.replace_hotel_options(
  p_quote_id uuid,
  p_new_options jsonb
) returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.quotes where id = p_quote_id) then
    raise exception 'quote_not_found';
  end if;

  delete from public.quote_hotel_options
  where quote_id = p_quote_id;

  if jsonb_typeof(coalesce(p_new_options, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_new_options, '[]'::jsonb)) > 0 then
    insert into public.quote_hotel_options (
      quote_id, hotel_id, hotel_group, position, badge, hotel_reason, room_type_label,
      hotel_name, hotel_location, hotel_stars, hotel_image_url, source_url,
      breakfast_price, half_board_price, full_board_price,
      breakfast_label, half_board_label, full_board_label,
      breakfast_details, half_board_details, full_board_details, included_services,
      deposit_percent, balance_method, payment_policy, cancellation_policy,
      payment_notes, notes, requires_commitment, commitment_note, is_selected
    )
    select
      p_quote_id,
      nullif(option_row->>'hotel_id', '')::uuid,
      coalesce((option_row->>'hotel_group')::integer, 1),
      (option_row->>'position')::integer,
      option_row->>'badge',
      option_row->>'hotel_reason',
      option_row->>'room_type_label',
      option_row->>'hotel_name',
      option_row->>'hotel_location',
      nullif(option_row->>'hotel_stars', '')::integer,
      option_row->>'hotel_image_url',
      option_row->>'source_url',
      nullif(option_row->>'breakfast_price', '')::numeric,
      nullif(option_row->>'half_board_price', '')::numeric,
      nullif(option_row->>'full_board_price', '')::numeric,
      coalesce(option_row->>'breakfast_label', 'Camera e colazione'),
      coalesce(option_row->>'half_board_label', 'Mezza pensione'),
      coalesce(option_row->>'full_board_label', 'Pensione completa'),
      option_row->>'breakfast_details',
      option_row->>'half_board_details',
      option_row->>'full_board_details',
      option_row->>'included_services',
      nullif(option_row->>'deposit_percent', '')::numeric,
      option_row->>'balance_method',
      option_row->>'payment_policy',
      option_row->>'cancellation_policy',
      option_row->>'payment_notes',
      option_row->>'notes',
      coalesce((option_row->>'requires_commitment')::boolean, false),
      option_row->>'commitment_note',
      false
    from jsonb_array_elements(p_new_options) as option_row;
  end if;
end;
$$;

revoke execute on function public.replace_hotel_options(uuid, jsonb) from public;
revoke execute on function public.replace_hotel_options(uuid, jsonb) from authenticated;
grant execute on function public.replace_hotel_options(uuid, jsonb) to service_role;
