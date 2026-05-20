// Cold-start optimizer — per-stage boot timing, persisted across sessions.
//
// Records when each boot stage starts and completes, with optional
// notes (e.g., warm-start detection, model activation status).
// Persists last 10 profiles so trends can be detected across sessions.
//
// Usage: call recordStageStart/recordStageComplete around each init step.
// markWarmStart() suppresses the "cold" label on fast restores.

const PROFILES_KEY = "ai_boot_profiles_v1";
const MAX_PROFILES = 10;

export type BootStage =
  | "core"
  | "governor"
  | "retrieval"
  | "session"
  | "warmup"
  | "ready";

export const BOOT_STAGES: BootStage[] = [
  "core",
  "governor",
  "retrieval",
  "session",
  "warmup",
  "ready",
];

export type StageRecord = {
  stage: BootStage;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  notes?: string;
};

export type BootProfile = {
  profileId: string;
  sessionStartedAt: number;
  isWarmStart: boolean;
  stages: Record<BootStage, StageRecord>;
  totalDurationMs: number | null;
  completedAt: number | null;
};

let _current: BootProfile | null = null;

function emptyStages(): Record<BootStage, StageRecord> {
  const stages = {} as Record<BootStage, StageRecord>;
  for (const s of BOOT_STAGES) {
    stages[s] = { stage: s, startedAt: 0, completedAt: null, durationMs: null };
  }
  return stages;
}

// ── Profile persistence ────────────────────────────────────────────────────────

function loadProfiles(): BootProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as BootProfile[]) : [];
  } catch { return []; }
}

function saveProfile(profile: BootProfile): void {
  try {
    const profiles = loadProfiles();
    profiles.push(profile);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(-MAX_PROFILES)));
  } catch { /* storage full */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function initStartupProfile(): void {
  _current = {
    profileId: `boot-${Date.now()}`,
    sessionStartedAt: Date.now(),
    isWarmStart: false,
    stages: emptyStages(),
    totalDurationMs: null,
    completedAt: null,
  };
}

export function markWarmStart(): void {
  if (_current) _current.isWarmStart = true;
}

export function recordStageStart(stage: BootStage): void {
  if (!_current) initStartupProfile();
  _current!.stages[stage].startedAt = Date.now();
}

export function recordStageComplete(stage: BootStage, opts?: { notes?: string }): void {
  if (!_current) return;
  const rec = _current.stages[stage];
  if (!rec.startedAt) rec.startedAt = Date.now();
  rec.completedAt = Date.now();
  rec.durationMs = rec.completedAt - rec.startedAt;
  if (opts?.notes) rec.notes = opts.notes;

  if (stage === "ready") {
    _current.completedAt = Date.now();
    _current.totalDurationMs = _current.completedAt - _current.sessionStartedAt;
    saveProfile({ ..._current });
  }
}

export function getCurrentProfile(): BootProfile | null {
  return _current ? { ..._current } : null;
}

export function getStartupProfiles(): BootProfile[] {
  return loadProfiles();
}

export function getAverageBootDurationMs(): number | null {
  const profiles = loadProfiles().filter((p) => p.totalDurationMs !== null);
  if (!profiles.length) return null;
  const sum = profiles.reduce((acc, p) => acc + (p.totalDurationMs ?? 0), 0);
  return Math.round(sum / profiles.length);
}

export function getSlowestStage(): { stage: BootStage; avgMs: number } | null {
  const profiles = loadProfiles().filter((p) => p.completedAt !== null);
  if (!profiles.length) return null;

  const totals: Record<BootStage, { sum: number; count: number }> = {} as never;
  for (const s of BOOT_STAGES) totals[s] = { sum: 0, count: 0 };

  for (const p of profiles) {
    for (const s of BOOT_STAGES) {
      const dur = p.stages[s]?.durationMs;
      if (dur !== null && dur !== undefined) {
        totals[s].sum += dur;
        totals[s].count++;
      }
    }
  }

  let slowest: BootStage = "core";
  let maxAvg = 0;
  for (const s of BOOT_STAGES) {
    const { sum, count } = totals[s];
    if (count > 0) {
      const avg = sum / count;
      if (avg > maxAvg) { maxAvg = avg; slowest = s; }
    }
  }

  return { stage: slowest, avgMs: Math.round(maxAvg) };
}
