create or replace function public.confirm_quote(
  p_quote_id uuid,
  p_confirmation_data jsonb,
  p_option_id uuid,
  p_treatment_key text
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_current_status text;
  v_option_matches boolean;
begin
  select status
  into v_current_status
  from public.quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if v_current_status = 'confermato' then
    raise exception 'already_confirmed';
  end if;

  if p_option_id is not null then
    select case p_treatment_key
      when 'breakfast' then breakfast_price > 0
      when 'half_board' then half_board_price > 0
      when 'full_board' then full_board_price > 0
      else false
    end
    into v_option_matches
    from public.quote_hotel_options
    where id = p_option_id and quote_id = p_quote_id;

    if not found or not coalesce(v_option_matches, false) then
      raise exception 'invalid_quote_option';
    end if;
  end if;

  insert into public.quote_confirmations (
    quote_id, first_name, last_name, fiscal_code, phone, email, address, city,
    postal_code, province, accepted_terms, accepted_privacy,
    selected_hotel_option_id, selected_hotel_name, selected_treatment_key,
    selected_treatment_label, selected_price, selected_deposit_percent,
    selected_deposit_amount, selected_balance_amount, selected_balance_method,
    selected_payment_policy, selected_cancellation_policy, payment_settings_snapshot,
    availability_status, availability_updated_at, metadata
  ) values (
    p_quote_id,
    p_confirmation_data->>'first_name',
    p_confirmation_data->>'last_name',
    p_confirmation_data->>'fiscal_code',
    p_confirmation_data->>'phone',
    p_confirmation_data->>'email',
    p_confirmation_data->>'address',
    p_confirmation_data->>'city',
    p_confirmation_data->>'postal_code',
    p_confirmation_data->>'province',
    coalesce((p_confirmation_data->>'accepted_terms')::boolean, false),
    coalesce((p_confirmation_data->>'accepted_privacy')::boolean, false),
    p_option_id,
    p_confirmation_data->>'selected_hotel_name',
    p_treatment_key,
    p_confirmation_data->>'selected_treatment_label',
    nullif(p_confirmation_data->>'selected_price', '')::numeric,
    nullif(p_confirmation_data->>'selected_deposit_percent', '')::numeric,
    nullif(p_confirmation_data->>'selected_deposit_amount', '')::numeric,
    nullif(p_confirmation_data->>'selected_balance_amount', '')::numeric,
    p_confirmation_data->>'selected_balance_method',
    p_confirmation_data->>'selected_payment_policy',
    p_confirmation_data->>'selected_cancellation_policy',
    p_confirmation_data->'payment_settings_snapshot',
    'availability_to_check',
    now(),
    coalesce(p_confirmation_data->'metadata', '{}'::jsonb)
  )
  on conflict (quote_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    fiscal_code = excluded.fiscal_code,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    city = excluded.city,
    postal_code = excluded.postal_code,
    province = excluded.province,
    accepted_terms = excluded.accepted_terms,
    accepted_privacy = excluded.accepted_privacy,
    selected_hotel_option_id = excluded.selected_hotel_option_id,
    selected_hotel_name = excluded.selected_hotel_name,
    selected_treatment_key = excluded.selected_treatment_key,
    selected_treatment_label = excluded.selected_treatment_label,
    selected_price = excluded.selected_price,
    selected_deposit_percent = excluded.selected_deposit_percent,
    selected_deposit_amount = excluded.selected_deposit_amount,
    selected_balance_amount = excluded.selected_balance_amount,
    selected_balance_method = excluded.selected_balance_method,
    selected_payment_policy = excluded.selected_payment_policy,
    selected_cancellation_policy = excluded.selected_cancellation_policy,
    payment_settings_snapshot = excluded.payment_settings_snapshot,
    availability_status = excluded.availability_status,
    availability_updated_at = excluded.availability_updated_at,
    metadata = excluded.metadata;

  update public.quotes
  set status = 'confermato', confirmed_at = now(), updated_at = now()
  where id = p_quote_id;

  insert into public.quote_status_events (quote_id, from_status, to_status, note)
  values (p_quote_id, v_current_status, 'confermato', 'Preventivo confermato dal cliente');

  update public.quote_hotel_options
  set is_selected = false, updated_at = now()
  where quote_id = p_quote_id;

  if p_option_id is not null then
    update public.quote_hotel_options
    set is_selected = true, updated_at = now()
    where id = p_option_id and quote_id = p_quote_id;
  end if;

  insert into public.quote_events (quote_id, event_type, metadata)
  values (
    p_quote_id,
    'quote_confirmed',
    jsonb_build_object(
      'source', 'quote_confirmation',
      'selectedHotelOptionId', p_option_id,
      'selectedHotelName', p_confirmation_data->>'selected_hotel_name',
      'selectedTreatmentKey', p_treatment_key,
      'selectedTreatmentLabel', p_confirmation_data->>'selected_treatment_label',
      'selectedPrice', p_confirmation_data->'selected_price',
      'selectedDepositPercent', p_confirmation_data->'selected_deposit_percent',
      'selectedDepositAmount', p_confirmation_data->'selected_deposit_amount',
      'selectedBalanceAmount', p_confirmation_data->'selected_balance_amount',
      'selectedBalanceMethod', p_confirmation_data->>'selected_balance_method',
      'selectedPaymentPolicy', p_confirmation_data->>'selected_payment_policy',
      'selectedCancellationPolicy', p_confirmation_data->>'selected_cancellation_policy'
    )
  );
end;
$$;

revoke execute on function public.confirm_quote(uuid, jsonb, uuid, text) from public;
revoke execute on function public.confirm_quote(uuid, jsonb, uuid, text) from authenticated;
grant execute on function public.confirm_quote(uuid, jsonb, uuid, text) to service_role;
