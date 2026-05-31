import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";
import { deleteQuoteRequest } from "@/lib/repositories/quoteRequests";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApiAccess(request);
  if (unauthorized) return unauthorized;

  const result = await deleteQuoteRequest(params.id);
  return NextResponse.json(
    { ok: result.data.deleted, error: result.error },
    { status: result.data.deleted ? 200 : 500 }
  );
}
