// Production Readiness Report — master readiness assessment for the full AI stack.
//
// Scores 6 subsystems, each 0-100:
//
//   inference         (20%) — worker health, throughput, thermal state, bypass audit
//   cognition         (20%) — memory hierarchy, goal threads, emotional continuity, coherence
//   wellness          (20%) — trajectory freshness, proactive loop, safety governor
//   assistant         (15%) — state model, consistency, surface coverage
//   safety            (15%) — psychological safety score, active violations
//   mobile_offline    (10%) — mobile hardener, offline validator, localStorage
//
// Overall: weighted sum of subsystem scores.
//
// Grades: production_ready (>=85), staging_only (>=65), dev_only (<65)
//
// Known blockers: subsystem failures that prevent production deployment.
// Deployment risks: non-blocking issues that need monitoring.

import { getInferenceWorkerBridgeState } from "@/ai/workers/inferenceWorkerBridge";
import { getThroughputSummary } from "@/ai/runtime/throughputProfiler";
import { getMemoryHierarchyReport } from "@/ai/memory/memoryHierarchy";
import { getGoalThreadReport } from "@/ai/cognition/goalThreadTracker";
import { getEmotionalContinuityReport } from "@/ai/cognition/emotionalContinuityEngine";
import { getLastCoherenceReport } from "@/ai/cognition/cognitiveCoherenceValidator";
import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { getProactiveCognitionReport } from "@/ai/cognition/proactiveCognitionLoop";
import { getWellnessSafetyReport } from "@/ai/wellness/wellnessSafetyGovernor";
import { getAssistantStateReport } from "@/ai/assistant/assistantStateModel";
import { getLastConsistencyReport } from "@/ai/assistant/assistantConsistencyValidator";
import { getPsychologicalSafetyStatus } from "@/ai/assistant/psychologicalSafetyRuntime";
import { getMobileHardenerReport } from "@/ai/platform/mobileExecutionHardener";
import { getLastDeploymentReport, runOfflineDeploymentValidation } from "./offlineDeploymentValidator";
import { runBypassAudit } from "./productionInferenceBridge";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SubsystemId =
  | "inference"
  | "cognition"
  | "wellness"
  | "assistant"
  | "safety"
  | "mobile_offline";

export type SubsystemReadiness = {
  id: SubsystemId;
  score: number;              // 0-100
  grade: "ready" | "degraded" | "critical";
  blockers: string[];
  risks: string[];
};

export type ProductionReadinessReport = {
  overallScore: number;
  deploymentGrade: "production_ready" | "staging_only" | "dev_only";
  subsystems: SubsystemReadiness[];
  knownBlockers: string[];
  deploymentRisks: string[];
  stubbedSystems: string[];
  remainingProductionBlockers: string[];
  generatedAt: number;
};

// ── Subsystem scorers ──────────────────────────────────────────────────────────

function scoreInference(): SubsystemReadiness {
  const workerState = getInferenceWorkerBridgeState();
  const throughput = getThroughputSummary();
  const bypass = runBypassAudit();

  const blockers: string[] = [];
  const risks: string[] = [];

  const activeSlots = workerState.slots.filter((s) => s.status !== "crashed").length;
  if (activeSlots === 0) blockers.push("No active inference workers — model not loaded or workers crashed");

  const crashedSlots = workerState.slots.filter((s) => s.status === "crashed").length;
  if (crashedSlots > 0) risks.push(`${crashedSlots} crashed inference slot(s)`);

  if (bypass.verdict === "suspected_bypass") {
    risks.push(`Bypass audit: ~${bypass.estimatedBypasses} direct inference calls detected (${(bypass.bypassRatio * 100).toFixed(0)}% bypass rate)`);
  }

  if (throughput && throughput.avgTokPerSec < 2) {
    risks.push(`Low throughput: avg = ${throughput.avgTokPerSec.toFixed(1)} tok/s — mobile experience may be poor`);
  }

  let score = 100;
  if (activeSlots === 0) score -= 60;
  if (bypass.verdict === "suspected_bypass") score -= 20;
  if (crashedSlots > 0) score -= 10 * crashedSlots;

  return { id: "inference", score: Math.max(0, score), grade: score >= 70 ? "ready" : score >= 40 ? "degraded" : "critical", blockers, risks };
}

