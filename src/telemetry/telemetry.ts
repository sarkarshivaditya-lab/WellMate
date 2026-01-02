// src/telemetry/telemetry.ts

/* ======================================================
   TELEMETRY — READ-ONLY OBSERVABILITY
   ====================================================== */

/**
 * Purpose:
 * - Capture high-level lifecycle events
 * - Zero behavior change
 * - Console-only by default
 *
 * This layer is intentionally thin and replaceable.
 */

/* =========================
   TYPES
   ========================= */

export type TelemetryEvent =
  | "sync_start"
  | "sync_end"
  | "sync_error"
  | "sync_retry"
  | "deadletter_added"
  | "deadletter_restored"
  | "manual_retry_requested";

export type TelemetryPayload = {
  count?: number;
  entity?: "meal" | "exercise";
  taskId?: string;
  note?: string;
};

/* =========================
   SINK
   ========================= */

/**
 * Default sink: console.debug
 * Can be swapped later (Sentry, PostHog, custom)
 */
function emit(event: TelemetryEvent, payload?: TelemetryPayload) {
  try {
    // Keep noise low; debug only
    console.debug("[telemetry]", event, payload ?? {});
  } catch {
    // telemetry must never throw
  }
}

/* =========================
   PUBLIC API
   ========================= */

export function track(
  event: TelemetryEvent,
  payload?: TelemetryPayload,
) {
  emit(event, payload);
}
