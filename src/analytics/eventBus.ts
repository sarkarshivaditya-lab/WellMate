// src/analytics/eventBus.ts

import type { AnalyticsEvent } from "./types";

type Listener = (event: AnalyticsEvent) => void;

const listeners = new Set<Listener>();

export function emitAnalyticsEvent(event: AnalyticsEvent): void {
  listeners.forEach((l) => { try { l(event); } catch { /* never crash */ } });
}

export function subscribeToAnalytics(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
