import { redirect } from "next/navigation";
import { LabPageClient } from "@/components/lab/LabPageClient";
import { getFeatureFlags } from "@/lib/repositories/settings";
import { listLabTestQuotes } from "@/lib/repositories/quotes";
import { getAdminSession } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function SupervisorLabPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    redirect("/admin");
  }

  const [featureFlagsResult, testQuotes] = await Promise.all([
    getFeatureFlags(),
    listLabTestQuotes()
  ]);

  return (
    <LabPageClient
      initialFlags={featureFlagsResult.data}
      initialTestQuotes={testQuotes}
    />
  );
}
