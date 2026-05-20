// Proactive Cognition Loop — periodic background wellness cognition.
//
// Runs during idle windows to refresh the proactive intelligence layer.
//
// Responsibilities:
//   1. Recompute wellness trajectory
//   2. Refresh disengagement risk
//   3. Synthesize proactive insights
//   4. Detect recovery opportunities
//   5. Update coaching calibration
//   6. Compute longitudinal pattern graph
//   7. Decay stale assumptions
//   8. Run wellness safety audit
//
// Trigger conditions:
//   - requestIdleCallback (browser idle)
//   - App tab becomes visible after inactivity
//   - Explicit manual trigger (dev tools)
//   - Minimum interval: 4 hours between runs
//
// This is NOT a polling loop. It fires on meaningful lifecycle events.
// Resource bounds: completes in < 500ms on mobile hardware.

import { computeWellnessTrajectory, invalidateTrajectoryCache } from "@/ai/wellness/wellnessTrajectoryEngine";
import { predictDisengagement, invalidateDisengagementCache } from "@/ai/wellness/disengagementPredictor";
import { detectRecoveryOpportunities } from "@/ai/wellness/recoveryOpportunityDetector";
import { synthesizeProactiveInsights } from "@/ai/wellness/proactiveInsightSynthesizer";
import { calibrateCoachingStyle } from "@/ai/coaching/adaptiveCoachingEngine";
import { computeLongitudinalPatternGraph } from "@/ai/wellness/longitudinalPatternGraph";
import { runWellnessSafetyAudit } from "@/ai/wellness/wellnessSafetyGovernor";
import { applyUserModelDecay } from "@/ai/cognition/userModel";
import { emitCognitionEvent } from "@/ai/cognition/cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProactiveCognitionStage =
  | "trajectory"
  | "disengagement"
  | "recovery"
  | "insights"
  | "coaching"
  | "pattern_graph"
  | "decay"
  | "safety_audit";

export type ProactiveCognitionRunResult = {
  stagesCompleted: ProactiveCognitionStage[];
  stagesFailed: ProactiveCognitionStage[];
  durationMs: number;
  ranAt: number;
  triggeredBy: "idle" | "visibility" | "manual";
  disengagementRisk: number;
  hasRecoveryWindow: boolean;
  freshInsightCount: number;
  safetyViolations: number;
};

export type ProactiveCognitionReport = {
  totalRuns: number;
  lastRunAt: number | null;
  lastRunDurationMs: number;
  averageDurationMs: number;
  lastResult: ProactiveCognitionRunResult | null;
  isRunning: boolean;
};

// ── State ──────────────────────────────────────────────────────────────────────

const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;  // 4 hours minimum between runs
const STORAGE_KEY = "ai_proactive_cognition_loop_v1";

let _isRunning = false;
let _totalRuns = 0;
let _totalDurationMs = 0;
let _lastResult: ProactiveCognitionRunResult | null = null;

type LoopState = {
  lastRunAt: number | null;
};

function loadState(): LoopState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { lastRunAt: null };
  } catch { return { lastRunAt: null }; }
}

function saveState(state: LoopState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ok */ }
}

function isRunEligible(): boolean {
  const state = loadState();
  if (!state.lastRunAt) return true;
  return Date.now() - state.lastRunAt >= MIN_INTERVAL_MS;
}

// ── Stage runner ──────────────────────────────────────────────────────────────

