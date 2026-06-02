-- Group D: 30% deposit, bonifico 14gg, cancellazione 20gg
-- Applies only when existing fields are empty (coalesce / nullif pattern).
-- Does NOT overwrite manually set values.

do $$
declare
  v_balance_method text := 'Saldo entro 14 giorni dall''arrivo tramite bonifico bancario.';
  v_payment_policy text := 'Acconto del 30% e saldo entro 14 giorni dall''arrivo tramite bonifico bancario.';
  v_payment_notes  text := 'Saldo da effettuare tramite bonifico bancario entro 14 giorni dalla data di arrivo.';
  v_cancel_policy  text := 'La cancellazione o modifica della prenotazione è consentita senza penale entro 20 giorni prima della data di arrivo. L''eventuale acconto versato resterà valido come credito utilizzabile entro 12 mesi. Oltre tale termine e in caso di no-show, verrà applicata una penale pari al 100% del totale prenotato. In caso di arrivo posticipato, partenza anticipata o riduzione del numero di persone rispetto a quanto prenotato, l''intero importo della prenotazione resta dovuto, senza riduzioni per variazioni della durata del soggiorno o del numero di ospiti. I pasti non fruiti non danno diritto a rimborso.';
begin
  update public.hotels
  set
    default_deposit_percent = coalesce(default_deposit_percent, 30),
    default_balance_method  = coalesce(nullif(trim(default_balance_method), ''), v_balance_method),
    payment_policy          = case when coalesce(trim(payment_policy),          '') = '' then v_payment_policy  else payment_policy          end,
    cancellation_policy     = case when coalesce(trim(cancellation_policy),     '') = '' then v_cancel_policy   else cancellation_policy     end,
    default_payment_notes   = case when coalesce(trim(default_payment_notes),   '') = '' then v_payment_notes   else default_payment_notes   end
  where lower(name) like any (array[
    '%av club%colella%',
    '%club thermal wellness%',
    '%roulette%ischia porto%',
    '%la villa%',
    '%isola verde%',
    '%villa teresa%',
    '%san lorenzo%',
    '%san giovanni%',
    '%don pepe%',
    '%san valentino%',
    '%la rosa%',
    '%pineta%ischia%',
    '%regina palace%',
    '%carlo magno%',
    '%beccaccia%',
    '%punto azzurro%'
  ]);
end $$;
