import { pollGmail } from '@/lib/gmailParser';

export async function GET() {
  await pollGmail();
  return Response.json({ ok: true });
}
