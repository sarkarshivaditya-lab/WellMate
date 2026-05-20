// Runtime telemetry — privacy-safe local-first crash and failure analytics.
//
// All telemetry is stored locally in localStorage. Cloud upload is NOT implemented —
// the telemetry contracts and schemas are real and cloud-ready, but no data
// leaves the device until an explicit upload call is added.
//
// Event types:
//   crash_report       — unhandled exception in AI runtime
//   worker_crash       — worker thread died unexpectedly
//   inference_failure  — model generation failed (non-abort)
//   lifecycle_failure  — app lifecycle event caused AI disruption
//   thermal_incident   — thermal state crossed a threshold
//   storage_corruption — OPFS or localStorage data integrity failure
//   startup_failure    — boot stage failed to complete
//   compatibility_fail — required platform capability missing
//
// Privacy: no user content is included; only runtime metadata.

const TELEMETRY_KEY = "ai_runtime_telemetry_v1";
const MAX_EVENTS = 200;
const SESSION_KEY = "ai_telemetry_session_v1";

export type TelemetryEventType =
  | "crash_report"
  | "worker_crash"
  | "inference_failure"
  | "lifecycle_failure"
  | "thermal_incident"
  | "storage_corruption"
  | "startup_failure"
  | "compatibility_fail";

export type TelemetryEvent = {
  eventId: string;
  type: TelemetryEventType;
  occurredAt: number;
  sessionId: string;
  // Structured metadata — no user content
  metadata: Record<string, string | number | boolean | null>;
};

export type TelemetrySummary = {
  sessionId: string;
  totalEvents: number;
  byType: Record<TelemetryEventType, number>;
  oldestEventAt: number | null;
  newestEventAt: number | null;
  storageBytes: number;
};

// ── Session ID ─────────────────────────────────────────────────────────────────

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}

// ── Storage helpers ────────────────────────────────────────────────────────────

function loadEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch { return []; }
}

function saveEvents(events: TelemetryEvent[]): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch { /* storage full */ }
}

let _idCounter = 0;
function nextId(): string { return `evt-${Date.now()}-${_idCounter++}`; }

// ── Pub/sub for real-time panel ────────────────────────────────────────────────

type TelemetryListener = (event: TelemetryEvent) => void;
const _listeners = new Set<TelemetryListener>();

export function subscribeToTelemetry(fn: TelemetryListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Core record function ───────────────────────────────────────────────────────

export function recordTelemetryEvent(
  type: TelemetryEventType,
  metadata: Record<string, string | number | boolean | null> = {},
): TelemetryEvent {
  const event: TelemetryEvent = {
    eventId: nextId(),
    type,
    occurredAt: Date.now(),
    sessionId: getSessionId(),
    metadata,
  };

  const events = loadEvents();
  events.push(event);
  saveEvents(events);
  _listeners.forEach((fn) => { try { fn(event); } catch { /* */ } });

  return event;
}

// ── Typed convenience recorders ────────────────────────────────────────────────

export function recordCrashReport(error: unknown, context: string): void {
  const msg = error instanceof Error ? error.message : String(error);
  recordTelemetryEvent("crash_report", { error: msg.slice(0, 200), context });
}

export function recordWorkerCrash(workerId: string, role: string, reason: string): void {
  recordTelemetryEvent("worker_crash", { workerId, role, reason: reason.slice(0, 200) });
}

export function recordInferenceFailure(provider: string, errorType: string, durationMs: number): void {
  recordTelemetryEvent("inference_failure", { provider, errorType, durationMs });
}

export function recordLifecycleFailure(event: string, subsystem: string, reason: string): void {
  recordTelemetryEvent("lifecycle_failure", { event, subsystem, reason: reason.slice(0, 200) });
}

export function recordThermalTelemetry(state: string, inferencesPerMin: number, action: string): void {
  recordTelemetryEvent("thermal_incident", { state, inferencesPerMin, action });
}

export function recordStorageCorruption(assetId: string, detail: string): void {
  recordTelemetryEvent("storage_corruption", { assetId, detail: detail.slice(0, 200) });
}

export function recordStartupFailure(stage: string, reason: string): void {
  recordTelemetryEvent("startup_failure", { stage, reason: reason.slice(0, 200) });
}

export function recordCompatibilityFailure(feature: string, detail: string): void {
  recordTelemetryEvent("compatibility_fail", { feature, detail: detail.slice(0, 200) });
}

// ── Query API ──────────────────────────────────────────────────────────────────

export function getRecentTelemetry(n = 50): TelemetryEvent[] {
  return loadEvents().slice(-n);
}

export function getTelemetrySummary(): TelemetrySummary {
  const events = loadEvents();
  const byType: Record<TelemetryEventType, number> = {
    crash_report: 0, worker_crash: 0, inference_failure: 0, lifecycle_failure: 0,
    thermal_incident: 0, storage_corruption: 0, startup_failure: 0, compatibility_fail: 0,
  };
  for (const e of events) byType[e.type]++;

  const raw = localStorage.getItem(TELEMETRY_KEY) ?? "";
  return {
    sessionId: getSessionId(),
    totalEvents: events.length,
    byType,
    oldestEventAt: events[0]?.occurredAt ?? null,
    newestEventAt: events[events.length - 1]?.occurredAt ?? null,
    storageBytes: new TextEncoder().encode(raw).length,
  };
}

export function clearTelemetry(): void {
  try { localStorage.removeItem(TELEMETRY_KEY); } catch { /* */ }
}

// Global error capture — catches unhandled promise rejections in the AI subsystem
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    if (reason instanceof Error && reason.stack?.includes("src/ai")) {
      recordCrashReport(reason, "unhandled_rejection");
    }
  });
}
