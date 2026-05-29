insert into public.hotels (id, name, location, stars, short_description, image_url, standard_services, payment_policy, cancellation_policy, internal_notes, is_active)
values
  ('00000000-0000-4000-8000-000000000001', 'Hotel Terme Felix', 'Ischia Porto', 4, 'Hotel centrale con piscine termali e posizione comoda per il porto.', null, '["Camera comfort","Piscine termali","Assistenza IschiaStars","Wi-Fi"]', 'Acconto alla conferma e saldo secondo condizioni struttura.', 'Cancellazione secondo policy comunicata nel preventivo.', 'Buona proposta per coppie e famiglie.', true),
  ('00000000-0000-4000-8000-000000000002', 'Hotel San Lorenzo', 'Lacco Ameno', 4, 'Struttura elegante in zona Lacco Ameno, adatta a soggiorni relax.', null, '["Prima colazione","Area relax","Percorso benessere","Assistenza WhatsApp"]', 'Acconto 30% alla conferma, saldo prima dell''arrivo o in struttura.', 'Penali variabili in base alla tariffa confermata.', 'Verificare disponibilita camere superior.', true),
  ('00000000-0000-4000-8000-000000000003', 'Hotel President Terme', 'Ischia Porto', 4, 'Hotel termale con servizi completi e atmosfera classica ischitana.', null, '["Mezza pensione","Piscina termale","Centro benessere","Assistenza IschiaStars"]', 'Acconto richiesto alla conferma.', 'Cancellazione gratuita entro scadenza offerta salvo tariffe speciali.', 'Adatto a clienti interessati alle terme.', true),
  ('00000000-0000-4000-8000-000000000004', 'Formula Roulette 4 Stelle', 'Ischia', 4, 'Formula flessibile su hotel selezionati 4 stelle a Ischia.', null, '["Hotel 4 stelle selezionato","Trattamento indicato nel preventivo","Assistenza diretta","Soluzione su misura"]', 'Acconto alla conferma, saldo secondo struttura assegnata.', 'Condizioni comunicate prima della conferma definitiva.', 'Usare quando serve alternativa competitiva.', true)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  stars = excluded.stars,
  short_description = excluded.short_description,
  standard_services = excluded.standard_services,
  payment_policy = excluded.payment_policy,
  cancellation_policy = excluded.cancellation_policy,
  internal_notes = excluded.internal_notes,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.quote_requests (id, first_name, last_name, email, phone, destination, check_in, check_out, adults, children_count, rooms, treatment, message, status, metadata)
values
  ('10000000-0000-4000-8000-000000000001', 'Mario', 'Rossi', 'mario.rossi@example.com', '+39 347 111 2233', 'Ischia Porto', '2026-07-12', '2026-07-19', 2, 1, 1, 'Mezza pensione', 'Vorremmo piscina termale e una soluzione comoda per il centro.', 'da_evadere', '{"requested_hotel":"Hotel Terme Felix"}'),
  ('10000000-0000-4000-8000-000000000002', 'Laura', 'Bianchi', 'laura.bianchi@example.com', '+39 333 222 4455', 'Lacco Ameno', '2026-06-20', '2026-06-27', 2, 0, 1, 'Prima colazione', 'Preferiamo una struttura elegante, tranquilla e con servizi benessere.', 'preventivo_inviato', '{"requested_hotel":"Hotel San Lorenzo"}'),
  ('10000000-0000-4000-8000-000000000003', 'Famiglia', 'Esposito', 'famiglia.esposito@example.com', '+39 371 759 0017', 'Ischia', '2026-08-04', '2026-08-11', 2, 2, 1, 'Pensione completa', 'Vorremmo l''Hotel Terme Felix, pensione completa e una soluzione adatta ai bambini.', 'preventivo_inviato', '{"requested_hotel":"Hotel Terme Felix"}')
on conflict (id) do nothing;

insert into public.quote_request_children (quote_request_id, birth_date)
values
  ('10000000-0000-4000-8000-000000000001', '2018-04-18'),
  ('10000000-0000-4000-8000-000000000003', '2016-05-10'),
  ('10000000-0000-4000-8000-000000000003', '2020-09-22')
on conflict do nothing;

