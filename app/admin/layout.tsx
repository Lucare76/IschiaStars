import type { ReactNode } from "react";
import { AdminRouteRefresh } from "@/components/AdminRouteRefresh";
import { requireAdminSession } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminSession();
  return (
    <>
      <AdminRouteRefresh />
      {children}
    </>
  );
}
