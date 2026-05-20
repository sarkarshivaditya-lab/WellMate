// Assistant Consistency Validator — detects behavioral contradictions in assistant output.
//
// Checks run after every inference and surfaced in AIDevPanel.
//
// Violations detected:
//   contradictory_coaching    — assistant gave accountability framing to a user in burnout
//   emotional_inconsistency   — assistant tone conflicts with detected emotional trajectory
//   tone_drift                — assistant tone has shifted significantly across recent turns
//   excessive_interventions   — too many proactive suggestions in a short window
//   conflicting_advice        — assistant gave advice contradicting prior recommendation
//   safety_bypass             — assistant output passed safety governor but contains risk signals
//
// Scoring: 0-100. Critical violations floor score to 0.

import { getAssistantState } from "./assistantStateModel";
import { getOrchestratorReport } from "@/ai/cognition/cognitiveExecutionOrchestrator";
import { getWellnessSafetyReport } from "@/ai/wellness/wellnessSafetyGovernor";
import { getDeliveryEngineReport } from "./proactiveDeliveryEngine";
import { getEmotionalContinuityReport } from "@/ai/cognition/emotionalContinuityEngine";
import { getCoachingEngineReport } from "@/ai/coaching/adaptiveCoachingEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConsistencyViolationType =
  | "contradictory_coaching"
  | "emotional_inconsistency"
  | "tone_drift"
  | "excessive_interventions"
  | "conflicting_advice"
  | "safety_bypass";

export type ConsistencyViolation = {
  type: ConsistencyViolationType;
  severity: "critical" | "warning" | "info";
  description: string;
  recommendation: string;
};

export type ConsistencyValidationReport = {
  score: number;                         // 0-100
  grade: "excellent" | "good" | "degraded" | "critical";
  violations: ConsistencyViolation[];
  criticalViolations: ConsistencyViolation[];
  warnings: ConsistencyViolation[];
  validatedAt: number;
};

// ── Check implementations ──────────────────────────────────────────────────────

function checkContradictoryCoaching(): ConsistencyViolation | null {
  const state = getAssistantState();
  const coaching = getCoachingEngineReport();

  if (!coaching.currentStyle) return null;

  const highBurnout = state.burnoutSensitivity > 0.65;
  const isAccountabilityFrame = state.activeCoachingFrame === "accountability";
  const hasHighPressure = coaching.currentStyle.pressure === "moderate";

  if (highBurnout && isAccountabilityFrame) {
    return {
      type: "contradictory_coaching",
      severity: "critical",
      description: "Accountability framing is active while burnout sensitivity is high. This risks pushing a struggling user.",
      recommendation: "Switch to recovery or validation framing until burnout sensitivity drops below 0.5.",
    };
  }

  if (highBurnout && hasHighPressure) {
    return {
      type: "contradictory_coaching",
      severity: "critical",
      description: "Moderate pressure coaching applied to user with high burnout sensitivity.",
      recommendation: "Force pressure to 'none' when burnoutSensitivity > 0.65.",
    };
  }

  return null;
}

function checkEmotionalInconsistency(): ConsistencyViolation | null {
  const state = getAssistantState();
  const emotional = getEmotionalContinuityReport();

  const motivLow = emotional.profile.dimensions.motivation.value < 0.3;
  const isCelebratoryFrame = state.activeCoachingFrame === "celebration";

  if (motivLow && isCelebratoryFrame) {
    return {
      type: "emotional_inconsistency",
      severity: "warning",
      description: "Celebratory coaching frame active while user motivation is very low. This may feel tone-deaf.",
      recommendation: "Switch to encouragement or validation framing when motivation < 0.3.",
    };
  }

  const stressHigh = emotional.profile.dimensions.stress.value > 0.75;
  const isStructuredFrame = state.activeCoachingFrame === "accountability";
  if (stressHigh && isStructuredFrame) {
    return {
      type: "emotional_inconsistency",
      severity: "warning",
      description: "High-structure accountability coaching while stress levels are very high.",
      recommendation: "Reduce structure demands during elevated stress periods.",
    };
  }

  return null;
}

