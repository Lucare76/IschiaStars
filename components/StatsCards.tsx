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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="flex min-h-32 flex-col justify-between rounded-2xl bg-white/90 p-5 shadow-soft ring-1 ring-white">
          <p className="max-w-32 text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
          <p className="mt-4 text-3xl font-black leading-none text-ischia-navy tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
