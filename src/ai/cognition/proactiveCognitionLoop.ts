export type ProactiveCognitionStage = "trajectory" | "disengagement" | "recovery" | "insights" | "coaching" | "pattern_graph" | "decay" | "safety_audit";
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
export async function runProactiveCognitionLoop(_triggeredBy: ProactiveCognitionRunResult["triggeredBy"] = "idle", _forceRun = false): Promise<ProactiveCognitionRunResult | null> { return null; }
export function bindProactiveCognitionToLifecycle(): void {}
export function unbindProactiveCognition(): void {}
export function getProactiveCognitionReport(): ProactiveCognitionReport { return { totalRuns: 0, lastRunAt: null, lastRunDurationMs: 0, averageDurationMs: 0, lastResult: null, isRunning: false }; }
