// Continuity Recovery — restore cognitive state after interruption.
//
// Handles: app restart, worker crash, background eviction, interrupted inference,
//          device sleep/resume, navigation loss, tab visibility change.
//
// Strategy:
//   1. Detect what was lost (checkpoint age, crash markers, inference state)
//   2. Restore from checkpoint if recent enough
//   3. Reconstruct attention state from memory hierarchy if checkpoint is stale
//   4. Validate restored state
//   5. Emit continuity event for downstream awareness
//
// Does NOT replay huge prompts. Rebuilds minimal working state from durable memory.

import {
  restoreCognitiveStateFromCheckpoint,
  getCognitiveStateCheckpointAge,
  addAttentionSlot,
  addActiveGoal,
  addUnresolvedTopic,
  updateEmotionalContinuity,
  checkpointCognitiveState,
  getCognitiveStateReport,
} from "./cognitiveStateEngine";
import { retrieveMemory } from "../memory/memoryHierarchy";
import { getActiveReflections } from "./reflectionEngine";
import { getUserModelReport } from "./userModel";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RecoveryReason =
  | "app_restart"
  | "worker_crash"
  | "background_eviction"
  | "interrupted_inference"
  | "device_sleep"
  | "navigation_loss"
  | "tab_hidden"
  | "manual";

export type RecoveryOutcome =
  | "full_checkpoint_restore"
  | "partial_memory_rebuild"
  | "cold_start"
  | "skipped_fresh";

export type ContinuityRecoveryResult = {
  reason: RecoveryReason;
  outcome: RecoveryOutcome;
  checkpointAgeMs: number | null;
  attentionSlotsRestored: number;
  goalsRestored: number;
  reflectionsAvailable: number;
  recoveredAt: number;
  durationMs: number;
};

export type ContinuityStatus = {
  isRecovered: boolean;
  lastRecoveryAt: number | null;
  lastRecoveryOutcome: RecoveryOutcome | null;
  lastReason: RecoveryReason | null;
  recoveryCount: number;
  crashMarkerPresent: boolean;
};

// ── State ──────────────────────────────────────────────────────────────────────

const CRASH_MARKER_KEY = "ai_clean_exit_marker";
const RECOVERY_LOG_KEY = "ai_recovery_log_v1";
const CHECKPOINT_FRESHNESS_MS = 5 * 60 * 1000;   // <5 min = fresh restore
const CHECKPOINT_USABLE_MS = 30 * 60 * 1000;      // <30 min = still usable

let _lastRecovery: ContinuityRecoveryResult | null = null;
let _recoveryCount = 0;

// ── Crash marker ───────────────────────────────────────────────────────────────

export function markCleanExit(): void {
  try { sessionStorage.setItem(CRASH_MARKER_KEY, "1"); } catch { /* */ }
}

export function clearCleanExitMarker(): void {
  try { sessionStorage.removeItem(CRASH_MARKER_KEY); } catch { /* */ }
}

export function hasCrashMarker(): boolean {
  // If no clean exit marker exists, previous session likely crashed
  try { return sessionStorage.getItem(CRASH_MARKER_KEY) === null; } catch { return false; }
}

// ── Recovery log ───────────────────────────────────────────────────────────────

function appendRecoveryLog(result: ContinuityRecoveryResult): void {
  try {
    const log = JSON.parse(localStorage.getItem(RECOVERY_LOG_KEY) ?? "[]") as ContinuityRecoveryResult[];
    log.push(result);
    if (log.length > 20) log.shift();
    localStorage.setItem(RECOVERY_LOG_KEY, JSON.stringify(log));
  } catch { /* */ }
}

function getRecoveryLog(): ContinuityRecoveryResult[] {
  try { return JSON.parse(localStorage.getItem(RECOVERY_LOG_KEY) ?? "[]") as ContinuityRecoveryResult[]; }
  catch { return []; }
}

// ── Reconstruction from memory ─────────────────────────────────────────────────