function scoreCognition(): SubsystemReadiness {
  const memory = getMemoryHierarchyReport();
  const goals = getGoalThreadReport();
  const emotional = getEmotionalContinuityReport();
  const coherence = getLastCoherenceReport();

  const blockers: string[] = [];
  const risks: string[] = [];

  if (memory.totalItems === 0) risks.push("Memory hierarchy is empty — new user or cleared data");

  const highUncertainty = Object.values(emotional.profile.dimensions).filter((d) => d.uncertainty > 0.85).length;
  if (highUncertainty >= 4) risks.push(`${highUncertainty} emotional dimensions have very high uncertainty`);

  if (coherence && coherence.overallScore < 50) risks.push(`Cognitive coherence score low: ${coherence.overallScore}/100`);
  if (goals.topThreads.length === 0) risks.push("No goal threads — assistant has no wellness context for the user");

  const score = Math.min(100,
    (memory.totalItems > 0 ? 30 : 0) +
    (goals.topThreads.length > 0 ? 20 : 0) +
    (highUncertainty < 3 ? 25 : 10) +
    ((coherence?.overallScore ?? 80) * 0.25),
  );

  return { id: "cognition", score: Math.round(score), grade: score >= 70 ? "ready" : score >= 40 ? "degraded" : "critical", blockers, risks };
}

function scoreWellness(): SubsystemReadiness {
  const trajectory = getWellnessTrajectory();
  const loop = getProactiveCognitionReport();
  const safety = getWellnessSafetyReport();

  const blockers: string[] = [];
  const risks: string[] = [];

  if (!safety.overallSafe) blockers.push(`Active safety violations: ${safety.activeViolations.join(", ")}`);
  if (!trajectory) risks.push("Wellness trajectory not computed — needs 2+ weeks of logging");
  if (loop.totalRuns === 0) risks.push("Proactive cognition loop never ran — call bindProactiveCognitionToLifecycle() at init");

  const ageH = trajectory ? (Date.now() - trajectory.computedAt) / 3600000 : Infinity;
  if (ageH > 6) risks.push(`Trajectory is ${ageH.toFixed(1)}h old — may be stale`);

  const score = Math.max(0, 100 -
    (safety.overallSafe ? 0 : 40) -
    (!trajectory ? 20 : ageH > 6 ? 10 : 0) -
    (loop.totalRuns === 0 ? 15 : 0) -
    (safety.totalBlocksThisSession > 5 ? 10 : 0),
  );

  return { id: "wellness", score, grade: score >= 70 ? "ready" : score >= 40 ? "degraded" : "critical", blockers, risks };
}

function scoreAssistant(): SubsystemReadiness {
  const stateReport = getAssistantStateReport();
  const consistency = getLastConsistencyReport();

  const blockers: string[] = [];
  const risks: string[] = [];

  if (stateReport.staleness === "stale") risks.push("Assistant state is stale — syncAssistantState() may not be running");
  if (consistency && consistency.grade === "critical") blockers.push("Critical consistency violations detected");
  if (consistency && consistency.criticalViolations.length > 0) {
    blockers.push(...consistency.criticalViolations.map((v) => v.description));
  }

  const score = Math.max(0, 100 -
    (stateReport.staleness === "stale" ? 15 : stateReport.staleness === "recent" ? 5 : 0) -
    ((consistency?.criticalViolations.length ?? 0) * 25) -
    ((consistency?.warnings.length ?? 0) * 8),
  );

  return { id: "assistant", score: Math.min(100, score), grade: score >= 70 ? "ready" : score >= 40 ? "degraded" : "critical", blockers, risks };
}

