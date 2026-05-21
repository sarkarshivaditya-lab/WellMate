// Offline Deployment Validator — validates offline AI readiness across all subsystems.
//
// 12 checks verifying that the complete AI stack can function without network:
//   1.  localStorage accessible
//   2.  Worker pool initialized (at least 1 slot)
//   3.  Memory hierarchy readable (tiers 2-5)
//   4.  Cognition state initialized (goals + emotional state available)
//   5.  Proactive cognition loop bound to lifecycle
//   6.  Wellness safety governor initialized (state loadable)
//   7.  Unified context assembler functional (produces non-empty context)
//   8.  Coaching calibration loadable
//   9.  Trajectory computable (or cached)
//   10. Psychological safety runtime responsive
//   11. Assistant state model initialized
//   12. No active critical safety violations
//
// Verdict: "ready" | "degraded" | "not_ready"
// Degraded: non-critical failures (partial capability). Ready to deploy with caveats.
// Not ready: critical path broken.

import { getMemoryHierarchyReport } from "@/ai/memory/memoryHierarchy";
import { getInferenceWorkerBridgeState } from "@/ai/workers/inferenceWorkerBridge";
import { getCognitiveStateReport } from "@/ai/cognition/cognitiveStateEngine";
import { getProactiveCognitionReport } from "@/ai/cognition/proactiveCognitionLoop";
import { getWellnessSafetyReport } from "@/ai/wellness/wellnessSafetyGovernor";
import { assembleUnifiedContext } from "@/ai/cognition/unifiedContextAssembler";
import { getCurrentCoachingStyle } from "@/ai/coaching/adaptiveCoachingEngine";
import { getWellnessTrajectory, computeWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { getPsychologicalSafetyStatus } from "@/ai/assistant/psychologicalSafetyRuntime";
import { getAssistantStateReport } from "@/ai/assistant/assistantStateModel";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DeploymentCheckId =
  | "local_storage"
  | "worker_pool"
  | "memory_hierarchy"
  | "cognition_state"
  | "proactive_loop_bound"
  | "safety_governor"
  | "context_assembler"
  | "coaching_calibration"
  | "trajectory_available"
  | "safety_runtime"
  | "assistant_state"
  | "no_critical_violations";

export type DeploymentCheck = {
  checkId: DeploymentCheckId;
  passed: boolean;
  critical: boolean;        // failure = not_ready
  detail: string;
};

export type DeploymentValidationReport = {
  verdict: "ready" | "degraded" | "not_ready";
  score: number;            // 0-100
  checks: DeploymentCheck[];
  criticalFailures: string[];
  warnings: string[];
  validatedAt: number;
};

// ── Individual checks ──────────────────────────────────────────────────────────

function checkLocalStorage(): DeploymentCheck {
  try {
    const key = "__offline_ai_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return { checkId: "local_storage", passed: true, critical: true, detail: "localStorage accessible" };
  } catch {
    return { checkId: "local_storage", passed: false, critical: true, detail: "localStorage not accessible — offline persistence broken" };
  }
}

function checkWorkerPool(): DeploymentCheck {
  const state = getInferenceWorkerBridgeState();
  const activeSlots = state.slots.filter((s) => s.status !== "crashed").length;
  if (activeSlots === 0) {
    return { checkId: "worker_pool", passed: false, critical: false, detail: "No active inference slots — stub inference mode only" };
  }
  return { checkId: "worker_pool", passed: true, critical: false, detail: `${activeSlots} active inference slot(s)` };
}

function checkMemoryHierarchy(): DeploymentCheck {
  try {
    const report = getMemoryHierarchyReport();
    const tiersLoaded = report.tiers.filter((t) => t.tier >= 2).length;
    if (tiersLoaded < 3) {
      return { checkId: "memory_hierarchy", passed: false, critical: true, detail: `Only ${tiersLoaded}/4 memory tiers available` };
    }
    return { checkId: "memory_hierarchy", passed: true, critical: true, detail: `${report.totalItems} items across ${tiersLoaded} tiers` };
  } catch {
    return { checkId: "memory_hierarchy", passed: false, critical: true, detail: "Memory hierarchy threw on read" };
  }
}

function checkCognitionState(): DeploymentCheck {
  try {
    const report = getCognitiveStateReport();
    return { checkId: "cognition_state", passed: true, critical: true, detail: `${report.activeGoals} goals, emotional state: ${report.dominantEmotion}` };
  } catch {
    return { checkId: "cognition_state", passed: false, critical: true, detail: "Cognitive state engine not responsive" };
  }
}

function checkProactiveLoop(): DeploymentCheck {
  const loop = getProactiveCognitionReport();
  if (loop.totalRuns === 0) {
    return { checkId: "proactive_loop_bound", passed: false, critical: false, detail: "Proactive cognition loop has never run — call bindProactiveCognitionToLifecycle()" };
  }
  return { checkId: "proactive_loop_bound", passed: true, critical: false, detail: `${loop.totalRuns} run(s), avg ${loop.averageDurationMs}ms` };
}

function checkSafetyGovernor(): DeploymentCheck {
  try {
    const report = getWellnessSafetyReport();
    return { checkId: "safety_governor", passed: true, critical: true, detail: `Safety governor active; overall safe: ${report.overallSafe}` };
  } catch {
    return { checkId: "safety_governor", passed: false, critical: true, detail: "Wellness safety governor not responsive" };
  }
}

function checkContextAssembler(): DeploymentCheck {
  try {
    const ctx = assembleUnifiedContext(500);
    if (ctx.sectionsIncluded < 2) {
      return { checkId: "context_assembler", passed: false, critical: false, detail: "Context assembler produced < 2 sections — insufficient data" };
    }
    return { checkId: "context_assembler", passed: true, critical: false, detail: `${ctx.sectionsIncluded} sections, ${ctx.totalTokens} tokens` };
  } catch {
    return { checkId: "context_assembler", passed: false, critical: true, detail: "Unified context assembler threw on execution" };
  }
}

function checkCoachingCalibration(): DeploymentCheck {
  const style = getCurrentCoachingStyle();
  if (!style) {
    return { checkId: "coaching_calibration", passed: false, critical: false, detail: "No coaching calibration — will use defaults" };
  }
  return { checkId: "coaching_calibration", passed: true, critical: false, detail: `Style: ${style.tone}/${style.frame}, confidence: ${(style.confidenceInCalibration * 100).toFixed(0)}%` };
}

function checkTrajectory(): DeploymentCheck {
  let trajectory = getWellnessTrajectory();
  if (!trajectory) {
    try { trajectory = computeWellnessTrajectory(); } catch { /* ok */ }
  }
  if (!trajectory) {
    return { checkId: "trajectory_available", passed: false, critical: false, detail: "Wellness trajectory not available — insufficient historical data" };
  }
  const ageH = (Date.now() - trajectory.computedAt) / 3600000;
  return { checkId: "trajectory_available", passed: true, critical: false, detail: `Trajectory available, ${ageH.toFixed(1)}h old` };
}

function checkSafetyRuntime(): DeploymentCheck {
  try {
    const status = getPsychologicalSafetyStatus();
    return { checkId: "safety_runtime", passed: true, critical: true, detail: `Safety score: ${status.score}/100, verdict: ${status.verdict}` };
  } catch {
    return { checkId: "safety_runtime", passed: false, critical: true, detail: "Psychological safety runtime threw" };
  }
}

function checkAssistantState(): DeploymentCheck {
  try {
    const report = getAssistantStateReport();
    return { checkId: "assistant_state", passed: true, critical: true, detail: `Frame: ${report.state.activeCoachingFrame}, staleness: ${report.staleness}` };
  } catch {
    return { checkId: "assistant_state", passed: false, critical: true, detail: "Assistant state model not responsive" };
  }
}

function checkNoViolations(): DeploymentCheck {
  const safety = getWellnessSafetyReport();
  if (!safety.overallSafe) {
    return { checkId: "no_critical_violations", passed: false, critical: false, detail: `Active violations: ${safety.activeViolations.join(", ")}` };
  }
  return { checkId: "no_critical_violations", passed: true, critical: false, detail: "No active safety violations" };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

let _lastReport: DeploymentValidationReport | null = null;

export function runOfflineDeploymentValidation(): DeploymentValidationReport {
  const checks: DeploymentCheck[] = [
    checkLocalStorage(),
    checkWorkerPool(),
    checkMemoryHierarchy(),
    checkCognitionState(),
    checkProactiveLoop(),
    checkSafetyGovernor(),
    checkContextAssembler(),
    checkCoachingCalibration(),
    checkTrajectory(),
    checkSafetyRuntime(),
    checkAssistantState(),
    checkNoViolations(),
  ];

  const criticalFailures = checks.filter((c) => c.critical && !c.passed).map((c) => c.detail);
  const warnings = checks.filter((c) => !c.critical && !c.passed).map((c) => c.detail);

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  const verdict: DeploymentValidationReport["verdict"] =
    criticalFailures.length > 0 ? "not_ready" :
    warnings.length > 2 ? "degraded" : "ready";

  _lastReport = { verdict, score, checks, criticalFailures, warnings, validatedAt: Date.now() };
  return _lastReport;
}

export function getLastDeploymentReport(): DeploymentValidationReport | null {
  return _lastReport;
}

export function isOfflineDeploymentReady(): boolean {
  const report = _lastReport ?? runOfflineDeploymentValidation();
  return report.verdict !== "not_ready";
}
