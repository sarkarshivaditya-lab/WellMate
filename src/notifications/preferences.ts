// src/notifications/preferences.ts

/* ======================================================
   NOTIFICATION PREFERENCES — LOCAL-FIRST STORE

   User controls over notification behavior. Persisted in
   localStorage, never sent to server.
====================================================== */

import type { NotificationCategory, NotificationPreferences, QuietWindow } from "./types";

const PREFS_KEY = "wellmate_notif_prefs";

export const ALL_CATEGORIES: NotificationCategory[] = [
  "wellness_critical",
  "streak_support",
  "habit_support",
  "sleep_support",
  "gentle_checkin",
  "hydration_support",
  "recovery_prompt",
  "journal_reflection",
  "passive_insight",
  "onboarding_nudge",
];

// Default quiet window: 10 PM – 8 AM (respects sleep)
const DEFAULT_SLEEP_WINDOW: QuietWindow = {
  startHour: 22,
  startMinute: 0,
  endHour: 8,
  endMinute: 0,
  label: "sleep",
};

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  enabledCategories: [...ALL_CATEGORIES],
  quietWindows: [DEFAULT_SLEEP_WINDOW],
  sensitivityLevel: "normal",
  dailyCap: 5,
  updatedAt: 0,
};

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const stored = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_PREFS,
      ...stored,
      enabledCategories: stored.enabledCategories ?? DEFAULT_PREFS.enabledCategories,
      quietWindows: stored.quietWindows ?? DEFAULT_PREFS.quietWindows,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, updatedAt: Date.now() }));
  } catch {
    // non-fatal — notifications are enhancement, not core
  }
}

export function patchNotificationPreferences(patch: Partial<NotificationPreferences>): void {
  const current = getNotificationPreferences();
  saveNotificationPreferences({ ...current, ...patch });
}

export function setCategoryEnabled(category: NotificationCategory, enabled: boolean): void {
  const prefs = getNotificationPreferences();
  const set = new Set(prefs.enabledCategories);
  if (enabled) set.add(category);
  else set.delete(category);
  saveNotificationPreferences({ ...prefs, enabledCategories: [...set] });
}

export function isCategoryEnabled(category: NotificationCategory): boolean {
  const prefs = getNotificationPreferences();
  return prefs.enabled && prefs.enabledCategories.includes(category);
}
