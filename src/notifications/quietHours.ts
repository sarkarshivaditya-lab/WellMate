// src/notifications/quietHours.ts

/* ======================================================
   QUIET HOURS — SILENCE IS A FEATURE

   Notifications deferred during quiet windows are not lost.
   They remain in queue and are evaluated on the next
   foreground event after the window ends.

   Quiet windows that cross midnight (e.g. 22:00–08:00)
   are handled correctly.
====================================================== */

import type { NotificationPreferences, QuietWindow } from "./types";

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function isTimeInWindow(nowMinutes: number, window: QuietWindow): boolean {
  const start = minutesSinceMidnight(window.startHour, window.startMinute);
  const end = minutesSinceMidnight(window.endHour, window.endMinute);

  if (start <= end) {
    // Normal window: e.g. 09:00–17:00
    return nowMinutes >= start && nowMinutes < end;
  } else {
    // Crosses midnight: e.g. 22:00–08:00
    return nowMinutes >= start || nowMinutes < end;
  }
}

export function isInQuietHours(prefs: NotificationPreferences, now = Date.now()): boolean {
  if (!prefs.quietWindows.length) return false;
  const d = new Date(now);
  const nowMinutes = d.getHours() * 60 + d.getMinutes();
  return prefs.quietWindows.some((w) => isTimeInWindow(nowMinutes, w));
}

/**
 * Returns the timestamp when the active quiet window ends.
 * Returns null if not currently in any quiet window.
 */
export function getQuietWindowEndMs(
  prefs: NotificationPreferences,
  now = Date.now(),
): number | null {
  const d = new Date(now);
  const nowMinutes = d.getHours() * 60 + d.getMinutes();

  for (const w of prefs.quietWindows) {
    if (!isTimeInWindow(nowMinutes, w)) continue;

    const end = new Date(d);
    end.setHours(w.endHour, w.endMinute, 0, 0);
    // If end time appears to be in the past (midnight-crossing window), push to tomorrow
    if (end.getTime() <= now) {
      end.setDate(end.getDate() + 1);
    }
    return end.getTime();
  }

  return null;
}
