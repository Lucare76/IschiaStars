import { AdminShell } from "@/components/AdminShell";

export default function Loading() {
  return (
    <AdminShell title="" subtitle="">
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-white/60" />
        <div className="h-64 rounded-2xl bg-white/60" />
        <div className="h-64 rounded-2xl bg-white/60" />
      </div>
    </AdminShell>
  );
}