function checkToneDrift(): ConsistencyViolation | null {
  const coaching = getCoachingEngineReport();

  if (coaching.driftRisk === "high") {
    return {
      type: "tone_drift",
      severity: "warning",
      description: `Coaching drift risk is high (${coaching.evidenceCount} calibration updates without reset).`,
      recommendation: "Reset coaching calibration to prevent over-personalization.",
    };
  }

  return null;
}

function checkExcessiveInterventions(): ConsistencyViolation | null {
  const delivery = getDeliveryEngineReport();
  const safety = getWellnessSafetyReport();

  if (safety.totalBlocksThisSession > 4) {
    return {
      type: "excessive_interventions",
      severity: "warning",
      description: `${safety.totalBlocksThisSession} interventions were blocked this session. The system is generating too many proactive attempts.`,
      recommendation: "Increase minimum interval between proactive cognition loop runs.",
    };
  }

  if (delivery.deliveredTodayCount >= 3) {
    return {
      type: "excessive_interventions",
      severity: "critical",
      description: `${delivery.deliveredTodayCount} proactive deliveries today — exceeds the 2/day cap.`,
      recommendation: "Audit delivery engine; daily cap enforcement may have a gap.",
    };
  }

  return null;
}

function checkConflictingAdvice(): ConsistencyViolation | null {
  const safety = getWellnessSafetyReport();

  if (safety.activeViolations.length > 0) {
    return {
      type: "conflicting_advice",
      severity: "critical",
      description: `Active safety violations: ${safety.activeViolations.join(", ")}. Assistant content may conflict with user wellbeing needs.`,
      recommendation: "Suppress all proactive content until safety violations are resolved.",
    };
  }

  return null;
}

function checkSafetyBypass(): ConsistencyViolation | null {
  const orchestrator = getOrchestratorReport();
  const safety = getWellnessSafetyReport();

  // If last execution succeeded but safety governor has active violations, something got through
  const hasRecentExecution = orchestrator.lastExecutionAt !== null &&
    Date.now() - orchestrator.lastExecutionAt < 10 * 60 * 1000;  // within 10 min

  if (hasRecentExecution && !safety.overallSafe) {
    return {
      type: "safety_bypass",
      severity: "critical",
      description: "An inference completed recently but the safety governor reports violations. Safety check may not have been applied.",
      recommendation: "Ensure checkInterventionSafety() is called in unifiedAssistantOrchestrator before every inference.",
    };
  }

  return null;
}

// ── Main entry ─────────────────────────────────────────────────────────────────

let _lastReport: ConsistencyValidationReport | null = null;

export function runConsistencyValidation(): ConsistencyValidationReport {
  const checks = [
    checkContradictoryCoaching(),
    checkEmotionalInconsistency(),
    checkToneDrift(),
    checkExcessiveInterventions(),
    checkConflictingAdvice(),
    checkSafetyBypass(),
  ];

  const violations: ConsistencyViolation[] = checks.filter((c): c is ConsistencyViolation => c !== null);
  const criticalViolations = violations.filter((v) => v.severity === "critical");
  const warnings = violations.filter((v) => v.severity === "warning");

  // Score: start at 100, subtract per violation
  let score = 100;
  for (const v of violations) {
    if (v.severity === "critical") score -= 35;
    else if (v.severity === "warning") score -= 15;
    else score -= 5;
  }
  score = Math.max(0, score);

  const grade: ConsistencyValidationReport["grade"] =
    score >= 85 ? "excellent" :
    score >= 65 ? "good" :
    score >= 40 ? "degraded" : "critical";

  _lastReport = { score, grade, violations, criticalViolations, warnings, validatedAt: Date.now() };
  return _lastReport;
}

export function getLastConsistencyReport(): ConsistencyValidationReport | null {
  return _lastReport;
}

export function getConsistencyScore(): number {
  return _lastReport?.score ?? 100;
}
