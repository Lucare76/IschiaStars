-- Restrict direct authenticated access to the authorized backoffice users.
-- Service-role clients continue to bypass RLS.

drop policy if exists "operators manage hotels" on public.hotels;
create policy "operators manage hotels" on public.hotels
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage quote requests" on public.quote_requests;
create policy "operators manage quote requests" on public.quote_requests
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage quote request children" on public.quote_request_children;
create policy "operators manage quote request children" on public.quote_request_children
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage quotes" on public.quotes;
create policy "operators manage quotes" on public.quotes
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage quote children" on public.quote_children;
create policy "operators manage quote children" on public.quote_children
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators read quote events" on public.quote_events;
drop policy if exists "operators create quote events" on public.quote_events;
drop policy if exists "operators manage quote events" on public.quote_events;
create policy "operators manage quote events" on public.quote_events
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage confirmations" on public.quote_confirmations;
create policy "operators manage confirmations" on public.quote_confirmations
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators read status history" on public.quote_status_events;
drop policy if exists "operators create status history" on public.quote_status_events;
drop policy if exists "operators manage status history" on public.quote_status_events;
create policy "operators manage status history" on public.quote_status_events
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage settings" on public.settings;
create policy "operators manage settings" on public.settings
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage quote hotel options" on public.quote_hotel_options;
create policy "operators manage quote hotel options" on public.quote_hotel_options
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage inbound emails" on public.inbound_emails;
create policy "operators manage inbound emails" on public.inbound_emails
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

drop policy if exists "operators manage email import ledger" on public.email_import_ledger;
drop policy if exists "operators read email import ledger" on public.email_import_ledger;
drop policy if exists "operators insert email import ledger" on public.email_import_ledger;
drop policy if exists "operators update email import ledger" on public.email_import_ledger;
create policy "operators manage email import ledger" on public.email_import_ledger
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));