async function runStage<T>(
  stage: ProactiveCognitionStage,
  fn: () => T | Promise<T>,
  completed: ProactiveCognitionStage[],
  failed: ProactiveCognitionStage[],
): Promise<T | null> {
  try {
    const result = await fn();
    completed.push(stage);
    return result;
  } catch {
    failed.push(stage);
    return null;
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runProactiveCognitionLoop(
  triggeredBy: ProactiveCognitionRunResult["triggeredBy"] = "idle",
  forceRun = false,
): Promise<ProactiveCognitionRunResult | null> {
  if (_isRunning) return null;
  if (!forceRun && !isRunEligible()) return null;

  _isRunning = true;
  const start = Date.now();
  const completed: ProactiveCognitionStage[] = [];
  const failed: ProactiveCognitionStage[] = [];

  try {
    emitCognitionEvent("cognition_checkpoint_created", { source: "proactive_cognition_loop_start", triggeredBy });

    // 1. Trajectory (invalidate cache first to force fresh computation)
    invalidateTrajectoryCache();
    await runStage("trajectory", () => computeWellnessTrajectory(true), completed, failed);

    // 2. Disengagement
    invalidateDisengagementCache();
    const disengagement = await runStage("disengagement", () => predictDisengagement(true), completed, failed);

    // 3. Recovery windows
    const recovery = await runStage("recovery", () => detectRecoveryOpportunities(true), completed, failed);

    // 4. Proactive insights
    const insights = await runStage("insights", () => synthesizeProactiveInsights(true), completed, failed);

    // 5. Coaching calibration
    await runStage("coaching", () => calibrateCoachingStyle(), completed, failed);

    // 6. Pattern graph
    await runStage("pattern_graph", () => computeLongitudinalPatternGraph(true), completed, failed);

    // 7. Decay stale user model assumptions
    await runStage("decay", () => applyUserModelDecay(), completed, failed);

    // 8. Safety audit
    const safetyAudit = await runStage("safety_audit", () => runWellnessSafetyAudit(), completed, failed);

    const durationMs = Date.now() - start;
    _totalRuns++;
    _totalDurationMs += durationMs;

    const result: ProactiveCognitionRunResult = {
      stagesCompleted: completed,
      stagesFailed: failed,
      durationMs,
      ranAt: Date.now(),
      triggeredBy,
      disengagementRisk: disengagement?.riskScore ?? 0,
      hasRecoveryWindow: (recovery?.opportunities.length ?? 0) > 0,
      freshInsightCount: insights?.freshInsights.length ?? 0,
      safetyViolations: safetyAudit?.activeViolations.length ?? 0,
    };

    _lastResult = result;
    saveState({ lastRunAt: Date.now() });
    emitCognitionEvent("cognition_checkpoint_created", { source: "proactive_cognition_loop_complete", stagesCompleted: completed.length });

    return result;
  } catch {
    return null;
  } finally {
    _isRunning = false;
  }
}

// ── Lifecycle bindings ────────────────────────────────────────────────────────

let _visibilityBound = false;
let _idleCallbackId: number | null = null;

export function bindProactiveCognitionToLifecycle(): void {
  if (typeof document === "undefined") return;

  if (!_visibilityBound) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // Tab became visible — check if a run is warranted (after long absence)
        if (isRunEligible()) {
          runProactiveCognitionLoop("visibility").catch(() => null);
        }
      }
    });
    _visibilityBound = true;
  }

  // Schedule idle-time computation
  if ("requestIdleCallback" in window && _idleCallbackId === null) {
    _idleCallbackId = window.requestIdleCallback(
      () => {
        _idleCallbackId = null;
        runProactiveCognitionLoop("idle").catch(() => null);
      },
      { timeout: 10_000 },  // fallback after 10s if never idle
    );
  }
}

export function unbindProactiveCognition(): void {
  if (_idleCallbackId !== null && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(_idleCallbackId);
    _idleCallbackId = null;
  }
}

// ── Observable ────────────────────────────────────────────────────────────────

export function getProactiveCognitionReport(): ProactiveCognitionReport {
  const state = loadState();
  return {
    totalRuns: _totalRuns,
    lastRunAt: state.lastRunAt,
    lastRunDurationMs: _lastResult?.durationMs ?? 0,
    averageDurationMs: _totalRuns > 0 ? Math.round(_totalDurationMs / _totalRuns) : 0,
    lastResult: _lastResult,
    isRunning: _isRunning,
  };
}
