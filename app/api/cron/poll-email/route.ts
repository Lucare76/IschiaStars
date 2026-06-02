import { getImapConfig, pollImapInbox } from '@/lib/imapParser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizeSecret(value?: string | null) {
  return value?.trim() || null;
}

export async function GET(request: Request) {
  const configuredSecretEntries = [
    ['CRON_SECRET', process.env.CRON_SECRET],
    ['CRONJOB_ORG_API_KEY', process.env.CRONJOB_ORG_API_KEY],
    ['ADMIN_API_KEY', process.env.ADMIN_API_KEY]
  ] as const;
  const allowedSecrets = configuredSecretEntries
    .map(([, value]) => value)
    .map(normalizeSecret)
    .filter((value): value is string => Boolean(value));
  const acceptedSources = configuredSecretEntries
    .filter(([, value]) => Boolean(normalizeSecret(value)))
    .map(([name]) => name);

  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
  const url = new URL(request.url);
  const providedSecret = normalizeSecret(
    bearerToken ||
      request.headers.get('x-cron-key') ||
      request.headers.get('x-cron-secret') ||
      url.searchParams.get('key') ||
      url.searchParams.get('secret')
  );

  if (!providedSecret || !allowedSecrets.includes(providedSecret)) {
    console.info('[cron-email] unauthorized', {
      hasProvided: Boolean(providedSecret),
      allowedCount: allowedSecrets.length,
      providedLength: providedSecret?.length ?? 0,
      allowedLengths: allowedSecrets.map((secret) => secret.length),
      acceptedSources
    });
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  console.info('[cron-email] authorized');

  if (!getImapConfig()) {
    return Response.json(
      { ok: false, error: 'Casella email non configurata. Verifica MAIL_INBOX_*.' },
      { status: 503 }
    );
  }

  console.info('[cron-email] start provider=imap');

  const result = await pollImapInbox();

  console.info(
    `[cron-email] completed imported=${result.imported} skipped=${result.skipped} duplicates=${result.duplicates} ignored=${result.ignored} needsReview=${result.needsReview} errors=${result.errors.length}`
  );

  return Response.json({
    ok: result.errors.length === 0,
    provider: result.provider,
    mailbox: result.mailbox,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    ignored: result.ignored,
    needsReview: result.needsReview,
    errors: result.errors,
    details: result.details
  });
}
