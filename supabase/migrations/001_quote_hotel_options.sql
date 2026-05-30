-- Migration 001: Multi-proposta hotel options
-- Aggiunge la tabella quote_hotel_options e i campi di selezione in quote_confirmations.
-- I preventivi esistenti restano compatibili: senza righe in questa tabella, il sistema
-- crea una opzione virtuale dai campi legacy hotel_id / treatment / total_price.

create table if not exists public.quote_hotel_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  hotel_id uuid references public.hotels(id) on delete set null,
  position integer not null check (position between 1 and 3),
  hotel_name text not null,
  hotel_location text,
  hotel_stars integer,
  hotel_image_url text,
  source_url text,
  breakfast_price numeric(10,2),
  half_board_price numeric(10,2),
  full_board_price numeric(10,2),
  breakfast_label text not null default 'Camera e colazione',
  half_board_label text not null default 'Mezza pensione',
  full_board_label text not null default 'Pensione completa',
  included_services text,
  payment_policy text,
  cancellation_policy text,
  notes text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_hotel_options_quote_id_idx on public.quote_hotel_options(quote_id);

alter table public.quote_hotel_options enable row level security;
drop policy if exists "operators manage quote hotel options" on public.quote_hotel_options;
create policy "operators manage quote hotel options" on public.quote_hotel_options for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.quote_hotel_options to authenticated, service_role;

alter table public.quote_confirmations add column if not exists selected_hotel_option_id uuid references public.quote_hotel_options(id) on delete set null;
alter table public.quote_confirmations add column if not exists selected_hotel_name text;
alter table public.quote_confirmations add column if not exists selected_treatment_key text;
alter table public.quote_confirmations add column if not exists selected_treatment_label text;
alter table public.quote_confirmations add column if not exists selected_price numeric(10,2);
