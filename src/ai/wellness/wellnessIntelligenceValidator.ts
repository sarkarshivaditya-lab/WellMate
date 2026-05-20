// Wellness Intelligence Validator — validates the proactive wellness intelligence layer.
//
// 11 checks covering:
//   - Intervention frequency safety (not overwhelming the user)
//   - Burnout escalation suppression (AI not pushing when user is exhausted)
//   - Coaching drift (calibration not locked into a single style)
//   - Over-personalization (insufficient evidence for high-confidence adaptation)
//   - Disengagement prediction stability (prediction not wildly fluctuating)
//   - Insight evidence quality (insights have sufficient data support)
//   - Emotional safety (emotional model has adequate confidence)
//   - Pattern confidence quality (pattern graph not built on thin data)
//   - Proactive cognition stability (loop running regularly, not stuck)
//   - Psychological safety (no active safety violations)
//   - Trajectory model freshness (not stale)
//
// Returns a 0-100 score with grade and per-check details.

import { getWellnessSafetyReport } from "./wellnessSafetyGovernor";
import { getDisengagementPrediction } from "./disengagementPredictor";
import { getCoachingEngineReport } from "@/ai/coaching/adaptiveCoachingEngine";
import { getInsightSynthesisReport } from "./proactiveInsightSynthesizer";
import { getPatternGraphReport } from "./longitudinalPatternGraph";
import { getProactiveCognitionReport } from "@/ai/cognition/proactiveCognitionLoop";
import { getEmotionalContinuityReport } from "@/ai/cognition/emotionalContinuityEngine";
import { getWellnessTrajectory } from "./wellnessTrajectoryEngine";
import { getTimingEngineReport } from "./interventionTimingEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type WellnessValidationCheckId =
  | "intervention_frequency_safety"
  | "burnout_escalation_suppression"
  | "coaching_drift_prevention"
  | "over_personalization_detection"
  | "disengagement_prediction_stability"
  | "insight_evidence_quality"
  | "emotional_safety"
  | "pattern_confidence_quality"
  | "proactive_cognition_stability"
  | "psychological_safety"
  | "trajectory_model_freshness";

export type WellnessValidationResult = {
  checkId: WellnessValidationCheckId;
  passed: boolean;
  score: number;       // 0-100
  issue: string | null;
  recommendation: string | null;
};

export type WellnessValidationReport = {
  overallScore: number;
  grade: "excellent" | "good" | "degraded" | "critical";
  checks: WellnessValidationResult[];
  criticalIssues: string[];
  recommendations: string[];
  validatedAt: number;
};

// ── Check implementations ─────────────────────────────────────────────────────

function checkInterventionFrequency(): WellnessValidationResult {
  const safety = getWellnessSafetyReport();
  const freq = safety.interventionFrequency;
  if (freq > 3) {
    return { checkId: "intervention_frequency_safety", passed: false, score: 20,
      issue: `High intervention rate: ${freq.toFixed(1)}/day (recommended: ≤2/day)`,
      recommendation: "Increase minimum interval between interventions" };
  }
  if (freq > 2) {
    return { checkId: "intervention_frequency_safety", passed: false, score: 60,
      issue: `Elevated intervention rate: ${freq.toFixed(1)}/day`,
      recommendation: "Monitor; consider raising the daily cap threshold" };
  }
  return { checkId: "intervention_frequency_safety", passed: true, score: 100, issue: null, recommendation: null };
}

function checkBurnoutEscalation(): WellnessValidationResult {
  const safety = getWellnessSafetyReport();
  if (safety.activeViolations.includes("burnout_escalation")) {
    return { checkId: "burnout_escalation_suppression", passed: false, score: 0,
      issue: "Active burnout escalation violation — interventions may be pushing a struggling user",
      recommendation: "Immediately switch to rest/recovery framing only" };
  }
  return { checkId: "burnout_escalation_suppression", passed: true, score: 100, issue: null, recommendation: null };
}

