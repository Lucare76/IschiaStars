import { NextRequest } from "next/server";
import { requireAdminApiAccess } from "@/lib/server/auth-guard";

export function requireAdminApiKey(request: NextRequest) {
  return requireAdminApiAccess(request);
}
