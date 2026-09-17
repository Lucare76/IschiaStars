export const FOLLOW_UP_RULE_SETTINGS_KEY = "follow_up_rule_settings";

export type FollowUpRuleSettings = {
  enabled: boolean;
  unopenedAfterHours: number;
  openedReminderAfterHours: number;
  firstReminderAfterHours: number;
  secondReminderAfterHours: number;
  finalReminderAfterHours: number;
  updatedAt?: string;
};

export const defaultFollowUpRuleSettings: FollowUpRuleSettings = {
  enabled: true,
  unopenedAfterHours: 24,
  openedReminderAfterHours: 24,
  firstReminderAfterHours: 24,
  secondReminderAfterHours: 72,
  finalReminderAfterHours: 168
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function normalizeFollowUpRuleSettings(value: unknown): FollowUpRuleSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const first = boundedNumber(raw.firstReminderAfterHours, defaultFollowUpRuleSettings.firstReminderAfterHours, 6, 168);
  const second = boundedNumber(raw.secondReminderAfterHours, defaultFollowUpRuleSettings.secondReminderAfterHours, first + 6, 336);
  const final = boundedNumber(raw.finalReminderAfterHours, defaultFollowUpRuleSettings.finalReminderAfterHours, second + 6, 720);

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    unopenedAfterHours: boundedNumber(raw.unopenedAfterHours, defaultFollowUpRuleSettings.unopenedAfterHours, 6, 168),
    openedReminderAfterHours: boundedNumber(raw.openedReminderAfterHours, defaultFollowUpRuleSettings.openedReminderAfterHours, 6, 168),
    firstReminderAfterHours: first,
    secondReminderAfterHours: second,
    finalReminderAfterHours: final,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined
  };
}
