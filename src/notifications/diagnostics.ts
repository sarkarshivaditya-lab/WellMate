// src/notifications/diagnostics.ts

/* ======================================================
   NOTIFICATION DIAGNOSTICS
   Dev-only snapshot for the Dev panel.
====================================================== */

import { getNotificationPreferences } from "./preferences";
import { getQueue, getAllHistory } from "./queue";
import { getFatigueState } from "./fatigue";
import { isInQuietHours } from "./quietHours";
import type { NotificationSnapshot } from "./types";

export function getNotificationSnapshot(): NotificationSnapshot {
  const prefs = getNotificationPreferences();
  return {
    enabled: prefs.enabled,
    queueLength: getQueue().length,
    recentHistory: getAllHistory().slice(0, 20),
    fatigueState: getFatigueState(),
    preferences: prefs,
    isInQuietHours: isInQuietHours(prefs),
  };
}
