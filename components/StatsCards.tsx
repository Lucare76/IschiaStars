import Link from "next/link";
import { DashboardStats } from "@/lib/repositories/stats";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const quoteStats = [
    {
      label: "Preventivi ricevuti",
      value: stats.createdQuotes,
      href: "/admin/preventivi",
      tone: "navy"
    },
    {
      label: "Da evadere",
      value: stats.pendingRequests,
      href: "/admin/preventivi-da-evadere",
      tone: stats.pendingRequests > 0 ? "amber" : "navy"
    },
    {
      label: "Preventivi inviati",
      value: stats.sentQuotes,
      href: "/admin/preventivi?filter=evasi",
      tone: "blue"
    },
    {
      label: "Confermati",
      value: stats.confirmedQuotes,
      href: "/admin/preventivi?filter=confermati",
      tone: stats.confirmedQuotes > 0 ? "green" : "navy"
    },
    {
      label: "Conversione",
      value: `${stats.conversionRate}%`,
      href: "/admin/statistiche",
      tone: "sand"
    }
  ] as const;

  const interestStats = [
    {
      label: "Visualizzati più volte",
      value: stats.repeatedlyViewedQuotes,
      href: "/admin/follow-up?filter=caldi",
      tone: "sand"
    },
    {
      label: "Clienti caldi",
      value: stats.hotCustomers,
      href: "/admin/follow-up?filter=caldi",
      tone: stats.hotCustomers > 0 ? "red" : "navy"
    }
  ] as const;

  const secondary = [
    {
      label: "Scaduti",
      value: stats.expiredQuotes,
      href: "/admin/preventivi?filter=scaduti"
    },
    {
      label: "Click WhatsApp",
      value: stats.whatsappClicks,
      href: "/admin/preventivi?filter=click_whatsapp"
    }
  ];

  return (
    <div className="space-y-7">
      <DashboardSection
        title="Operatività preventivi"
        description="Numeri gestionali: richieste, invii e conferme."
        cards={quoteStats}
      />

      <DashboardSection
        title="Interesse cliente"
        description="Azioni sulla pagina preventivo, separate dalle aperture email."
        cards={interestStats}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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

type DashboardCard = {
  label: string;
  value: string | number;
  href?: string;
  tone: "navy" | "blue" | "green" | "amber" | "red" | "sand";
};

function DashboardSection({
  title,
  description,
  cards
}: {
  title: string;
  description: string;
  cards: readonly DashboardCard[];
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-black text-ischia-navy">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-ischia-ink/55">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const content = (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-current/70">{card.label}</p>
              <p className="mt-4 break-words text-3xl font-black leading-none tabular-nums sm:text-4xl">{card.value}</p>
            </>
          );
          const className = `flex min-h-28 flex-col justify-between rounded-2xl p-3 shadow-soft ring-1 transition sm:p-4 ${toneClass(card.tone)}`;
          return card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className={`${className} hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ischia-blue focus:ring-offset-2`}
            >
              {content}
            </Link>
          ) : (
            <div key={card.label} className={className}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

function toneClass(tone: DashboardCard["tone"]) {
  const classes: Record<DashboardCard["tone"], string> = {
    navy: "bg-white/90 text-ischia-navy ring-white",
    blue: "bg-sky-50 text-sky-900 ring-sky-100",
    green: "bg-emerald-50 text-emerald-900 ring-emerald-100",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    red: "bg-rose-50 text-rose-900 ring-rose-100",
    sand: "bg-orange-50 text-orange-900 ring-orange-100"
  };
  return classes[tone];
}