insert into public.quotes (id, quote_request_id, code, public_token, client_first_name, client_last_name, client_email, client_phone, hotel_requested, hotel_id, alternative_hotel_id, is_alternative_offer, check_in, check_out, adults, children_count, rooms, treatment, total_price, deposit_amount, valid_until, included_services, transport_offers, payment_policy, cancellation_policy, public_notes, internal_notes, status, confirmed_at)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'IS-2026-001', 'preview-token-ischiastars', 'Laura', 'Bianchi', 'laura.bianchi@example.com', '+39 333 222 4455', 'Hotel San Lorenzo', '00000000-0000-4000-8000-000000000002', null, false, '2026-06-20', '2026-06-27', 2, 0, 1, 'Prima colazione', 1450, 360, '2026-05-30', '["Prima colazione","Area relax","Percorso benessere","Assistenza WhatsApp"]', '[]', 'Acconto 30% alla conferma, saldo prima dell''arrivo o in struttura.', 'Penali variabili in base alla tariffa confermata.', 'Abbiamo selezionato una proposta elegante e tranquilla a Lacco Ameno, con servizi benessere e assistenza IschiaStars.', 'Proposta aperta dalla cliente dopo invio WhatsApp.', 'preventivo_inviato', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'IS-2026-002', 'preview-token-famiglia-esposito', 'Famiglia', 'Esposito', 'famiglia.esposito@example.com', '+39 371 759 0017', 'Hotel Terme Felix', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', true, '2026-08-04', '2026-08-11', 2, 2, 1, 'Pensione completa', 2380, 595, '2026-05-31', '["Mezza pensione","Piscina termale","Centro benessere","Assistenza IschiaStars"]', '[]', 'Acconto richiesto alla conferma.', 'Cancellazione gratuita entro scadenza offerta salvo tariffe speciali.', 'La struttura richiesta non è disponibile per le date selezionate. Abbiamo selezionato per te una proposta alternativa con caratteristiche simili.', 'Felix non disponibile: proposta President Terme per famiglia.', 'preventivo_inviato', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'IS-2026-003', 'preview-token-anna-romano', 'Anna', 'Romano', 'anna.romano@example.com', '+39 333 908 1122', 'Formula Roulette 4 Stelle', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', true, '2026-08-04', '2026-08-11', 2, 2, 1, 'Pensione completa', 2380, 595, '2026-05-16', '["Hotel 4 stelle selezionato","Pensione completa","Assistenza diretta","Soluzione famiglia"]', '[]', 'Acconto alla conferma, saldo secondo struttura assegnata.', 'Condizioni comunicate prima della conferma definitiva.', 'Formula flessibile per famiglia su hotel 4 stelle selezionati con assistenza IschiaStars.', 'Esempio gia confermato per statistiche base.', 'confermato', now())
on conflict (id) do update set
  total_price = excluded.total_price,
  deposit_amount = excluded.deposit_amount,
  status = excluded.status,
  updated_at = now();

insert into public.quote_children (quote_id, birth_date)
values
  ('20000000-0000-4000-8000-000000000002', '2016-05-10'),
  ('20000000-0000-4000-8000-000000000002', '2020-09-22'),
  ('20000000-0000-4000-8000-000000000003', '2016-05-10'),
  ('20000000-0000-4000-8000-000000000003', '2020-09-22')
on conflict do nothing;

insert into public.quote_events (quote_id, event_type, metadata)
values
  ('20000000-0000-4000-8000-000000000001', 'quote_opened', '{"seed":true}'),
  ('20000000-0000-4000-8000-000000000001', 'whatsapp_clicked', '{"seed":true}'),
  ('20000000-0000-4000-8000-000000000003', 'quote_opened', '{"seed":true}'),
  ('20000000-0000-4000-8000-000000000003', 'confirm_clicked', '{"seed":true}'),
  ('20000000-0000-4000-8000-000000000003', 'quote_confirmed', '{"seed":true}')
on conflict do nothing;

insert into public.quote_confirmations (quote_id, first_name, last_name, fiscal_code, phone, email, address, city, postal_code, province, accepted_terms, accepted_privacy, metadata)
values
  ('20000000-0000-4000-8000-000000000003', 'Anna', 'Romano', 'RMNNNA80A41F839X', '+39 333 908 1122', 'anna.romano@example.com', 'Via Roma 10', 'Napoli', '80100', 'NA', true, true, '{"seed":true}')
on conflict (quote_id) do nothing;

insert into public.quote_status_events (quote_id, from_status, to_status, note)
values
  ('20000000-0000-4000-8000-000000000001', null, 'preventivo_inviato', 'Seed: preventivo creato'),
  ('20000000-0000-4000-8000-000000000002', null, 'preventivo_inviato', 'Seed: preventivo creato'),
  ('20000000-0000-4000-8000-000000000003', null, 'preventivo_inviato', 'Seed: preventivo creato'),
  ('20000000-0000-4000-8000-000000000003', 'preventivo_inviato', 'confermato', 'Seed: preventivo confermato')
on conflict do nothing;
