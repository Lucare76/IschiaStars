import { getQuoteChipSettings } from "@/lib/repositories/settings";
import { AdminShell } from "@/components/AdminShell";
import { ManualVoucherForm } from "@/components/ManualVoucherForm";

export const dynamic = "force-dynamic";

export default async function ManualVoucherPage() {
  const settings = await getQuoteChipSettings();
  return (
    <AdminShell
      title="Voucher manuale"
      subtitle="Genera un voucher per prenotazioni storiche o esterne al gestionale, senza creare un preventivo."
    >
      <ManualVoucherForm voucherNoteChips={settings.data.voucherNoteChips} />
    </AdminShell>
  );
}
