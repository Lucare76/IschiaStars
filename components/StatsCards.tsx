import Link from "next/link";
import { DashboardStats } from "@/lib/repositories/stats";
import { dashboardStats, formatCurrency } from "@/lib/utils";

export function StatsCards({ stats: providedStats }: { stats?: DashboardStats }) {
  const stats = providedStats ?? dashboardStats();

  const primary = [
    {
      label: "Da evadere",
      value: stats.pendingRequests,
      href: "/admin/preventivi-da-evadere",
      style: stats.pendingRequests > 0
        ? "bg-amber-50 ring-amber-200 hover:bg-amber-100 text-amber-900"
        : "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: stats.pendingRequests > 0 ? "text-amber-700" : "text-ischia-navy",
    },
    {
      label: "Evasi",
      value: stats.sentQuotes,
      href: "/admin/preventivi?filter=evasi",
      style: "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: "text-ischia-navy",
    },
    {
      label: "Scaduti",
      value: stats.expiredQuotes,
      href: "/admin/preventivi?filter=scaduti",
      style: stats.expiredQuotes > 0
        ? "bg-slate-100 ring-slate-200 hover:bg-slate-200 text-slate-900"
        : "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: stats.expiredQuotes > 0 ? "text-slate-700" : "text-ischia-navy",
    },
    {
      label: "Confermati",
      value: stats.confirmedQuotes,
      href: "/admin/preventivi?filter=confermati",
      style: stats.confirmedQuotes > 0
        ? "bg-emerald-50 ring-emerald-100 hover:bg-emerald-100 text-emerald-900"
        : "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: stats.confirmedQuotes > 0 ? "text-emerald-700" : "text-ischia-navy",
    },
    {
      label: "Aperti",
      value: stats.openedQuotes,
      href: "/admin/preventivi?filter=aperti",
      style: "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: "text-ischia-navy",
    },
    {
      label: "Mai aperti",
      value: stats.unopenedQuotes,
      href: "/admin/preventivi?filter=non_aperti",
      style: stats.unopenedQuotes > 0
        ? "bg-rose-50 ring-rose-100 hover:bg-rose-100 text-rose-900"
        : "bg-white/90 ring-white hover:bg-white text-ischia-navy",
      valueStyle: stats.unopenedQuotes > 0 ? "text-rose-700" : "text-ischia-navy",
    },
  ];

  const secondary = [
    {
      label: "WhatsApp",
      value: stats.whatsappClicks,
      href: "/admin/preventivi?filter=click_whatsapp",
    },
    {
      label: "Incassato",
      value: formatCurrency(stats.depositReceivedValue),
      href: "/admin/preventivi?filter=confermati",
    },
    {
      label: "Conversione",
      value: `${stats.conversionRate}%`,
      href: "/admin/statistiche",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {primary.map(({ label, value, href, style, valueStyle }) => (
          <Link
            key={label}
            href={href}
            className={`flex min-h-28 flex-col justify-between rounded-2xl p-3 shadow-soft ring-1 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ischia-blue focus:ring-offset-2 sm:p-4 ${style}`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/80">{label}</p>
            <p className={`mt-4 break-words text-3xl font-black leading-none tabular-nums sm:text-4xl ${valueStyle}`}>{value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {secondary.map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-soft ring-1 ring-white transition hover:bg-white hover:shadow-md focus:outline-none"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/70">{label}</p>
            <p className="break-words text-right text-lg font-black text-ischia-navy tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
