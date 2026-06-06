alter table public.quote_hotel_options
  add column if not exists breakfast_details text default null,
  add column if not exists half_board_details text default null,
  add column if not exists full_board_details text default null;
