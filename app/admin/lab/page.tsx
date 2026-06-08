import { redirect } from "next/navigation";
import { LabPageClient } from "@/components/lab/LabPageClient";
import { getActiveHotels } from "@/lib/repositories/hotels";
import { getFeatureFlags } from "@/lib/repositories/settings";
import { listLabTestQuotes } from "@/lib/repositories/quotes";
import { getAdminSession } from "@/lib/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function SupervisorLabPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "supervisor") {
    redirect("/admin");
  }

  const [featureFlagsResult, hotelsResult, testQuotes] = await Promise.all([
    getFeatureFlags(),
    getActiveHotels(),
    listLabTestQuotes()
  ]);

  return (
    <LabPageClient
      initialFlags={featureFlagsResult.data}
      hotels={hotelsResult.data.map((hotel) => ({ id: hotel.id, name: hotel.name }))}
      initialTestQuotes={testQuotes}
    />
  );
}
