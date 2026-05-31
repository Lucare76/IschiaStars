alter table public.quote_events
drop constraint if exists quote_events_event_type_check;

alter table public.quote_events
add constraint quote_events_event_type_check
check (
  event_type in (
    'quote_opened',
    'whatsapp_clicked',
    'confirm_clicked',
    'quote_confirmed',
    'print_clicked',
    'hotel_link_clicked',
    'details_opened'
  )
);
