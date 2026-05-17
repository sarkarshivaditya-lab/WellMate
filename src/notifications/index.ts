// src/notifications/index.ts

/* ======================================================
   CALM NOTIFICATION ARCHITECTURE — PUBLIC API

   Initialized once in App.tsx alongside analytics.
   All state is local-first. No network required.
====================================================== */

import { initEngine, disposeEngine, forceEvaluate } from "./engine";

// Public re-exports
export { getNotificationPreferences, patchNotificationPreferences, setCategoryEnabled } from "./preferences";
export { enqueueNotification, getQueue, getRecentHistory, clearHistory } from "./queue";
export { getFatigueState, resetFatigue } from "./fatigue";
export { isInQuietHours } from "./quietHours";
export { getNotificationSnapshot } from "./diagnostics";
export { forceEvaluate } from "./engine";
export type { NotificationIntent, NotificationCategory, NotificationPreferences, NotificationSnapshot } from "./types";

/* --------------------------------------------------
   LIFECYCLE
   -------------------------------------------------- */

let initialized = false;

export function initNotifications(): void {
  if (initialized) return;
  initialized = true;
  initEngine();
}

export function disposeNotifications(): void {
  disposeEngine();
  initialized = false;
}
