import Link from "next/link";
import { DashboardStats } from "@/lib/repositories/stats";
import { dashboardStats } from "@/lib/utils";

export function StatsCards({ stats: providedStats }: { stats?: DashboardStats }) {
  const stats = providedStats ?? dashboardStats();
  const cards = [
    { label: "Da evadere", value: stats.pendingRequests, href: "/admin/preventivi-da-evadere" },
    { label: "Evasi", value: stats.sentQuotes, href: "/admin/preventivi?filter=evasi" },
    { label: "Confermati", value: stats.confirmedQuotes, href: "/admin/preventivi?filter=confermati" },
    { label: "Aperti", value: stats.openedQuotes, href: "/admin/preventivi?filter=aperti" },
    { label: "Click WhatsApp", value: stats.whatsappClicks, href: "/admin/preventivi?filter=click_whatsapp" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ label, value, href }) => (
        <Link
          key={label}
          href={href}
          className="flex min-h-32 flex-col justify-between rounded-2xl bg-white/90 p-5 shadow-soft ring-1 ring-white transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ischia-blue focus:ring-offset-2"
        >
          <p className="max-w-32 text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue">{label}</p>
          <p className="mt-4 text-3xl font-black leading-none text-ischia-navy tabular-nums">{value}</p>
        </Link>
      ))}
    </div>
  );
}
