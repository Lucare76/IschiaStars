"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiFetch } from "@/lib/admin-api-client";
import { AnnouncementSettings, defaultAnnouncementSettings } from "@/lib/announcement-settings";
import { playStationAnnouncement } from "@/lib/client/announcement-player";

type NotificationType = "apertura" | "cliente_caldo" | "conferma" | "click" | "interesse";

type NotificationItem = {
  id: string;
  quoteCode: string;
  customerName: string;
  type: NotificationType;
  createdAt: string;
  description: string;
  isRead: boolean;
};

export function QuoteNotificationsBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // IDs seen at first load — never trigger announcement for these
  const knownIdsRef = useRef<Set<string>>(new Set());
  // True after the first successful fetch; prevents first-load announcements
  const firstLoadDoneRef = useRef(false);
  // Latest announcement settings (fetched once, re-read on next poll cycle)
  const announcementRef = useRef<AnnouncementSettings>(defaultAnnouncementSettings);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  // Load announcement settings once (readable by any authenticated admin)
  useEffect(() => {
    adminApiFetch("/api/admin/announcement-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { ok?: boolean; data?: AnnouncementSettings } | null) => {
        if (payload?.data) announcementRef.current = payload.data;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    async function poll() {
      const items = await fetchNotifications();
      if (!items) return;

      if (!firstLoadDoneRef.current) {
        // First load: record all existing IDs so we never announce them
        for (const item of items) knownIdsRef.current.add(item.id);
        firstLoadDoneRef.current = true;
        setNotifications(items);
        return;
      }

      // Subsequent polls: detect IDs not previously seen
      const newIds = items.filter((item) => !knownIdsRef.current.has(item.id));
      for (const item of items) knownIdsRef.current.add(item.id);
      setNotifications(items);

      if (newIds.length > 0 && announcementRef.current.notificationVoiceAnnouncement) {
        playStationAnnouncement(announcementRef.current).catch(() => null);
      }
    }

    void poll();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 30_000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void poll();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  async function togglePanel() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || unreadCount === 0) return;

    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    await adminApiFetch("/api/quote-notifications", { method: "PATCH" }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label="Notifiche preventivi"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/15"
        onClick={togglePanel}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-ischia-navy">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg bg-white text-ischia-ink shadow-xl ring-1 ring-black/10">
          <div className="border-b border-ischia-blue/10 px-4 py-3">
            <p className="font-black text-ischia-navy">Attività clienti</p>
            <p className="text-xs text-ischia-ink/55">Ultimi eventi sui preventivi</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.length ? notifications.map((notification) => (
              <Link
                className={`flex gap-3 border-b border-ischia-blue/5 px-4 py-3 transition hover:bg-ischia-mist ${notification.isRead ? "bg-white" : "bg-amber-50/60"}`}
                href={`/admin/preventivi/${notification.quoteCode}`}
                key={notification.id}
                onClick={() => setOpen(false)}
                prefetch={false}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notificationColor(notification.type)}`} />
                <span className="min-w-0">
                  <span className="block text-sm leading-5">
                    <strong className="text-ischia-navy">{notification.customerName}</strong> — {notification.description}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-ischia-ink/45">{relativeTime(notification.createdAt)}</span>
                </span>
              </Link>
            )) : (
              <p className="px-4 py-8 text-center text-sm font-semibold text-ischia-ink/50">Nessuna attività recente.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function fetchNotifications(): Promise<NotificationItem[] | null> {
  const response = await adminApiFetch("/api/quote-notifications").catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null) as { data?: NotificationItem[] } | null;
  if (Array.isArray(payload?.data)) return payload.data;
  return null;
}

function notificationColor(type: NotificationType) {
  if (type === "apertura") return "bg-[#2563EB]";
  if (type === "cliente_caldo") return "bg-[#D97706]";
  if (type === "conferma") return "bg-[#16A34A]";
  if (type === "interesse") return "bg-[#7C3AED]";
  return "bg-[#0891B2]";
}

function relativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "adesso";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(timestamp));
}
