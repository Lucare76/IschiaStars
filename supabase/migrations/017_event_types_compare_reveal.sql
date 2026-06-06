-- Migration 017: Aggiunge compare_opened e reveal_options_clicked al vincolo CHECK
-- degli event_type in quote_events. Ricostruisce il constraint includendo tutti i
-- valori precedenti (migration 006) più i due nuovi tipi introdotti lato client.

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
    'alternative_to_propose',
    'compare_opened',
    'reveal_options_clicked'
  ));