function scoreSafety(): SubsystemReadiness {
  const psych = getPsychologicalSafetyStatus();
  const blockers: string[] = [];
  const risks: string[] = [];

  if (psych.verdict === "blocked") blockers.push(`Safety blocked by: ${psych.blockedBy}`);
  if (psych.activeRisks.length > 0) risks.push(...psych.activeRisks.slice(0, 3));

  return {
    id: "safety",
    score: psych.score,
    grade: psych.score >= 70 ? "ready" : psych.score >= 40 ? "degraded" : "critical",
    blockers,
    risks,
  };
}

function scoreMobileOffline(): SubsystemReadiness {
  const mobile = getMobileHardenerReport();
  const deployment = getLastDeploymentReport() ?? runOfflineDeploymentValidation();

  const blockers: string[] = [];
  const risks: string[] = [];

  if (!mobile.isHardened) risks.push("Mobile hardener not initialized — call initMobileHardener() at app startup");
  if (deployment.verdict === "not_ready") blockers.push(...deployment.criticalFailures);
  if (mobile.memoryWarnings > 0) risks.push(`${mobile.memoryWarnings} memory pressure warnings this session`);
  if (mobile.state.workerCrashCount > 0) risks.push(`${mobile.state.workerCrashCount} worker crash(es), backoff: ${mobile.state.backoffMs}ms`);

  const score = Math.max(0, deployment.score -
    (!mobile.isHardened ? 20 : 0) -
    (mobile.memoryWarnings * 5) -
    (mobile.state.workerCrashCount * 8),
  );

  return { id: "mobile_offline", score: Math.min(100, score), grade: score >= 70 ? "ready" : score >= 40 ? "degraded" : "critical", blockers, risks };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

let _lastReport: ProductionReadinessReport | null = null;

export function generateProductionReadinessReport(): ProductionReadinessReport {
  const weights: Record<SubsystemId, number> = {
    inference: 0.20,
    cognition: 0.20,
    wellness: 0.20,
    assistant: 0.15,
    safety: 0.15,
    mobile_offline: 0.10,
  };

  const subsystems: SubsystemReadiness[] = [
    scoreInference(),
    scoreCognition(),
    scoreWellness(),
    scoreAssistant(),
    scoreSafety(),
    scoreMobileOffline(),
  ];

  const overallScore = Math.round(
    subsystems.reduce((s, sub) => s + sub.score * weights[sub.id], 0)
  );

  const deploymentGrade: ProductionReadinessReport["deploymentGrade"] =
    overallScore >= 85 ? "production_ready" :
    overallScore >= 65 ? "staging_only" : "dev_only";

  const knownBlockers = subsystems.flatMap((s) => s.blockers);
  const deploymentRisks = subsystems.flatMap((s) => s.risks);

  const stubbedSystems: string[] = [
    "AiMentalCoach — still routes through Convex cloud action (aiMentalCoach), not local AI stack",
    "Embedding model — ONNX all-MiniLM-L6-v2 requires network for first load; auto-falls back to TF-IDF offline",
    "autoModelLifecycle — loadFromBlobUrl activation not yet called automatically; model must complete download first",
    "quantizationRouter — model not loaded unless download completes and autoModelLifecycle activates it",
  ];

  const remainingProductionBlockers: string[] = [
    ...knownBlockers,
    ...subsystems.filter((s) => s.grade === "critical").map((s) => `${s.id}: critical grade`),
    overallScore < 65 ? "Overall readiness score below staging threshold" : "",
  ].filter(Boolean);

  _lastReport = { overallScore, deploymentGrade, subsystems, knownBlockers, deploymentRisks, stubbedSystems, remainingProductionBlockers, generatedAt: Date.now() };
  return _lastReport;
}

export function getLastProductionReport(): ProductionReadinessReport | null {
  return _lastReport;
}

export function getProductionReadinessScore(): number {
  return _lastReport?.overallScore ?? 0;
}
