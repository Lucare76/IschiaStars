import { AdminShell } from "@/components/AdminShell";
import { ManualVoucherForm } from "@/components/ManualVoucherForm";

export const dynamic = "force-dynamic";

export default function ManualVoucherPage() {
  return (
    <AdminShell
      title="Voucher manuale"
      subtitle="Genera un voucher per prenotazioni storiche o esterne al gestionale, senza creare un preventivo."
    >
      <ManualVoucherForm />
    </AdminShell>
  );
}