function checkCoachingDrift(): WellnessValidationResult {
  const coaching = getCoachingEngineReport();
  if (coaching.driftRisk === "high") {
    return { checkId: "coaching_drift_prevention", passed: false, score: 30,
      issue: `High coaching drift risk (${coaching.evidenceCount} evidence points without reset)`,
      recommendation: "Consider resetting coaching calibration and rebuilding from fresh signals" };
  }
  if (coaching.driftRisk === "moderate") {
    return { checkId: "coaching_drift_prevention", passed: true, score: 70,
      issue: "Moderate drift risk — calibration has accumulated many updates",
      recommendation: "Schedule a calibration review checkpoint" };
  }
  return { checkId: "coaching_drift_prevention", passed: true, score: 100, issue: null, recommendation: null };
}

function checkOverPersonalization(): WellnessValidationResult {
  const coaching = getCoachingEngineReport();
  if (coaching.overpersonalizationRisk) {
    return { checkId: "over_personalization_detection", passed: false, score: 40,
      issue: "High-confidence calibration with insufficient evidence",
      recommendation: "Require more evidence before high-confidence calibration (currently <5 data points)" };
  }
  return { checkId: "over_personalization_detection", passed: true, score: 100, issue: null, recommendation: null };
}

function checkDisengagementStability(): WellnessValidationResult {
  const prediction = getDisengagementPrediction();
  if (!prediction) {
    return { checkId: "disengagement_prediction_stability", passed: true, score: 80,
      issue: "No prediction computed yet", recommendation: "Run the proactive cognition loop" };
  }
  if (prediction.confidence < 0.3) {
    return { checkId: "disengagement_prediction_stability", passed: true, score: 60,
      issue: "Low confidence in disengagement prediction",
      recommendation: "Increase user data coverage for more reliable predictions" };
  }
  return { checkId: "disengagement_prediction_stability", passed: true, score: 100, issue: null, recommendation: null };
}

function checkInsightEvidence(): WellnessValidationResult {
  const insights = getInsightSynthesisReport();
  const hasRecentSynthesis = insights.lastSynthesizedAt !== null &&
    Date.now() - insights.lastSynthesizedAt < 24 * 60 * 60 * 1000;
  if (!hasRecentSynthesis && insights.totalInsightsGenerated === 0) {
    return { checkId: "insight_evidence_quality", passed: true, score: 70,
      issue: "No insights synthesized yet — insufficient historical data",
      recommendation: "Requires 2+ weeks of wellness logging to generate meaningful insights" };
  }
  return { checkId: "insight_evidence_quality", passed: true, score: 100, issue: null, recommendation: null };
}

function checkEmotionalSafety(): WellnessValidationResult {
  const emotional = getEmotionalContinuityReport();
  const highUncertaintyDims = Object.values(emotional.profile.dimensions)
    .filter((d) => d.uncertainty > 0.85).length;
  if (highUncertaintyDims >= 4) {
    return { checkId: "emotional_safety", passed: true, score: 60,
      issue: `${highUncertaintyDims} emotional dimensions have very high uncertainty`,
      recommendation: "Avoid strong emotional framing until more conversation data is available" };
  }
  return { checkId: "emotional_safety", passed: true, score: 100, issue: null, recommendation: null };
}

function checkPatternConfidence(): WellnessValidationResult {
  const graph = getPatternGraphReport();
  if (graph.edgeCount === 0) {
    return { checkId: "pattern_confidence_quality", passed: true, score: 70,
      issue: "Pattern graph has no edges — insufficient longitudinal data",
      recommendation: "4+ weeks of multi-domain logging needed for pattern detection" };
  }
  const weakEdges = graph.topRelationships.filter((e) => e.confidence < 0.4);
  if (weakEdges.length > 0) {
    return { checkId: "pattern_confidence_quality", passed: true, score: 75,
      issue: `${weakEdges.length} pattern edges have low confidence`,
      recommendation: "Continue logging; patterns strengthen with more data" };
  }
  return { checkId: "pattern_confidence_quality", passed: true, score: 100, issue: null, recommendation: null };
}

