import { pollGmail } from '@/lib/gmailParser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  console.info('[cron-email] start');

  const result = await pollGmail();

  console.info(`[cron-email] completed imported=${result.imported} skipped=${result.skipped} duplicates=${result.duplicates} ignored=${result.ignored} needsReview=${result.needsReview} deletedKnown=${result.deletedKnown} errors=${result.errors.length}`);

  return Response.json({
    ok: result.errors.length === 0,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    ignored: result.ignored,
    needsReview: result.needsReview,
    deletedKnown: result.deletedKnown,
    errors: result.errors,
    details: result.details
  });
}
