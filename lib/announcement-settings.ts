export const ANNOUNCEMENT_SETTINGS_KEY = "announcement_settings";

export type AnnouncementSettings = {
  notificationVoiceAnnouncement: boolean;
  notificationAnnouncementMessage: string;
  notificationAnnouncementJingle: boolean;
  notificationAnnouncementVolume: number;
  notificationAnnouncementRate: number;
  notificationAnnouncementPitch: number;
  notificationConfermaAudioUrl: string;
};

export const defaultAnnouncementSettings: AnnouncementSettings = {
  notificationVoiceAnnouncement: false,
  notificationAnnouncementMessage: "Attenzione. È in arrivo una nuova notifica sul binario del Testaccio.",
  notificationAnnouncementJingle: true,
  notificationAnnouncementVolume: 0.9,
  notificationAnnouncementRate: 0.88,
  notificationAnnouncementPitch: 0.88,
  notificationConfermaAudioUrl: "",
};

export function normalizeAnnouncementSettings(value: unknown): AnnouncementSettings {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  const r = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  return {
    notificationVoiceAnnouncement: typeof r.notificationVoiceAnnouncement === "boolean"
      ? r.notificationVoiceAnnouncement
      : defaultAnnouncementSettings.notificationVoiceAnnouncement,
    notificationAnnouncementMessage: typeof r.notificationAnnouncementMessage === "string" && r.notificationAnnouncementMessage.trim()
      ? r.notificationAnnouncementMessage
      : defaultAnnouncementSettings.notificationAnnouncementMessage,
    notificationAnnouncementJingle: typeof r.notificationAnnouncementJingle === "boolean"
      ? r.notificationAnnouncementJingle
      : defaultAnnouncementSettings.notificationAnnouncementJingle,
    notificationAnnouncementVolume: typeof r.notificationAnnouncementVolume === "number"
      ? clamp(r.notificationAnnouncementVolume, 0.1, 1)
      : defaultAnnouncementSettings.notificationAnnouncementVolume,
    notificationAnnouncementRate: typeof r.notificationAnnouncementRate === "number"
      ? clamp(r.notificationAnnouncementRate, 0.6, 1.3)
      : defaultAnnouncementSettings.notificationAnnouncementRate,
    notificationAnnouncementPitch: typeof r.notificationAnnouncementPitch === "number"
      ? clamp(r.notificationAnnouncementPitch, 0.6, 1.4)
      : defaultAnnouncementSettings.notificationAnnouncementPitch,
    notificationConfermaAudioUrl: typeof r.notificationConfermaAudioUrl === "string"
      ? r.notificationConfermaAudioUrl
      : defaultAnnouncementSettings.notificationConfermaAudioUrl,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
