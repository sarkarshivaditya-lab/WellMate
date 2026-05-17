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
  // Sync lifecycle
  | "sync_start"
  | "sync_end"
  | "sync_error"
  | "sync_retry"
  | "sync_aborted_unauth"
  | "sync_periodic_trigger"
  | "sync_online_resume"
  | "sync_duplicate_prevented"
  // Dead-letter
  | "deadletter_added"
  | "deadletter_restored"
  // User actions
  | "manual_retry_requested"
  // Connectivity
  | "connectivity_online"
  | "connectivity_offline"
  // Auth events
  | "auth_abort"
  // Persistence integrity
  | "persistence_corruption_detected"
  | "persistence_quarantine_added"
  | "persistence_migration_applied"
  // Exercise lifecycle
  | "exercise_delete_synced"
  | "exercise_delete_orphaned";

export type TelemetryPayload = {
  count?: number;
  entity?: "meal" | "exercise" | "sleep" | "mood" | "journal" | "cycle";
  taskId?: string;
  note?: string;
  storageKey?: string;
  reason?: string;
};

/* =========================
   SINK
   ========================= */

function emit(event: TelemetryEvent, payload?: TelemetryPayload) {
  try {
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
