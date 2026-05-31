create extension if not exists pgcrypto;

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  stars integer not null check (stars between 1 and 5),
  short_description text not null default '',
  image_url text,
  external_image_url text,
  standard_services jsonb not null default '[]',
  default_deposit_percent numeric(5,2),
  default_balance_method text,
  payment_policy text not null default '',
  cancellation_policy text not null default '',
  default_payment_notes text,
  internal_notes text,
  source_url text,
  external_source text,
  external_id text,
  slug text,
  last_synced_at timestamptz,
  last_seen_on_site_at timestamptz,
  sync_metadata jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hotels add column if not exists source_url text;
alter table public.hotels add column if not exists external_image_url text;
alter table public.hotels add column if not exists external_source text;
alter table public.hotels add column if not exists external_id text;
alter table public.hotels add column if not exists slug text;
alter table public.hotels add column if not exists last_synced_at timestamptz;
alter table public.hotels add column if not exists last_seen_on_site_at timestamptz;
alter table public.hotels add column if not exists sync_metadata jsonb not null default '{}';
alter table public.hotels add column if not exists default_deposit_percent numeric(5,2);
alter table public.hotels add column if not exists default_balance_method text;
alter table public.hotels add column if not exists default_payment_notes text;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  destination text,
  check_in date not null,
  check_out date not null,
  adults integer not null default 2 check (adults > 0),
  children_count integer not null default 0 check (children_count >= 0),
  rooms integer not null default 1 check (rooms > 0),
  treatment text,
  message text,
  status text not null default 'da_evadere' check (status in ('da_evadere','in_lavorazione','preventivo_inviato','confermato','perso','non_disponibile','perso_non_disponibile')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_request_children (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  code text not null unique,
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  client_first_name text not null,
  client_last_name text not null,
  client_email text not null,
  client_phone text not null,
  hotel_requested text,
  hotel_id uuid references public.hotels(id) on delete set null,
  alternative_hotel_id uuid references public.hotels(id) on delete set null,
  is_alternative_offer boolean not null default false,
  check_in date not null,
  check_out date not null,
  adults integer not null default 2 check (adults > 0),
  children_count integer not null default 0 check (children_count >= 0),
  rooms integer not null default 1 check (rooms > 0),
  treatment text,
  total_price numeric(10,2) not null default 0 check (total_price >= 0),
  deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  valid_until date,
  included_services jsonb not null default '[]',
  transport_offers jsonb not null default '[]',
  payment_policy text not null default '',
  cancellation_policy text not null default '',
  public_notes text,
  internal_notes text,
  status text not null default 'preventivo_inviato' check (status in ('da_evadere','in_lavorazione','preventivo_inviato','aperto','confermato','perso','non_disponibile','perso_non_disponibile')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_children (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (event_type in ('quote_opened','whatsapp_clicked','confirm_clicked','quote_confirmed','print_clicked','hotel_link_clicked','details_opened','follow_up_whatsapp_click','availability_confirmed','final_confirmation_email_sent','deposit_due_at_set','availability_unavailable','availability_unavailable_email_sent','alternative_to_propose')),
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.quote_confirmations (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  fiscal_code text not null,
  phone text not null,
  email text not null,
  address text not null,
  city text not null,
  postal_code text not null,
  province text not null,
  accepted_terms boolean not null default false,
  accepted_privacy boolean not null default false,
  metadata jsonb not null default '{}',
  availability_status text not null default 'availability_to_check' check (availability_status in ('availability_to_check','availability_confirmed','final_confirmation_sent','deposit_waiting','availability_unavailable','alternative_to_propose')),
  deposit_due_at timestamptz,
  final_confirmation_sent_at timestamptz,
  final_confirmation_notes text,
  unavailable_reason text,
  unavailability_email_sent_at timestamptz,
  availability_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_status_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_code_idx on public.quotes(code);
create index if not exists quotes_public_token_idx on public.quotes(public_token);
create index if not exists quote_events_quote_id_idx on public.quote_events(quote_id);
create index if not exists quote_requests_status_idx on public.quote_requests(status);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quote_confirmations_availability_status_idx on public.quote_confirmations(availability_status);
create unique index if not exists hotels_external_source_external_id_uidx on public.hotels(external_source, external_id) where external_source is not null and external_id is not null;
create unique index if not exists hotels_slug_uidx on public.hotels(slug) where slug is not null;

alter table public.hotels enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_request_children enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_children enable row level security;
alter table public.quote_events enable row level security;
alter table public.quote_confirmations enable row level security;
alter table public.quote_status_events enable row level security;
alter table public.settings enable row level security;

drop policy if exists "operators manage hotels" on public.hotels;
drop policy if exists "operators manage quote requests" on public.quote_requests;
drop policy if exists "operators manage quote request children" on public.quote_request_children;
drop policy if exists "operators manage quotes" on public.quotes;
drop policy if exists "operators manage quote children" on public.quote_children;
drop policy if exists "operators read quote events" on public.quote_events;
drop policy if exists "operators create quote events" on public.quote_events;
drop policy if exists "operators manage confirmations" on public.quote_confirmations;
drop policy if exists "operators read status history" on public.quote_status_events;
drop policy if exists "operators create status history" on public.quote_status_events;
drop policy if exists "operators manage settings" on public.settings;

create policy "operators manage hotels" on public.hotels for all to authenticated using (true) with check (true);
create policy "operators manage quote requests" on public.quote_requests for all to authenticated using (true) with check (true);
create policy "operators manage quote request children" on public.quote_request_children for all to authenticated using (true) with check (true);
create policy "operators manage quotes" on public.quotes for all to authenticated using (true) with check (true);
create policy "operators manage quote children" on public.quote_children for all to authenticated using (true) with check (true);
create policy "operators read quote events" on public.quote_events for select to authenticated using (true);
create policy "operators create quote events" on public.quote_events for insert to authenticated with check (true);
create policy "operators manage confirmations" on public.quote_confirmations for all to authenticated using (true) with check (true);
create policy "operators read status history" on public.quote_status_events for select to authenticated using (true);
create policy "operators create status history" on public.quote_status_events for insert to authenticated with check (true);
create policy "operators manage settings" on public.settings for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.hotels to authenticated, service_role;
grant select, insert, update, delete on public.quote_requests to authenticated, service_role;
grant select, insert, update, delete on public.quote_request_children to authenticated, service_role;
grant select, insert, update, delete on public.quotes to authenticated, service_role;
grant select, insert, update, delete on public.quote_children to authenticated, service_role;
grant select, insert, update, delete on public.quote_events to authenticated, service_role;
grant select, insert, update, delete on public.quote_confirmations to authenticated, service_role;
grant select, insert, update, delete on public.quote_status_events to authenticated, service_role;
grant select, insert, update, delete on public.settings to authenticated, service_role;

-- Public pages must not select directly from these tables.
-- Use an API route or Supabase RPC that validates quotes.code + quotes.public_token,
-- returns only public fields, writes quote_events, and never exposes internal_notes.

-- Migration: preventivi test e statistiche
alter table public.quotes add column if not exists excluded_from_stats boolean not null default false;
alter table public.quotes add column if not exists deleted_at timestamptz;
alter table public.quotes add column if not exists deleted_reason text;

create index if not exists quotes_excluded_from_stats_idx on public.quotes(excluded_from_stats);
create index if not exists quotes_deleted_at_idx on public.quotes(deleted_at) where deleted_at is not null;

-- ============================================================
-- Multi-proposta: tabella hotel options per preventivo
-- ============================================================
create table if not exists public.quote_hotel_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  hotel_id uuid references public.hotels(id) on delete set null,
  hotel_group integer not null default 1 check (hotel_group between 1 and 3),
  position integer not null check (position between 1 and 9),
  room_type_label text,
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
  deposit_percent numeric(5,2),
  balance_method text,
  payment_policy text,
  cancellation_policy text,
  payment_notes text,
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

-- Selezione del cliente: nuove colonne in quote_confirmations
alter table public.quote_confirmations add column if not exists selected_hotel_option_id uuid references public.quote_hotel_options(id) on delete set null;
alter table public.quote_confirmations add column if not exists selected_hotel_name text;
alter table public.quote_confirmations add column if not exists selected_treatment_key text;
alter table public.quote_confirmations add column if not exists selected_treatment_label text;
alter table public.quote_confirmations add column if not exists selected_price numeric(10,2);
alter table public.quote_confirmations add column if not exists selected_deposit_percent numeric(5,2);
alter table public.quote_confirmations add column if not exists selected_deposit_amount numeric(10,2);
alter table public.quote_confirmations add column if not exists selected_balance_amount numeric(10,2);
alter table public.quote_confirmations add column if not exists selected_balance_method text;
alter table public.quote_confirmations add column if not exists selected_payment_policy text;
alter table public.quote_confirmations add column if not exists selected_cancellation_policy text;
alter table public.quote_confirmations add column if not exists payment_settings_snapshot jsonb;
alter table public.quote_confirmations add column if not exists availability_status text not null default 'availability_to_check';
alter table public.quote_confirmations add column if not exists deposit_due_at timestamptz;
alter table public.quote_confirmations add column if not exists final_confirmation_sent_at timestamptz;
alter table public.quote_confirmations add column if not exists final_confirmation_notes text;
alter table public.quote_confirmations add column if not exists unavailable_reason text;
alter table public.quote_confirmations add column if not exists unavailability_email_sent_at timestamptz;
alter table public.quote_confirmations add column if not exists availability_updated_at timestamptz;

alter table public.quote_confirmations drop constraint if exists quote_confirmations_availability_status_check;
alter table public.quote_confirmations add constraint quote_confirmations_availability_status_check check (availability_status in ('availability_to_check','availability_confirmed','final_confirmation_sent','deposit_waiting','availability_unavailable','alternative_to_propose'));

alter table public.quote_events drop constraint if exists quote_events_event_type_check;
alter table public.quote_events add constraint quote_events_event_type_check check (event_type in ('quote_opened','whatsapp_clicked','confirm_clicked','quote_confirmed','print_clicked','hotel_link_clicked','details_opened','follow_up_whatsapp_click','availability_confirmed','final_confirmation_email_sent','deposit_due_at_set','availability_unavailable','availability_unavailable_email_sent','alternative_to_propose'));

insert into public.settings (key, value)
values (
  'payment_settings',
  jsonb_build_object(
    'bank_account_holder', '',
    'bank_name', '',
    'iban', '',
    'bic_swift', '',
    'payment_reason_prefix', 'Caparra soggiorno IschiaStars',
    'payment_instructions', 'Inviare copia del pagamento tramite email o WhatsApp.',
    'accepted_balance_methods', jsonb_build_array('Carta', 'Contanti'),
    'updated_at', ''
  )
)
on conflict (key) do nothing;

-- Email ricevute ma non importabili automaticamente: restano revisionabili invece di sparire nei log.
create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  rfc_message_id text,
  subject text,
  received_at timestamptz,
  status text not null default 'needs_review',
  skipped_reason text,
  headers jsonb not null default '[]'::jsonb,
  body_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inbound_emails drop constraint if exists inbound_emails_status_check;
alter table public.inbound_emails add constraint inbound_emails_status_check check (status in ('needs_review','imported','skipped'));

create index if not exists inbound_emails_status_idx on public.inbound_emails(status);
create index if not exists inbound_emails_received_at_idx on public.inbound_emails(received_at desc);

alter table public.inbound_emails enable row level security;
drop policy if exists "operators manage inbound emails" on public.inbound_emails;
create policy "operators manage inbound emails" on public.inbound_emails for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.inbound_emails to authenticated, service_role;
