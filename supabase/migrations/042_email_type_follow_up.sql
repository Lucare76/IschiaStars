-- Migration 042: aggiunge follow_up_to_client al vincolo CHECK di email_logs.email_type
-- Serve per tracciare l'invio dell'email di follow-up (promemoria preventivo) da parte
-- di Diego, distinta dall'email preventivo iniziale (quote_to_client).

alter table public.email_logs
  drop constraint if exists email_logs_email_type_check;

alter table public.email_logs
  add constraint email_logs_email_type_check
  check (email_type in (
    'quote_to_client',
    'confirmation_internal',
    'final_confirmation_to_client',
    'voucher_to_client',
    'supplier_confirmation',
    'unavailability_to_client',
    'follow_up_to_client'
  ));
