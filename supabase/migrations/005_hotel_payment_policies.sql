-- Payment/cancellation conditions per hotel and per quoted hotel option.
-- Existing quotes keep their stored option values; hotel defaults are only copied
-- when a new quote option is created or edited.

alter table public.hotels add column if not exists default_deposit_percent numeric(5,2);
alter table public.hotels add column if not exists default_balance_method text;
alter table public.hotels add column if not exists default_payment_notes text;

alter table public.quote_hotel_options add column if not exists deposit_percent numeric(5,2);
alter table public.quote_hotel_options add column if not exists balance_method text;
alter table public.quote_hotel_options add column if not exists payment_notes text;

alter table public.quote_confirmations add column if not exists selected_deposit_percent numeric(5,2);
alter table public.quote_confirmations add column if not exists selected_deposit_amount numeric(10,2);
alter table public.quote_confirmations add column if not exists selected_balance_amount numeric(10,2);
alter table public.quote_confirmations add column if not exists selected_balance_method text;
alter table public.quote_confirmations add column if not exists selected_payment_policy text;
alter table public.quote_confirmations add column if not exists selected_cancellation_policy text;
alter table public.quote_confirmations add column if not exists payment_settings_snapshot jsonb;

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

-- Backfill defaults only when the hotel fields are empty.
update public.hotels
set
  default_deposit_percent = coalesce(default_deposit_percent, 20),
  default_balance_method = coalesce(nullif(default_balance_method, ''), 'Saldo restante in struttura con carta o contanti.'),
  payment_policy = case when coalesce(payment_policy, '') = '' then 'Acconto 20% alla conferma. Saldo restante in struttura con carta o contanti.' else payment_policy end,
  cancellation_policy = case when coalesce(cancellation_policy, '') = '' then 'La cancellazione o modifica della prenotazione è consentita senza penale entro 14 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.' else cancellation_policy end
where lower(name) like any (array['%felix%', '%royal%', '%alexander%']);

update public.hotels
set
  default_deposit_percent = coalesce(default_deposit_percent, 15),
  default_balance_method = coalesce(nullif(default_balance_method, ''), 'Saldo restante in struttura con carta o contanti.'),
  payment_policy = case when coalesce(payment_policy, '') = '' then 'Acconto 15% alla conferma. Saldo restante in struttura con carta o contanti.' else payment_policy end,
  cancellation_policy = case when coalesce(cancellation_policy, '') = '' then 'La cancellazione o modifica della prenotazione è consentita senza penale entro 14 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.' else cancellation_policy end
where lower(name) like any (array['%re ferdinando%', '%saint raphael%', '%president%', '%augusto%', '%pineta%']);

update public.hotels
set
  default_deposit_percent = coalesce(default_deposit_percent, 25),
  default_balance_method = coalesce(nullif(default_balance_method, ''), 'Saldo restante in struttura con carta o contanti.'),
  payment_policy = case when coalesce(payment_policy, '') = '' then 'Acconto 25% alla conferma. Saldo restante in struttura con carta o contanti.' else payment_policy end,
  cancellation_policy = case when coalesce(cancellation_policy, '') = '' then 'La cancellazione o modifica della prenotazione è consentita senza penale entro 7 giorni prima della data di arrivo. L’eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l’intero importo della prenotazione resta dovuto. I pasti non fruiti non danno diritto a rimborso.' else cancellation_policy end
where lower(name) like any (array['%castiglione village%', '%tramonto d%oro%', '%tramonto d oro%']);
