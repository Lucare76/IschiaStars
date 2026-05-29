import { DashboardStats } from "@/lib/repositories/stats";
import { dashboardStats } from "@/lib/utils";

export function StatsCards({ stats: providedStats }: { stats?: DashboardStats }) {
  const stats = providedStats ?? dashboardStats();
  const cards = [
    ["Preventivi creati", stats.createdQuotes],
    ["Aperti", stats.openedQuotes],
    ["Confermati", stats.confirmedQuotes],
    ["Click WhatsApp", stats.whatsappClicks],
    ["Conversione", `${stats.conversionRate ?? 0}%`]
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-white/90 p-5 shadow-soft ring-1 ring-white">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
          <p className="mt-3 text-3xl font-black text-ischia-navy">{value}</p>
        </div>
      ))}
    </div>
  );
}
