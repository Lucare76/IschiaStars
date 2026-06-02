import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiKey } from '@/lib/admin-api-guard';
import { getImapConfig, pollImapInbox } from '@/lib/imapParser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  if (!getImapConfig()) {
    return NextResponse.json(
      { ok: false, error: 'Casella email non configurata. Verifica MAIL_INBOX_*.' },
      { status: 503 }
    );
  }

  const result = await pollImapInbox();

  return NextResponse.json({
    ok: result.errors.length === 0,
    provider: result.provider,
    mailbox: result.mailbox,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    ignored: result.ignored,
    needsReview: result.needsReview,
    errors: result.errors,
  });
}
