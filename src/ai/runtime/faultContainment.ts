// Fault containment — circuit breakers for each runtime subsystem.
// Prevents a single subsystem failure from cascading through the AI stack.
//
// Circuit states:
//   closed    — normal; requests pass through
//   open      — fault detected; requests blocked until probe interval elapses
//   half_open — tentative recovery; one probe allowed; reverts to open on failure
//
// After FAILURE_THRESHOLD consecutive failures → circuit opens.
// After RECOVERY_PROBE_INTERVAL_MS with no new failures → half_open probe.
// After RECOVERY_SUCCESSES_REQUIRED consecutive successes → circuit closes.
// After QUARANTINE_THRESHOLD total failures → quarantined (requires manual reset).

export type SubsystemId =
  | "inference"
  | "retrieval"
  | "embedding"
  | "summarization"
  | "memory"
  | "model_load";

export type CircuitState = "closed" | "open" | "half_open";

export type FaultRecord = {
  subsystem: SubsystemId;
  occurredAt: number;
  error: string;
  recovered: boolean;
};

export type SubsystemHealth = {
  subsystem: SubsystemId;
  circuitState: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  lastRecoveryAt: number | null;
  consecutiveSuccesses: number;
  quarantined: boolean;
};

const FAILURE_THRESHOLD = 3;
const QUARANTINE_THRESHOLD = 8;
const RECOVERY_PROBE_INTERVAL_MS = 30_000;
const RECOVERY_SUCCESSES_REQUIRED = 2;
const MAX_FAULT_LOG = 100;

const ALL_SUBSYSTEMS: SubsystemId[] = [
  "inference", "retrieval", "embedding", "summarization", "memory", "model_load",
];

const _circuits = new Map<SubsystemId, SubsystemHealth>();
const _faultLog: FaultRecord[] = [];

type FaultListener = (subsystem: SubsystemId, state: CircuitState) => void;
const _listeners = new Set<FaultListener>();

// ── Helpers ────────────────────────────────────────────────────────────────────

function emit(subsystem: SubsystemId, state: CircuitState): void {
  _listeners.forEach((fn) => { try { fn(subsystem, state); } catch { /* */ } });
}

function getOrCreate(id: SubsystemId): SubsystemHealth {
  if (!_circuits.has(id)) {
    _circuits.set(id, {
      subsystem: id, circuitState: "closed", failureCount: 0,
      lastFailureAt: null, lastRecoveryAt: null,
      consecutiveSuccesses: 0, quarantined: false,
    });
  }
  return _circuits.get(id)!;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function subscribeToFaults(fn: FaultListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function recordSubsystemFailure(subsystem: SubsystemId, error: unknown): void {
  const h = getOrCreate(subsystem);
  const msg = error instanceof Error ? error.message : String(error);

  h.failureCount++;
  h.lastFailureAt = Date.now();
  h.consecutiveSuccesses = 0;

  if (h.failureCount >= QUARANTINE_THRESHOLD) {
    h.quarantined = true;
    h.circuitState = "open";
  } else if (h.failureCount >= FAILURE_THRESHOLD) {
    h.circuitState = "open";
  }

  _faultLog.push({ subsystem, occurredAt: Date.now(), error: msg, recovered: false });
  if (_faultLog.length > MAX_FAULT_LOG) _faultLog.shift();

  emit(subsystem, h.circuitState);
}

export function recordSubsystemSuccess(subsystem: SubsystemId): void {
  const h = getOrCreate(subsystem);
  h.consecutiveSuccesses++;
  h.lastRecoveryAt = Date.now();

  if (h.circuitState === "half_open" && h.consecutiveSuccesses >= RECOVERY_SUCCESSES_REQUIRED) {
    h.circuitState = "closed";
    h.failureCount = Math.max(0, h.failureCount - 2);
    emit(subsystem, "closed");
  }
}

export function isSubsystemAvailable(subsystem: SubsystemId): boolean {
  const h = _circuits.get(subsystem);
  if (!h) return true;
  if (h.quarantined) return false;
  if (h.circuitState === "closed") return true;
  if (h.circuitState === "open") {
    const elapsed = h.lastFailureAt ? Date.now() - h.lastFailureAt : Infinity;
    if (elapsed >= RECOVERY_PROBE_INTERVAL_MS) {
      h.circuitState = "half_open";
      emit(subsystem, "half_open");
      return true;
    }
    return false;
  }
  return true; // half_open: allow probe
}

export function getSubsystemHealth(subsystem: SubsystemId): SubsystemHealth {
  return { ...getOrCreate(subsystem) };
}

export function getAllSubsystemHealth(): SubsystemHealth[] {
  return ALL_SUBSYSTEMS.map((id) => ({ ...getOrCreate(id) }));
}

export function getFaultLog(n = 20): FaultRecord[] {
  return _faultLog.slice(-n);
}

export function resetSubsystem(subsystem: SubsystemId): void {
  const h = getOrCreate(subsystem);
  h.circuitState = "closed";
  h.failureCount = 0;
  h.quarantined = false;
  h.consecutiveSuccesses = 0;
  emit(subsystem, "closed");
}

export function resetAllSubsystems(): void {
  for (const id of ALL_SUBSYSTEMS) resetSubsystem(id);
}

// Wrap any async operation with fault containment.
// Passes through on success; records failure on error; falls back if provided.
export async function withFaultContainment<T>(
  subsystem: SubsystemId,
  fn: () => Promise<T>,
  fallback?: () => T,
): Promise<T> {
  if (!isSubsystemAvailable(subsystem)) {
    if (fallback) return fallback();
    throw new Error(`Subsystem ${subsystem} circuit open — temporarily unavailable`);
  }

  try {
    const result = await fn();
    recordSubsystemSuccess(subsystem);
    return result;
  } catch (err) {
    recordSubsystemFailure(subsystem, err);
    if (fallback) return fallback();
    throw err;
  }
}
