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
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  await pollGmail();
  return Response.json({ ok: true });
}
