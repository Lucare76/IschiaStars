alter table public.quote_confirmations add column if not exists availability_status text not null default 'availability_to_check';
alter table public.quote_confirmations add column if not exists deposit_due_at timestamptz;
alter table public.quote_confirmations add column if not exists final_confirmation_sent_at timestamptz;
alter table public.quote_confirmations add column if not exists final_confirmation_notes text;
alter table public.quote_confirmations add column if not exists unavailable_reason text;
alter table public.quote_confirmations add column if not exists unavailability_email_sent_at timestamptz;
alter table public.quote_confirmations add column if not exists availability_updated_at timestamptz;

alter table public.quote_confirmations
  drop constraint if exists quote_confirmations_availability_status_check;

alter table public.quote_confirmations
  add constraint quote_confirmations_availability_status_check
  check (availability_status in (
    'availability_to_check',
    'availability_confirmed',
    'final_confirmation_sent',
    'deposit_waiting',
    'availability_unavailable',
    'alternative_to_propose'
  ));

create index if not exists quote_confirmations_availability_status_idx
  on public.quote_confirmations(availability_status);

alter table public.quote_events
  drop constraint if exists quote_events_event_type_check;

alter table public.quote_events
  add constraint quote_events_event_type_check
  check (event_type in (
    'quote_opened',
    'whatsapp_clicked',
    'confirm_clicked',
    'quote_confirmed',
    'print_clicked',
    'hotel_link_clicked',
    'details_opened',
    'follow_up_whatsapp_click',
    'availability_confirmed',
    'final_confirmation_email_sent',
    'deposit_due_at_set',
    'availability_unavailable',
    'availability_unavailable_email_sent',
    'alternative_to_propose'
  ));
