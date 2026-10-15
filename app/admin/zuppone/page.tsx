import { AdminShell } from "@/components/AdminShell";
import { ZupponeCalculator } from "@/components/ZupponeCalculator";

export default function ZupponePage() {
  return (
    <AdminShell
      title="Zuppone"
      subtitle="Calcola il margine della pratica e ripartiscilo automaticamente tra Diego e Ice."
    >
      <ZupponeCalculator />
    </AdminShell>
  );
}