function reconstructFromMemory(): { slots: number; goals: number } {
  let slotsAdded = 0;
  let goalsAdded = 0;

  // Pull recent high-salience episodic + semantic memories to seed attention
  const recents = retrieveMemory({ maxTier: 4, minSalience: 0.55, limit: 5 });
  for (const mem of recents.slice(0, 3)) {
    addAttentionSlot(mem.content.slice(0, 120), "behavioral_pattern", 0.5, 0.03);
    slotsAdded++;
  }

  // Pull wellness goals from reflective memory
  const goalMemories = retrieveMemory({ domain: "wellness_goal", minSalience: 0.5, limit: 3 });
  for (const mem of goalMemories.slice(0, 2)) {
    addActiveGoal(mem.content.slice(0, 100), 0.6);
    goalsAdded++;
  }

  // Restore any flagged struggles as unresolved topics
  const struggles = retrieveMemory({ domain: "struggle", minSalience: 0.4, limit: 3 });
  for (const s of struggles.slice(0, 2)) {
    addUnresolvedTopic(s.content.slice(0, 80), 0.4);
  }

  // Seed emotional state from user model
  const report = getUserModelReport();
  const emotional = report.dimensions.find((d) => d.dimension === "emotional_tendency");
  if (emotional && emotional.confidence > 0.3) {
    // Map 0-1 emotional_tendency to valence -1→+1
    const valence = (emotional.value - 0.5) * 2;
    updateEmotionalContinuity(valence, 0.3, "calm");
  }

  return { slots: slotsAdded, goals: goalsAdded };
}

// ── Main recovery flow ─────────────────────────────────────────────────────────

export function recoverContinuity(reason: RecoveryReason = "app_restart"): ContinuityRecoveryResult {
  const startMs = Date.now();
  const checkpointAge = getCognitiveStateCheckpointAge();

  let outcome: RecoveryOutcome;
  let slotsRestored = 0;
  let goalsRestored = 0;

  if (checkpointAge !== null && checkpointAge < CHECKPOINT_FRESHNESS_MS) {
    // Checkpoint is fresh — full restore
    restoreCognitiveStateFromCheckpoint();
    const report = getCognitiveStateReport();
    slotsRestored = report.attentionSlotCount;
    goalsRestored = report.activeGoalCount;
    outcome = "full_checkpoint_restore";
  } else if (checkpointAge !== null && checkpointAge < CHECKPOINT_USABLE_MS) {
    // Checkpoint exists but is aging — restore and supplement from memory
    restoreCognitiveStateFromCheckpoint();
    const partial = reconstructFromMemory();
    const report = getCognitiveStateReport();
    slotsRestored = report.attentionSlotCount;
    goalsRestored = report.activeGoalCount + partial.goals;
    outcome = "partial_memory_rebuild";
  } else if (checkpointAge === null) {
    // No checkpoint at all — cold start, rebuild from durable memory
    const rebuilt = reconstructFromMemory();
    slotsRestored = rebuilt.slots;
    goalsRestored = rebuilt.goals;
    outcome = "cold_start";
  } else {
    // Checkpoint is too stale (>30min) — cold start with fresh rebuild
    const rebuilt = reconstructFromMemory();
    slotsRestored = rebuilt.slots;
    goalsRestored = rebuilt.goals;
    outcome = "cold_start";
  }

  clearCleanExitMarker();

  const reflections = getActiveReflections();
  const durationMs = Date.now() - startMs;

  const result: ContinuityRecoveryResult = {
    reason,
    outcome,
    checkpointAgeMs: checkpointAge,
    attentionSlotsRestored: slotsRestored,
    goalsRestored,
    reflectionsAvailable: reflections.length,
    recoveredAt: Date.now(),
    durationMs,
  };

  _lastRecovery = result;
  _recoveryCount++;
  appendRecoveryLog(result);

  emitCognitionEvent("continuity_restored", {
    reason,
    outcome,
    checkpointAgeMs: checkpointAge,
    slotsRestored,
    goalsRestored,
  });

  // Immediately checkpoint the freshly restored state
  checkpointCognitiveState();
  markCleanExit();

  return result;
}

// ── Visibility / lifecycle hooks ───────────────────────────────────────────────

export function handleTabVisibilityChange(hidden: boolean): void {
  if (hidden) {
    checkpointCognitiveState();
    markCleanExit();
  } else {
    const age = getCognitiveStateCheckpointAge();
    if (age !== null && age > CHECKPOINT_FRESHNESS_MS) {
      recoverContinuity("tab_hidden");
    }
  }
}

export function handleWorkerCrashDetected(): void {
  recoverContinuity("worker_crash");
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getContinuityStatus(): ContinuityStatus {
  return {
    isRecovered: _lastRecovery !== null,
    lastRecoveryAt: _lastRecovery?.recoveredAt ?? null,
    lastRecoveryOutcome: _lastRecovery?.outcome ?? null,
    lastReason: _lastRecovery?.reason ?? null,
    recoveryCount: _recoveryCount,
    crashMarkerPresent: hasCrashMarker(),
  };
}

export function getContinuityRecoveryLog(): ContinuityRecoveryResult[] {
  return getRecoveryLog();
}
