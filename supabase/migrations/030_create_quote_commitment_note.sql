create or replace function public.create_quote_with_options(
  p_quote_data jsonb,
  p_children_data jsonb,
  p_hotel_options_data jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  insert into public.quotes (
    quote_request_id, code, public_token, status,
    client_first_name, client_last_name, client_email, client_phone,
    hotel_requested, hotel_id, alternative_hotel_id, is_alternative_offer,
    check_in, check_out, adults, children_count, rooms, treatment,
    total_price, deposit_amount, valid_until, included_services, transport_offers,
    payment_policy, cancellation_policy, public_notes, internal_notes, requires_commitment
  ) values (
    nullif(p_quote_data->>'quote_request_id', '')::uuid,
    p_quote_data->>'code',
    p_quote_data->>'public_token',
    coalesce(p_quote_data->>'status', 'in_lavorazione'),
    p_quote_data->>'client_first_name',
    p_quote_data->>'client_last_name',
    p_quote_data->>'client_email',
    p_quote_data->>'client_phone',
    p_quote_data->>'hotel_requested',
    nullif(p_quote_data->>'hotel_id', '')::uuid,
    nullif(p_quote_data->>'alternative_hotel_id', '')::uuid,
    coalesce((p_quote_data->>'is_alternative_offer')::boolean, false),
    (p_quote_data->>'check_in')::date,
    (p_quote_data->>'check_out')::date,
    coalesce((p_quote_data->>'adults')::integer, 2),
    coalesce((p_quote_data->>'children_count')::integer, 0),
    coalesce((p_quote_data->>'rooms')::integer, 1),
    p_quote_data->>'treatment',
    coalesce((p_quote_data->>'total_price')::numeric, 0),
    coalesce((p_quote_data->>'deposit_amount')::numeric, 0),
    nullif(p_quote_data->>'valid_until', '')::date,
    coalesce(p_quote_data->'included_services', '[]'::jsonb),
    coalesce(p_quote_data->'transport_offers', '[]'::jsonb),
    coalesce(p_quote_data->>'payment_policy', ''),
    coalesce(p_quote_data->>'cancellation_policy', ''),
    p_quote_data->>'public_notes',
    p_quote_data->>'internal_notes',
    coalesce((p_quote_data->>'requires_commitment')::boolean, false)
  )
  returning id into v_quote_id;

  insert into public.quote_status_events (quote_id, from_status, to_status, note)
  values (v_quote_id, null, coalesce(p_quote_data->>'status', 'in_lavorazione'), 'Preventivo preparato');

  if jsonb_typeof(coalesce(p_children_data, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_children_data, '[]'::jsonb)) > 0 then
    insert into public.quote_children (quote_id, birth_date, age)
    select
      v_quote_id,
      nullif(child->>'birth_date', '')::date,
      nullif(child->>'age', '')::integer
    from jsonb_array_elements(p_children_data) as child;
  end if;

  if jsonb_typeof(coalesce(p_hotel_options_data, '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(p_hotel_options_data, '[]'::jsonb)) > 0 then
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
      v_quote_id,
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
    from jsonb_array_elements(p_hotel_options_data) as option_row;
  end if;

  return v_quote_id;
end;
$$;

revoke execute on function public.create_quote_with_options(jsonb, jsonb, jsonb) from public;
revoke execute on function public.create_quote_with_options(jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.create_quote_with_options(jsonb, jsonb, jsonb) to service_role;
