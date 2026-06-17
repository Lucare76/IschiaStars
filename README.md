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

`ADMIN_API_KEY` autentica solo le chiamate del cron di sistema (`/api/cron/*`). Non deve essere `NEXT_PUBLIC`.

Il file `supabase/.env` non viene letto da Next.js. In locale usa `.env.local`; in produzione configura le variabili nella dashboard Vercel.

## Accesso backoffice

Supabase Auth è necessario per accedere al backoffice.

1. Apri Supabase Dashboard.
2. Vai in **Authentication** -> **Users**.
3. Crea manualmente il primo utente admin con email dell'operatore.
4. Imposta una password temporanea.
5. Comunica le credenziali all'operatore e aggiornale secondo la policy interna.

Non esiste registrazione pubblica dal sito.

Le pagine `/admin` e `/admin/*` sono protette. Se l'utente non è autenticato viene reindirizzato a `/login`; se un utente già autenticato apre `/login`, viene riportato a `/admin`.

La pagina preventivo cliente resta pubblica solo tramite link sicuro `code + token` e non richiede login:

```text
/preventivi/[code]?token=[token]
```

`ADMIN_API_KEY` autentica esclusivamente le chiamate del cron di sistema. Le API admin del backoffice accettano solo una sessione valida (cookie + email in whitelist), non l'header `X-Admin-Key`.

## Vercel

Configura queste variabili su Vercel:

```env
NEXT_PUBLIC_SITE_URL=https://preventivi.ischiastars.it
NEXT_PUBLIC_ISCHIASTARS_WHATSAPP=393717590017
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
ADMIN_API_KEY=chiave_lunga_segreta
CRON_SECRET=chiave_lunga_segreta_cron
BREVO_ENABLED=true
BREVO_API_KEY=xxxxx
BREVO_FROM_EMAIL=info@ischiastars.it
BREVO_FROM_NAME=IschiaStars
BREVO_INTERNAL_NOTIFY_EMAIL=info@ischiastars.it
BREVO_INTERNAL_CC_EMAIL=ischiastarspreventivi@gmail.com
WORDPRESS_BASE_URL=https://ischiastars.it
WORDPRESS_USERNAME=xxxxx
WORDPRESS_APP_PASSWORD=xxxxx
GMAIL_CLIENT_ID=xxxxx
GMAIL_CLIENT_SECRET=xxxxx
GMAIL_REFRESH_TOKEN=xxxxx
GMAIL_EMAIL=ischiastarspreventivi@gmail.com
```

Dopo il deploy, esegui uno smoke test sull'URL pubblico:

