import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiKey } from '@/lib/admin-api-guard';
import { pollEmailNow } from '@/lib/email/poll-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiKey(request);
  if (unauthorized) return unauthorized;

  const result = await pollEmailNow({ source: 'manual' });
  const status = result.cooldownRemainingSeconds ? 429 : result.ok ? 200 : 500;

  return NextResponse.json({
    ok: result.ok,
    provider: result.provider,
    mailbox: result.mailbox,
    processed: result.processed,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
    ignored: result.ignored,
    needsReview: result.needsReview,
    errors: result.errors,
    message: result.message,
    durationMs: result.durationMs,
    ...(result.cooldownRemainingSeconds ? { cooldownRemainingSeconds: result.cooldownRemainingSeconds } : {})
  }, { status });
}
