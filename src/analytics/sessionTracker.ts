// src/analytics/sessionTracker.ts

import { subscribeTo } from "@/reliability/lifecycleCoordinator";
import { emitAnalyticsEvent } from "./eventBus";

// If away longer than this, new session on return
const SESSION_BREAK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

let sessionId: string | null = null;
let sessionStartAt: number | null = null;
let sessionDepth = 0;
let backgroundedAt: number | null = null;

function startSession(): void {
  sessionId = crypto.randomUUID();
  sessionStartAt = Date.now();
  sessionDepth = 0;
  emitAnalyticsEvent({ type: "session_started", sessionId, ts: Date.now() });
}

function endSession(): void {
  if (!sessionId || !sessionStartAt) return;
  emitAnalyticsEvent({
    type: "session_ended",
    sessionId,
    depthActions: sessionDepth,
    durationMs: Date.now() - sessionStartAt,
    ts: Date.now(),
  });
  sessionId = null;
  sessionStartAt = null;
  sessionDepth = 0;
}

export function incrementSessionDepth(): void {
  sessionDepth++;
}

export function getCurrentSessionId(): string | null {
  return sessionId;
}

export function getCurrentSessionDepth(): number {
  return sessionDepth;
}

export function getCurrentSessionDurationMs(): number {
  return sessionStartAt ? Date.now() - sessionStartAt : 0;
}

export function initSessionTracker(): () => void {
  startSession();

  const unsub = subscribeTo((event) => {
    switch (event.type) {
      case "background": {
        backgroundedAt = Date.now();
        if (sessionId) {
          emitAnalyticsEvent({ type: "session_backgrounded", sessionId, ts: Date.now() });
        }
        break;
      }
      case "foreground": {
        const awayMs = backgroundedAt ? Date.now() - backgroundedAt : 0;
        backgroundedAt = null;

        if (awayMs > SESSION_BREAK_THRESHOLD_MS) {
          endSession();
          startSession();
        } else if (sessionId) {
          emitAnalyticsEvent({ type: "session_resumed", sessionId, awayMs, ts: Date.now() });
        }
        break;
      }
      case "before_unload": {
        endSession();
        break;
      }
      case "connectivity_change": {
        if (event.state === "online") {
          emitAnalyticsEvent({ type: "connectivity_restored", ts: Date.now() });
        } else {
          emitAnalyticsEvent({ type: "connectivity_lost", ts: Date.now() });
        }
        break;
      }
    }
  });

  return () => {
    unsub();
    endSession();
  };
}
