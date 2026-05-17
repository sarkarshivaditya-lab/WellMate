// src/notifications/queue.ts

/* ======================================================
   NOTIFICATION QUEUE — LOCAL-FIRST PERSISTENCE

   Pending notification intents survive app kills, tab closes,
   and OS suspension. History is used for diagnostic review.
====================================================== */

import type { NotificationIntent, DeliveredRecord } from "./types";

const QUEUE_KEY = "wellmate_notif_queue";
const HISTORY_KEY = "wellmate_notif_history";
const HISTORY_MAX = 50;

function loadQueue(): NotificationIntent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as NotificationIntent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: NotificationIntent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // non-fatal
  }
}

function loadHistory(): DeliveredRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as DeliveredRecord[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: DeliveredRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // non-fatal
  }
}

export function enqueueNotification(intent: NotificationIntent): void {
  const queue = loadQueue();
  // Deduplicate by id — prevents repeated signal evaluation from stacking
  if (queue.some((n) => n.id === intent.id)) return;
  queue.push(intent);
  saveQueue(queue);
}

export function dequeueNotification(id: string): void {
  saveQueue(loadQueue().filter((n) => n.id !== id));
}

export function getQueue(): NotificationIntent[] {
  return loadQueue();
}

export function clearQueue(): void {
  saveQueue([]);
}

/** Remove intents that are past their expiry timestamp */
export function purgeExpired(): void {
  const now = Date.now();
  saveQueue(loadQueue().filter((n) => n.expiresAt > now));
}

export function recordDelivery(record: DeliveredRecord): void {
  const history = loadHistory();
  history.unshift(record);
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  saveHistory(history);
}

export function getRecentHistory(windowMs: number): DeliveredRecord[] {
  const cutoff = Date.now() - windowMs;
  return loadHistory().filter((r) => r.deliveredAt >= cutoff);
}

export function getAllHistory(): DeliveredRecord[] {
  return loadHistory();
}

export function clearHistory(): void {
  saveHistory([]);
}
