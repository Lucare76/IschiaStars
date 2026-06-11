import Link from "next/link";
import type { ReactNode } from "react";
import { AdminRouteRefresh } from "@/components/AdminRouteRefresh";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { QuoteNotificationsBell } from "@/components/QuoteNotificationsBell";
import { SystemModeBadge } from "@/components/SystemModeBadge";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/preventivi-da-evadere", label: "Da evadere" },
  { href: "/admin/follow-up", label: "Follow-up" },
  { href: "/admin/preventivi", label: "Preventivi evasi" },
  { href: "/admin/conferme", label: "Confermati" },
  { href: "/admin/preventivi/nuovo", label: "+ Nuovo" },
  { href: "/admin/hotel", label: "Hotel" },
  { href: "/admin/servizi-extra", label: "Servizi extra" },
  { href: "/admin/statistiche", label: "Statistiche" }
];

export function AdminShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ischia-mist">
      <AdminRouteRefresh />
      <header className="brand-shell relative z-30 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
          <div className="shrink-0">
            <IschiaStarsLogo light />
          </div>
          <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 text-sm lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                className="rounded-lg px-3 py-1.5 font-semibold text-white/90 transition hover:bg-white/15 hover:text-white"
                href={item.href}
                prefetch={false}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 text-sm sm:gap-2">
            <div className="hidden sm:block">
              <SystemModeBadge />
            </div>
            <QuoteNotificationsBell />
            <LogoutButton />
            <MobileNav />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-8">
        <div className="mb-4 sm:mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ischia-blue/70">Backoffice IschiaStars</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-ischia-navy sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ischia-ink/65">{subtitle}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
