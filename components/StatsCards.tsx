import Link from "next/link";
import { DashboardStats } from "@/lib/repositories/stats";
import { dashboardStats, formatCurrency } from "@/lib/utils";

export function StatsCards({ stats: providedStats }: { stats?: DashboardStats }) {
  const stats = providedStats ?? dashboardStats();
  const cards: { label: string; value: string | number; href: string; highlight?: boolean }[] = [
    { label: "Da evadere", value: stats.pendingRequests, href: "/admin/preventivi-da-evadere", highlight: stats.pendingRequests > 0 },
    { label: "Evasi", value: stats.sentQuotes, href: "/admin/preventivi?filter=evasi" },
    { label: "Confermati", value: stats.confirmedQuotes, href: "/admin/preventivi?filter=confermati" },
    { label: "Aperti", value: stats.openedQuotes, href: "/admin/preventivi?filter=aperti" },
    { label: "Click WhatsApp", value: stats.whatsappClicks, href: "/admin/preventivi?filter=click_whatsapp" },
    { label: "Valore confermato", value: formatCurrency(stats.confirmedValue), href: "/admin/preventivi?filter=confermati" },
    { label: "Conversione", value: `${stats.conversionRate}%`, href: "/admin/statistiche" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map(({ label, value, href, highlight }) => (
        <Link
          key={label}
          href={href}
          className={`flex min-h-28 flex-col justify-between rounded-2xl p-5 shadow-soft ring-1 ring-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ischia-blue focus:ring-offset-2 ${highlight ? "bg-ischia-sun/60 hover:bg-ischia-sun/80" : "bg-white/90 hover:bg-white"}`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
          <p className="mt-3 text-2xl font-black leading-none text-ischia-navy tabular-nums">{value}</p>
        </Link>
      ))}
    </div>
  );
}
