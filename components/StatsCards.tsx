import Link from "next/link";
import { DashboardStats } from "@/lib/repositories/stats";
import { formatCurrency } from "@/lib/utils";

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

  const emailStats = [
    { label: "Email inviate", value: stats.emailSent, tone: "navy" },
    { label: "Email consegnate", value: stats.emailDelivered, tone: "blue" },
    { label: "Email aperte", value: stats.emailOpened, tone: "green" },
    { label: "Link email cliccati", value: stats.emailClicked, tone: "sand" },
    { label: "Problemi di consegna", value: stats.emailProblems, tone: stats.emailProblems > 0 ? "red" : "navy" }
  ] as const;

  const interestStats = [
    {
      label: "Preventivi visualizzati",
      value: stats.openedQuotes,
      href: "/admin/preventivi?filter=aperti",
      tone: "blue"
    },
    {
      label: "Preventivi non visualizzati",
      value: stats.unopenedQuotes,
      href: "/admin/preventivi?filter=non_aperti",
      tone: stats.unopenedQuotes > 0 ? "amber" : "navy"
    },
    {
      label: "Click email, non confermati",
      value: stats.clickedUnconfirmedQuotes,
      href: "/admin/follow-up?filter=caldi",
      tone: stats.clickedUnconfirmedQuotes > 0 ? "green" : "navy"
    },
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
      label: "Da contattare oggi",
      value: stats.toContactToday,
      href: "/admin/follow-up?filter=non_visualizzati"
    },
    {
      label: "Click WhatsApp",
      value: stats.whatsappClicks,
      href: "/admin/preventivi?filter=click_whatsapp"
    },
    {
      label: "Incassato",
      value: formatCurrency(stats.depositReceivedValue),
      href: "/admin/preventivi?filter=confermati"
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
        title="Stato email Brevo"
        description="Tracking delle sole email di preventivo inviate al cliente."
        cards={emailStats}
      />

      <DashboardSection
        title="Interesse cliente"
        description="Azioni sulla pagina preventivo, separate dalle aperture email."
        cards={interestStats}
      />

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-black text-ischia-navy">Attenzione commerciale</h2>
          <p className="mt-1 text-sm font-semibold text-ischia-ink/55">Le situazioni più utili da controllare adesso.</p>
        </div>
        {stats.attentionItems.length ? (
          <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200">
            {stats.attentionItems.map((item, index) => (
              <Link
                key={item.quoteId}
                href={`/admin/preventivi/${item.quoteCode}`}
                className={`grid gap-2 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <div>
                  <p className="font-black text-ischia-navy">{item.quoteCode}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ischia-ink/60">{item.customerName}</p>
                </div>
                <p className="text-sm font-bold text-ischia-ink/75">{item.status}</p>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${actionClass(item.priority)}`}>
                  {item.action}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/80 p-5 text-sm font-semibold text-ischia-ink/55 ring-1 ring-white">
            Nessuna situazione da segnalare.
          </div>
        )}
      </section>

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

function actionClass(priority: "alta" | "media" | "bassa") {
  if (priority === "alta") return "bg-rose-100 text-rose-800";
  if (priority === "media") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}
