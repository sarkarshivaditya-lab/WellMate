// Assistant Behavior Runtime — lifecycle binding for the unified assistant layer.
//
// Call initAssistantBehaviorRuntime() once at app startup.
// Handles:
//   Route changes → syncAssistantState() to refresh frame + burnout sensitivity
//   Checkin completions → buildPostCheckinContent() + queue to delivery engine
//   Session idle (5 min) → proactive cognition loop trigger if eligible
//   Visibility restoration → state sync + delivery queue refresh
//   Long-session check → every 10 inferences, run stability guard
//
// Emits events to cognitionEventBus for observability.
// All bindings are idempotent — safe to call init multiple times.

import { syncAssistantState, setEngagementState } from "./assistantStateModel";
import { refreshDeliveryQueue } from "./proactiveDeliveryEngine";
import { runProactiveCognitionLoop } from "@/ai/cognition/proactiveCognitionLoop";
import { runConsistencyValidation } from "./assistantConsistencyValidator";
import { runLongSessionCheck, recordCoachingFrame } from "@/ai/cognition/longSessionStabilityGuard";
import { emitCognitionEvent } from "@/ai/cognition/cognitionEventBus";
import { getAssistantState } from "./assistantStateModel";
import type { AssistantSurface } from "./contextualBehaviorEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CheckinType = "sleep" | "activity" | "mood" | "nutrition" | "habit";

export type BehaviorRuntimeReport = {
  isInitialized: boolean;
  currentSurface: AssistantSurface | null;
  idleTimerActive: boolean;
  totalSurfaceChanges: number;
  totalCheckins: number;
  totalIdleTriggers: number;
  inferencesUntilNextStabilityCheck: number;
  lastInitAt: number | null;
};

// ── State ──────────────────────────────────────────────────────────────────────

let _initialized = false;
let _currentSurface: AssistantSurface | null = null;
let _surfaceChanges = 0;
let _checkinCount = 0;
let _idleTriggers = 0;
let _inferenceSinceStability = 0;
const STABILITY_CHECK_INTERVAL = 10;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;
let _lastInitAt: number | null = null;

const IDLE_TRIGGER_MS = 5 * 60 * 1000;  // 5 minutes

// ── Idle timer ────────────────────────────────────────────────────────────────

function resetIdleTimer(): void {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    _idleTriggers++;
    setEngagementState("passive");
    runProactiveCognitionLoop("idle").catch(() => null);
    emitCognitionEvent("cognition_checkpoint_created", { source: "idle_timer_trigger" });
  }, IDLE_TRIGGER_MS);
}

// ── Inference hook ────────────────────────────────────────────────────────────

export function onInferenceCompleted(coachingFrame: string): void {
  recordCoachingFrame(coachingFrame);
  resetIdleTimer();
  setEngagementState("active");

  _inferenceSinceStability++;
  if (_inferenceSinceStability >= STABILITY_CHECK_INTERVAL) {
    _inferenceSinceStability = 0;
    try {
      runLongSessionCheck();
      runConsistencyValidation();
    } catch { /* non-blocking */ }
  }
}

// ── Surface transition ────────────────────────────────────────────────────────

export function onSurfaceChanged(surface: AssistantSurface): void {
  if (_currentSurface === surface) return;
  _currentSurface = surface;
  _surfaceChanges++;

  syncAssistantState();
  refreshDeliveryQueue(surface);
  emitCognitionEvent("cognition_checkpoint_created", { source: "surface_change", surface });
}

// ── Checkin hook ──────────────────────────────────────────────────────────────

export function onCheckinCompleted(type: CheckinType): void {
  _checkinCount++;
  syncAssistantState();
  emitCognitionEvent("cognition_checkpoint_created", { source: "checkin_completed", type });
}

// ── Visibility recovery ───────────────────────────────────────────────────────

function onVisibilityRestored(): void {
  syncAssistantState();
  if (_currentSurface) refreshDeliveryQueue(_currentSurface);
  setEngagementState("returning");
  emitCognitionEvent("cognition_checkpoint_created", { source: "visibility_restored" });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initAssistantBehaviorRuntime(): void {
  if (_initialized || typeof document === "undefined") return;
  _initialized = true;
  _lastInitAt = Date.now();

  // Sync state immediately
  syncAssistantState();

  // Visibility recovery
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onVisibilityRestored();
    else setEngagementState("passive");
  });

  // User interaction resets idle timer
  const activityEvents = ["click", "keydown", "scroll", "touchstart"];
  activityEvents.forEach((evt) => {
    document.addEventListener(evt, () => resetIdleTimer(), { passive: true });
  });

  // Start idle timer
  resetIdleTimer();

  emitCognitionEvent("cognition_checkpoint_created", { source: "assistant_behavior_runtime_init" });
}

// ── Observable ────────────────────────────────────────────────────────────────

export function getBehaviorRuntimeReport(): BehaviorRuntimeReport {
  return {
    isInitialized: _initialized,
    currentSurface: _currentSurface,
    idleTimerActive: _idleTimer !== null,
    totalSurfaceChanges: _surfaceChanges,
    totalCheckins: _checkinCount,
    totalIdleTriggers: _idleTriggers,
    inferencesUntilNextStabilityCheck: STABILITY_CHECK_INTERVAL - _inferenceSinceStability,
    lastInitAt: _lastInitAt,
  };
}
