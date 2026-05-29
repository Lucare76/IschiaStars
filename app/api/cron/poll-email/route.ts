import { pollGmail } from '@/lib/gmailParser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  await pollGmail();
  return Response.json({ ok: true });
}
