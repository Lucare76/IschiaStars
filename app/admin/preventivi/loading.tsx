import { AdminShell } from "@/components/AdminShell";

export default function Loading() {
  return (
    <AdminShell title="Preventivi" subtitle="">
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-2xl bg-white/60" />
        <div className="h-48 rounded-2xl bg-white/60" />
        <div className="h-48 rounded-2xl bg-white/60" />
        <div className="h-48 rounded-2xl bg-white/60" />
      </div>
    </AdminShell>
  );
}
