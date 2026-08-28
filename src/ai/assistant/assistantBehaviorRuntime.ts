export type CheckinType = "sleep" | "activity" | "mood" | "nutrition" | "habit";
export type AssistantSurface = "overview" | "physical" | "mental" | "habits" | "journal" | "sleep" | "tools" | "chat" | "unknown";
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
let initialized = false;
export function initAssistantBehaviorRuntime(): void { initialized = true; }
export function onInferenceCompleted(_coachingFrame: string): void {}
export function onSurfaceChanged(_surface: AssistantSurface): void {}
export function onCheckinCompleted(_type: CheckinType): void {}
export function getBehaviorRuntimeReport(): BehaviorRuntimeReport {
  return { isInitialized: initialized, currentSurface: null, idleTimerActive: false, totalSurfaceChanges: 0, totalCheckins: 0, totalIdleTriggers: 0, inferencesUntilNextStabilityCheck: 10, lastInitAt: initialized ? Date.now() : null };
}
