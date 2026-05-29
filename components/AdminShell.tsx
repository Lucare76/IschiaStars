import Link from "next/link";
import type { ReactNode } from "react";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { LogoutButton } from "@/components/LogoutButton";
import { SystemModeBadge } from "@/components/SystemModeBadge";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/preventivi-da-evadere", label: "Preventivi da evadere" },
  { href: "/admin/preventivi", label: "Preventivi" },
  { href: "/admin/preventivi/nuovo", label: "Nuovo preventivo" },
  { href: "/admin/hotel", label: "Hotel / strutture" },
  { href: "/admin/statistiche", label: "Statistiche" }
];

export function AdminShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="brand-shell text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:flex-row lg:items-center lg:justify-between">
          <IschiaStarsLogo light />
          <div className="flex flex-wrap gap-2 text-sm">
            {nav.map((item) => (
              <Link key={item.href} className="rounded-full bg-white/12 px-4 py-2 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white hover:text-ischia-navy" href={item.href}>
                {item.label}
              </Link>
            ))}
            <span className="rounded-full bg-ischia-leaf px-4 py-2 font-bold text-white">WhatsApp 371 75 90 017</span>
            <SystemModeBadge />
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-ischia-blue">Backoffice IschiaStars</p>
          <h1 className="mt-1 text-3xl font-black text-ischia-navy sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-ischia-ink/75">{subtitle}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
