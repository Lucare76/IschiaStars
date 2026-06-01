import { pollGmail } from '@/lib/gmailParser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET ?? process.env.ADMIN_API_KEY;
  const authorization = request.headers.get('authorization') ?? '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  const queryToken = new URL(request.url).searchParams.get('key');
  const providedSecret = bearerToken ?? queryToken;

  if (!configuredSecret || providedSecret !== configuredSecret) {
    console.info('[cron-email] unauthorized');
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  console.info('[cron-email] start');

  const result = await pollGmail();

  console.info(`[cron-email] completed imported=${result.imported} skipped=${result.skipped} duplicates=${result.duplicates} needsReview=${result.needsReview} errors=${result.errors.length}`);

  return Response.json({
    ok: result.errors.length === 0,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    needsReview: result.needsReview,
    errors: result.errors,
    details: result.details
  });
}
