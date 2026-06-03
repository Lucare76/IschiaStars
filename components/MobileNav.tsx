"use client";

import { useState } from "react";
import Link from "next/link";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/preventivi-da-evadere", label: "Da evadere" },
  { href: "/admin/follow-up", label: "Da richiamare" },
  { href: "/admin/preventivi", label: "Preventivi evasi" },
  { href: "/admin/conferme", label: "Confermati" },
  { href: "/admin/preventivi/nuovo", label: "+ Nuovo preventivo" },
  { href: "/admin/hotel", label: "Hotel" },
  { href: "/admin/statistiche", label: "Statistiche" }
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/15 lg:hidden"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? (
          <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-ischia-navy px-3 py-3 shadow-lg lg:hidden">
          <nav className="grid gap-1 sm:grid-cols-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                className="rounded-lg px-4 py-3 text-base font-semibold text-white/90 hover:bg-white/15 hover:text-white sm:text-sm"
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
