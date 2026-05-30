-- Migration 002: Multicamera per proposta hotel
-- Aggiunge hotel_group (quale delle 3 strutture) e room_type_label (tipologia camera).
-- Ogni riga di quote_hotel_options rappresenta ora una tipologia camera di una struttura.
-- hotel_group 1-3 identifica la struttura, position 1-9 l'ordine globale.
-- Backward compat: righe esistenti hanno hotel_group=1 e room_type_label=null.

alter table public.quote_hotel_options
  add column if not exists hotel_group integer not null default 1;

alter table public.quote_hotel_options
  add column if not exists room_type_label text;

-- Aggiorna vincolo position da 1-3 a 1-9 (3 hotel x 3 camere)
alter table public.quote_hotel_options
  drop constraint if exists quote_hotel_options_position_check;

alter table public.quote_hotel_options
  add constraint quote_hotel_options_position_check check (position between 1 and 9);

-- Vincolo hotel_group
alter table public.quote_hotel_options
  drop constraint if exists quote_hotel_options_hotel_group_check;

alter table public.quote_hotel_options
  add constraint quote_hotel_options_hotel_group_check check (hotel_group between 1 and 3);
