// Persistent performance history — stores longitudinal AI runtime data.
// Used for: predictive optimization, model upgrade decisions, stability scoring.
//
// Storage layout (all localStorage):
//   ai_perf_thermal_v1  → ThermalIncident[]    (max 50)
//   ai_perf_failures_v1 → FailureEvent[]        (max 100)
//   ai_perf_daily_v1    → DailyRecord{}         (max 90 days)
//   ai_perf_recovery_v1 → RecoveryEvent[]       (max 50)
//
// Total storage budget: ~120 KB (well within localStorage quota).

const KEY_THERMAL   = "ai_perf_thermal_v1";
const KEY_FAILURES  = "ai_perf_failures_v1";
const KEY_DAILY     = "ai_perf_daily_v1";
const KEY_RECOVERY  = "ai_perf_recovery_v1";

const MAX_THERMAL   = 50;
const MAX_FAILURES  = 100;
const MAX_DAILY     = 90;
const MAX_RECOVERY  = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThermalIncident = {
  occurredAt: number;
  thermalState: string;
  inferencesPerMin: number;
  action: "throttled" | "emergency_unload" | "suspended";
};

export type FailureEvent = {
  occurredAt: number;
  reason: string;
  provider: string;
  wasRetried: boolean;
  recoveredSuccessfully: boolean;
};

export type RecoveryEvent = {
  occurredAt: number;
  type: "stuck_stream" | "hung_inference" | "migration_rollback" | "manual_reset";
  details?: string;
};

export type DailyRecord = {
  date: string;           // YYYY-MM-DD
  inferenceCount: number;
  avgTokPerSec: number;
  p90LatencyMs: number;
  thermalIncidents: number;
  failedInferences: number;
  modelStabilityScore: number; // 0–100: 100 = no failures, 0 = all failed
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — skip */ }
}

function trimArray<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Thermal incidents ─────────────────────────────────────────────────────────

export function recordThermalIncident(incident: ThermalIncident): void {
  const list = safeRead<ThermalIncident[]>(KEY_THERMAL, []);
  list.push(incident);
  safeWrite(KEY_THERMAL, trimArray(list, MAX_THERMAL));
  patchDailyRecord((d) => { d.thermalIncidents++; });
}

export function getThermalIncidents(n = 20): ThermalIncident[] {
  return safeRead<ThermalIncident[]>(KEY_THERMAL, []).slice(-n);
}

// ── Failure events ─────────────────────────────────────────────────────────────

export function recordFailureEvent(event: FailureEvent): void {
  const list = safeRead<FailureEvent[]>(KEY_FAILURES, []);
  list.push(event);
  safeWrite(KEY_FAILURES, trimArray(list, MAX_FAILURES));
  patchDailyRecord((d) => {
    d.failedInferences++;
    d.modelStabilityScore = computeStabilityScore(d);
  });
}

export function getFailureEvents(n = 20): FailureEvent[] {
  return safeRead<FailureEvent[]>(KEY_FAILURES, []).slice(-n);
}

// ── Recovery events ────────────────────────────────────────────────────────────

export function recordRecoveryEvent(event: RecoveryEvent): void {
  const list = safeRead<RecoveryEvent[]>(KEY_RECOVERY, []);
  list.push(event);
  safeWrite(KEY_RECOVERY, trimArray(list, MAX_RECOVERY));
}

export function getRecoveryEvents(n = 20): RecoveryEvent[] {
  return safeRead<RecoveryEvent[]>(KEY_RECOVERY, []).slice(-n);
}

// ── Daily records ──────────────────────────────────────────────────────────────

export function getDailyRecords(): Record<string, DailyRecord> {
  return safeRead<Record<string, DailyRecord>>(KEY_DAILY, {});
}

export function getTodayRecord(): DailyRecord {
  const today = todayIso();
  const records = getDailyRecords();
  return records[today] ?? emptyDailyRecord(today);
}

export function patchDailyRecord(fn: (d: DailyRecord) => void): void {
  const today = todayIso();
  const records = getDailyRecords();
  const record = records[today] ?? emptyDailyRecord(today);
  fn(record);
  record.modelStabilityScore = computeStabilityScore(record);
  records[today] = record;

  // Trim to max days
  const keys = Object.keys(records).sort();
  if (keys.length > MAX_DAILY) {
    keys.slice(0, keys.length - MAX_DAILY).forEach((k) => delete records[k]);
  }

  safeWrite(KEY_DAILY, records);
}

export function updateDailyPerformance(
  inferenceCount: number,
  avgTokPerSec: number,
  p90LatencyMs: number,
): void {
  patchDailyRecord((d) => {
    // Weighted rolling update
    const total = d.inferenceCount + inferenceCount;
    d.avgTokPerSec = total > 0
      ? (d.avgTokPerSec * d.inferenceCount + avgTokPerSec * inferenceCount) / total
      : avgTokPerSec;
    d.p90LatencyMs = Math.max(d.p90LatencyMs, p90LatencyMs);
    d.inferenceCount = total;
  });
}

function emptyDailyRecord(date: string): DailyRecord {
  return {
    date,
    inferenceCount: 0,
    avgTokPerSec: 0,
    p90LatencyMs: 0,
    thermalIncidents: 0,
    failedInferences: 0,
    modelStabilityScore: 100,
  };
}

function computeStabilityScore(d: DailyRecord): number {
  if (d.inferenceCount === 0) return 100;
  const failRate = d.failedInferences / Math.max(d.inferenceCount, 1);
  const thermalPenalty = Math.min(d.thermalIncidents * 5, 30);
  const score = Math.max(0, 100 - failRate * 100 - thermalPenalty);
  return Math.round(score);
}

// ── Storage accounting ─────────────────────────────────────────────────────────

export function getHistoryStorageBytes(): number {
  let total = 0;
  for (const key of [KEY_THERMAL, KEY_FAILURES, KEY_DAILY, KEY_RECOVERY]) {
    const val = localStorage.getItem(key);
    if (val) total += val.length * 2; // UTF-16
  }
  return total;
}

export function clearAllHistory(): void {
  [KEY_THERMAL, KEY_FAILURES, KEY_DAILY, KEY_RECOVERY].forEach((k) =>
    localStorage.removeItem(k),
  );
}