```powershell
$env:SMOKE_BASE_URL='https://preventivi.ischiastars.it'
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

Da `/admin/hotel`, il pulsante **Sincronizza hotel dal sito** importa o aggiorna le strutture presenti nella pagina pubblica degli hotel IschiaStars. La sincronizzazione aggiorna i dati ricavati dal sito, come nome, località, stelle, immagine, URL sorgente e data ultimo rilevamento.

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

Queste API admin richiedono una sessione backoffice valida (cookie di sessione + email in whitelist):

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

`ADMIN_API_KEY` / header `X-Admin-Key` non sono più accettati su queste rotte: solo il cron di sistema (`/api/cron/*`) può autenticarsi tramite chiave server-side.

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

## Preventivi di Test e Statistiche

Durante i test o le demo vengono spesso creati preventivi che falserebbero i conteggi reali. Il backoffice offre due azioni per gestirli.

### Escludi dalle statistiche

Usa **"Escludi dalle statistiche"** quando vuoi tenere il preventivo visibile nel backoffice ma non vuoi che influenzi i conteggi.

- Il preventivo resta accessibile in `/admin/preventivi` con badge "Escluso stats".
- Non viene conteggiato in: preventivi creati, aperture, click WhatsApp, conferme, conversion rate, valore confermato.
- Il link pubblico del preventivo continua a funzionare.
- Il cliente può ancora confermare (ma la conferma non conta nelle statistiche).
- Puoi reincluderlo in qualsiasi momento con **"Reincludi nelle statistiche"**.

### Cancella preventivo

Usa **"Cancella"** per rimuovere un preventivo dalla vista operativa.

- Il preventivo viene nascosto dall lista principale (soft delete).
- Il link pubblico mostra "Preventivo non disponibile o link non valido".
- Non accetta nuove conferme.
- Non compare nelle statistiche.
- Puoi visualizzarlo e ripristinarlo dal filtro **"Cancellati"** in `/admin/preventivi`.

### Filtri disponibili

In `/admin/preventivi` il selettore offre:

| Filtro | Mostra |
|--------|--------|
| Attivi | Solo preventivi attivi e non esclusi |
| Tutti (non cancellati) | Tutto eccetto cancellati |
| Esclusi dalle statistiche | Solo gli esclusi |
| Cancellati | Solo i cancellati (ripristinabili) |

### Schema DB aggiunto

```sql
alter table public.quotes add column if not exists excluded_from_stats boolean not null default false;
alter table public.quotes add column if not exists deleted_at timestamptz;
alter table public.quotes add column if not exists deleted_reason text;
```

Esegui questa migration nel SQL editor di Supabase se stai aggiornando un progetto esistente.

---

## Email Transazionali (Brevo)

Il sistema invia due email automatiche tramite Brevo:

1. **Email al cliente** — inviata quando l'admin crea un preventivo, contiene il link pubblico al preventivo.
2. **Email interna** — inviata a `BREVO_INTERNAL_NOTIFY_EMAIL` quando il cliente conferma il preventivo online.

### Requisiti Brevo

- Crea un account su [brevo.com](https://www.brevo.com) e genera una API key transazionale.
- Verifica il mittente `info@ischiastars.it` nella dashboard Brevo.
- Autentica il dominio `ischiastars.it` (SPF, DKIM) dalle impostazioni mittenti Brevo.

### Variabili Ambiente Brevo

```env
BREVO_ENABLED=true
BREVO_API_KEY=xkeysib-...
BREVO_FROM_EMAIL=info@ischiastars.it
BREVO_FROM_NAME=IschiaStars
BREVO_INTERNAL_NOTIFY_EMAIL=info@ischiastars.it
```

- `BREVO_ENABLED=true` abilita l'invio. Con `false` o variabile assente, nessuna email viene inviata e il sistema funziona normalmente.
- `BREVO_API_KEY` è solo server-side: **non usare mai** `NEXT_PUBLIC_BREVO_API_KEY`.
- In locale inserisci le variabili in `.env.local`; in produzione configura su Vercel → Settings → Environment Variables.
- Se Brevo fallisce (API key errata, mittente non verificato, errore rete), il preventivo viene comunque salvato e la conferma funziona: l'errore compare solo nei log server.

### Comportamento senza Brevo

Con `BREVO_ENABLED=false` (default in `.env.example`):

- La creazione preventivo funziona normalmente.
- La conferma preventivo funziona normalmente.
- Nessuna email viene inviata.
- I log mostrano `[brevo] skipped: disabled`.

## Funzioni Fuori Scope

- WhatsApp Business API.
- Newsletter e campagne marketing.
- PDF server-side o storage PDF.
- Pagamenti online.
- Firma digitale.
- Automazioni avanzate.
- CRM completo.
- Report avanzati.

## Sicurezza

- La `SUPABASE_SERVICE_ROLE_KEY` è usata solo lato server.
- Le pagine pubbliche validano `code + token`.
- Le note interne non vengono esposte nella pagina cliente.
- I token preventivo sono generati con `crypto.randomUUID()`.
- I preventivi pubblici usano `noindex,nofollow`.
- Il backoffice operativo richiede Supabase Auth configurato.
