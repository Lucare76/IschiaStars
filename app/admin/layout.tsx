import type { ReactNode } from "react";
import { requireAdminSession } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminSession();
  return children;
}
