# Sistema Preventivi IschiaStars

Versione operativa Next.js App Router per gestire preventivi turistici IschiaStars: backoffice, richieste da evadere, hotel, link pubblico cliente, invio WhatsApp manuale, conferma online, tracking aperture e stampa PDF via browser.

## Avvio Locale

Le variabili locali vanno inserite in `.env.local` nella root del progetto.

```powershell
$env:NODE_OPTIONS='--use-system-ca'
pnpm install
pnpm dev
```

Apri `http://localhost:4000`.

Se compaiono errori 500 con chunk mancanti, ferma il server e pulisci `.next`:

```powershell
Remove-Item -Recurse -Force .next
pnpm dev
```

## Variabili Ambiente

```env
NEXT_PUBLIC_SITE_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ISCHIASTARS_WHATSAPP=393717590017
ADMIN_API_KEY=
```

`NEXT_PUBLIC_SITE_URL` genera i link assoluti dei preventivi inseriti nei messaggi WhatsApp.

`NEXT_PUBLIC_ISCHIASTARS_WHATSAPP` imposta il numero IschiaStars usato nella pagina cliente pubblica. Il bottone backoffice usa invece il numero del cliente.

`ADMIN_API_KEY` resta una protezione server-side per chiamate controllate e integrazioni. Non deve essere `NEXT_PUBLIC`.

Il file `supabase/.env` non viene letto da Next.js. In locale usa `.env.local`; in produzione configura le variabili nella dashboard Vercel.

## Accesso backoffice

Supabase Auth e necessario per accedere al backoffice.

1. Apri Supabase Dashboard.
2. Vai in **Authentication** -> **Users**.
3. Crea manualmente il primo utente admin con email dell'operatore.
4. Imposta una password temporanea.
5. Comunica le credenziali all'operatore e aggiornale secondo la policy interna.

Non esiste registrazione pubblica dal sito.

Le pagine `/admin` e `/admin/*` sono protette. Se l'utente non e autenticato viene reindirizzato a `/login`; se un utente gia autenticato apre `/login`, viene riportato a `/admin`.

La pagina preventivo cliente resta pubblica solo tramite link sicuro `code + token` e non richiede login:

```text
/preventivi/[code]?token=[token]
```

`ADMIN_API_KEY` resta utile per proteggere chiamate server-side o integrazioni controllate. Le API admin accettano una sessione backoffice valida oppure l'header `X-Admin-Key` corretto.

## Vercel

Configura queste variabili su Vercel:

```env
NEXT_PUBLIC_SITE_URL=https://ischiastarspreventivi.vercel.app
NEXT_PUBLIC_ISCHIASTARS_WHATSAPP=393717590017
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
ADMIN_API_KEY=chiave_lunga_segreta
```

Dopo il deploy, esegui uno smoke test sull'URL pubblico:

```powershell
$env:SMOKE_BASE_URL='https://ischiastarspreventivi.vercel.app'
pnpm smoke
```

## Supabase

Nel SQL editor del progetto Supabase esegui:

```text
supabase/schema.sql
```

Lo schema crea le tabelle operative:

- `hotels`
- `quote_requests`
- `quote_request_children`
- `quotes`
- `quote_children`
- `quote_events`
- `quote_confirmations`
- `quote_status_events`
- `settings`

Se vuoi dati iniziali per partire, esegui anche:

```text
supabase/seed.sql
```

Il seed inserisce hotel, richieste clienti, preventivi di partenza, tracking, storico stati e una conferma.

## Sincronizzazione hotel dal sito

Il backoffice legge gli hotel da Supabase. Il sito pubblico `ischiastars.it` non viene interrogato a ogni apertura del backoffice: serve solo come sorgente per una sincronizzazione manuale e protetta.

Da `/admin/hotel`, il pulsante **Sincronizza hotel dal sito** importa o aggiorna le strutture presenti nella pagina pubblica degli hotel IschiaStars. La sincronizzazione aggiorna i dati ricavati dal sito, come nome, localita, stelle, immagine, URL sorgente e data ultimo rilevamento.

Servizi inclusi, policy pagamento, policy cancellazione e note operative restano modificabili dal backoffice e non vengono sovrascritti dalla sincronizzazione. La sync non usa WhatsApp API, Resend o servizi esterni a pagamento.

Se il sito cambia struttura HTML, il parser potrebbe richiedere un aggiornamento.

## Flusso Operativo

1. Apri `/admin`.
2. Vai in `/admin/preventivi-da-evadere`.
3. Clicca **Crea preventivo** su una richiesta.
4. Verifica il form precompilato.
5. Seleziona hotel, date, prezzo, servizi e policy.
6. Genera il preventivo.
7. Apri la pagina cliente.
8. Invia il link manualmente via WhatsApp.
9. Il cliente conferma online.
10. Controlla le statistiche.
11. Usa **Stampa / Salva PDF** dalla pagina cliente.

## Anteprima Cliente

Con i dati iniziali, un link cliente utilizzabile in ambiente locale e:

```text
/preventivi/IS-2026-001?token=preview-token-ischiastars
```

In produzione i link vengono generati dal sistema usando `NEXT_PUBLIC_SITE_URL`, codice preventivo e token sicuro.

## API Admin

Queste API admin richiedono una sessione backoffice valida oppure header `X-Admin-Key` corretto:

- `POST /api/quotes`
- `PATCH /api/quotes/[id]`
- `POST /api/quotes/[id]`
- `POST /api/hotels`
- `PATCH /api/hotels/[id]`
- `DELETE /api/hotels/[id]`
- `POST /api/hotels/sync-from-site`
- `POST /api/quote-requests`
- `GET /api/quotes`
- `GET /api/hotels`
- `GET /api/quote-requests`

Header richiesto:

```http
X-Admin-Key: valore-di-ADMIN_API_KEY
```

Il backoffice non usa chiavi salvate nel browser: dopo il login, le chiamate interne passano tramite cookie di sessione httpOnly.

## Smoke Test

Con il server avviato:

```powershell
pnpm smoke
```

Rotte controllate:

- `/`
- `/admin`
- `/admin/preventivi-da-evadere`
- `/admin/preventivi`
- `/admin/preventivi/nuovo`
- `/admin/hotel`
- `/admin/statistiche`
- `/preventivi/IS-2026-001?token=preview-token-ischiastars`

## Stampa PDF

La stampa usa il browser con `window.print()`. Il CSS di stampa nasconde menu e bottoni, mantenendo visibili logo, codice preventivo, hotel, date, prezzo, servizi e policy.

## Funzioni Fuori Scope

- WhatsApp Business API.
- Resend e invio email automatico.
- PDF server-side o storage PDF.
- Pagamenti online.
- Firma digitale.
- Automazioni avanzate.
- CRM completo.
- Report avanzati.

## Sicurezza

- La `SUPABASE_SERVICE_ROLE_KEY` e usata solo lato server.
- Le pagine pubbliche validano `code + token`.
- Le note interne non vengono esposte nella pagina cliente.
- I token preventivo sono generati con `crypto.randomUUID()`.
- I preventivi pubblici usano `noindex,nofollow`.
- Il backoffice operativo richiede Supabase Auth configurato.