function checkProactiveCognitionStability(): WellnessValidationResult {
  const loop = getProactiveCognitionReport();
  if (loop.totalRuns === 0) {
    return { checkId: "proactive_cognition_stability", passed: false, score: 40,
      issue: "Proactive cognition loop has never run",
      recommendation: "Ensure bindProactiveCognitionToLifecycle() is called during app init" };
  }
  if (loop.lastResult && loop.lastResult.stagesFailed.length > 3) {
    return { checkId: "proactive_cognition_stability", passed: false, score: 50,
      issue: `${loop.lastResult.stagesFailed.length} stages failed in last run`,
      recommendation: `Failed: ${loop.lastResult.stagesFailed.join(", ")}` };
  }
  return { checkId: "proactive_cognition_stability", passed: true, score: 100, issue: null, recommendation: null };
}

function checkPsychologicalSafety(): WellnessValidationResult {
  const safety = getWellnessSafetyReport();
  if (!safety.overallSafe) {
    return { checkId: "psychological_safety", passed: false, score: 20,
      issue: `Active safety violations: ${safety.activeViolations.join(", ")}`,
      recommendation: "Audit proactive content and suppress until violations are resolved" };
  }
  if (safety.totalBlocksThisSession > 5) {
    return { checkId: "psychological_safety", passed: true, score: 70,
      issue: `${safety.totalBlocksThisSession} interventions blocked this session — safety guards are working hard`,
      recommendation: "Review why so many interventions are being generated; reduce generation frequency" };
  }
  return { checkId: "psychological_safety", passed: true, score: 100, issue: null, recommendation: null };
}

function checkTrajectoryFreshness(): WellnessValidationResult {
  const trajectory = getWellnessTrajectory();
  if (!trajectory) {
    return { checkId: "trajectory_model_freshness", passed: false, score: 50,
      issue: "Wellness trajectory has not been computed",
      recommendation: "Run computeWellnessTrajectory() or trigger the proactive cognition loop" };
  }
  const ageMs = Date.now() - trajectory.computedAt;
  const maxAgeMs = 4 * 60 * 60 * 1000;  // 4 hours
  if (ageMs > maxAgeMs) {
    return { checkId: "trajectory_model_freshness", passed: false, score: 60,
      issue: `Trajectory model is ${Math.round(ageMs / 3600000)}h old`,
      recommendation: "Run the proactive cognition loop to refresh" };
  }
  return { checkId: "trajectory_model_freshness", passed: true, score: 100, issue: null, recommendation: null };
}

// ── State ──────────────────────────────────────────────────────────────────────

let _lastReport: WellnessValidationReport | null = null;

// ── Main entry ────────────────────────────────────────────────────────────────

export function runWellnessIntelligenceValidation(): WellnessValidationReport {
  const checks: WellnessValidationResult[] = [
    checkInterventionFrequency(),
    checkBurnoutEscalation(),
    checkCoachingDrift(),
    checkOverPersonalization(),
    checkDisengagementStability(),
    checkInsightEvidence(),
    checkEmotionalSafety(),
    checkPatternConfidence(),
    checkProactiveCognitionStability(),
    checkPsychologicalSafety(),
    checkTrajectoryFreshness(),
  ];

  const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
  const grade: WellnessValidationReport["grade"] =
    overallScore >= 85 ? "excellent" :
    overallScore >= 65 ? "good" :
    overallScore >= 40 ? "degraded" : "critical";

  const criticalIssues = checks.filter((c) => !c.passed && c.score < 40).map((c) => c.issue as string);
  const recommendations = checks.filter((c) => c.recommendation).map((c) => c.recommendation as string);

  _lastReport = { overallScore, grade, checks, criticalIssues, recommendations, validatedAt: Date.now() };
  return _lastReport;
}

export function getLastWellnessValidationReport(): WellnessValidationReport | null {
  return _lastReport;
}

export function getWellnessIntelligenceScore(): number {
  return _lastReport?.overallScore ?? 100;
}
