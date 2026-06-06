alter table public.quote_hotel_options
  add column if not exists hotel_reason text default null;
