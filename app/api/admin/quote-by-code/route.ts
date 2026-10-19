import { getQuoteByCode } from "@/lib/repositories/quotes";
import { createQuoteByCodeHandler } from "@/lib/server/admin-quote-by-code";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = createQuoteByCodeHandler({
  authorize: requireAdminApiAccess,
  getQuoteByCode
});
