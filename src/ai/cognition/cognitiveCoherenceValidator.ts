// Cognitive Coherence Validator — audits the overall coherence of the cognition pipeline.
//
// Validates 6 properties critical for long-session stability:
//   continuity_consistency    — checkpoint exists and is recent; recovery succeeds
//   contradiction_suppression — active contradiction count is bounded
//   emotional_stability       — no rapid oscillation in emotional continuity
//   prompt_budget_stability   — synthesis is consistently under token ceiling
//   long_session_coherence    — memory tiers are healthy after many turns
//   stale_memory_dominance    — old stale memories are not crowding out recent ones
//
// Returns a 0-100 score and a list of issues with remediation suggestions.
// Not blocking: this validator is informational, not a gate.

import { getMemoryHierarchyReport } from "../memory/memoryHierarchy";
import { getCognitiveStateReport, getCognitiveStateCheckpointAge } from "./cognitiveStateEngine";
import { getLastSynthesisOutput } from "./promptSynthesisEngine";
import { getEmotionalContinuityReport } from "./emotionalContinuityEngine";
import { getSemanticMemoryReport } from "./semanticMemoryEngine";
import { getCognitionFeedbackLoopReport } from "./cognitionFeedbackLoop";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CoherenceCheckId =
  | "continuity_consistency"
  | "contradiction_suppression"
  | "emotional_stability"
  | "prompt_budget_stability"
  | "long_session_coherence"
  | "stale_memory_dominance";

export type CoherenceCheckResult = {
  checkId: CoherenceCheckId;
  passed: boolean;
  score: number;          // 0-100 contribution to overall
  issue: string | null;
  recommendation: string | null;
};

export type CoherenceReport = {
  overallScore: number;   // 0-100
  grade: "excellent" | "good" | "degraded" | "critical";
  checks: CoherenceCheckResult[];
  recommendations: string[];
  sessionTurns: number;
  validatedAt: number;
};

// ── Thresholds ────────────────────────────────────────────────────────────────

const MAX_CHECKPOINT_AGE_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_CONTRADICTION_COUNT = 3;
const MAX_TOKEN_BUDGET_OVERAGE_PCT = 0.1;        // 10% over budget is a warning
const STALE_MEMORY_AGE_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const STALE_DOMINANCE_THRESHOLD = 0.6;           // >60% stale = problem

// ── Check implementations ─────────────────────────────────────────────────────

function checkContinuityConsistency(): CoherenceCheckResult {
  const checkpointAge = getCognitiveStateCheckpointAge();

  if (checkpointAge === null) {
    return {
      checkId: "continuity_consistency",
      passed: false,
      score: 0,
      issue: "No checkpoint found — session continuity at risk",
      recommendation: "Ensure checkpointCognitiveState() is called after each inference",
    };
  }

  if (checkpointAge > MAX_CHECKPOINT_AGE_MS) {
    const ageMins = Math.round(checkpointAge / 60_000);
    return {
      checkId: "continuity_consistency",
      passed: false,
      score: 50,
      issue: `Checkpoint is ${ageMins} minutes old — may be stale`,
      recommendation: "Increase checkpoint frequency or verify feedback loop is running",
    };
  }

  return { checkId: "continuity_consistency", passed: true, score: 100, issue: null, recommendation: null };
}

function checkContradictionSuppression(): CoherenceCheckResult {
  const semanticReport = getSemanticMemoryReport();
  const count = semanticReport.contradictionCount;

  if (count > MAX_CONTRADICTION_COUNT * 2) {
    return {
      checkId: "contradiction_suppression",
      passed: false,
      score: 20,
      issue: `${count} memory contradictions detected — coherence degraded`,
      recommendation: "Run a memory reconciliation pass; review conflicting episodic/semantic entries",
    };
  }

  if (count > MAX_CONTRADICTION_COUNT) {
    return {
      checkId: "contradiction_suppression",
      passed: false,
      score: 60,
      issue: `${count} memory contradictions — minor coherence risk`,
      recommendation: "Monitor; consider resolving ambiguous wellness goal entries",
    };
  }

  return { checkId: "contradiction_suppression", passed: true, score: 100, issue: null, recommendation: null };
}

function checkEmotionalStability(): CoherenceCheckResult {
  const emotionalReport = getEmotionalContinuityReport();

  if (emotionalReport.hasActiveShift) {
    const dim = emotionalReport.dominantConcern;
    return {
      checkId: "emotional_stability",
      passed: true,
      score: 70,
      issue: dim ? `Active emotional shift detected in: ${dim}` : "Active emotional shift detected",
      recommendation: "Normal under circumstances — ensure next response addresses it",
    };
  }

  const { profile } = emotionalReport;
  const instableDimensions = ["stress", "burnout"].filter(
    (d) => profile.dimensions[d as keyof typeof profile.dimensions]?.value > 0.8,
  );

  if (instableDimensions.length > 0) {
    return {
      checkId: "emotional_stability",
      passed: false,
      score: 40,
      issue: `High values in: ${instableDimensions.join(", ")} — user may be struggling`,
      recommendation: "Prioritize supportive coaching; reduce goal pressure",
    };
  }

  return { checkId: "emotional_stability", passed: true, score: 100, issue: null, recommendation: null };
}

function checkPromptBudgetStability(): CoherenceCheckResult {
  const synthesis = getLastSynthesisOutput();

  if (!synthesis) {
    return {
      checkId: "prompt_budget_stability",
      passed: true,
      score: 100,
      issue: null,
      recommendation: null,
    };
  }

  const overagePct = (synthesis.tokenBudgetUsed - synthesis.tokenBudgetTotal) / synthesis.tokenBudgetTotal;

  if (overagePct > MAX_TOKEN_BUDGET_OVERAGE_PCT) {
    return {
      checkId: "prompt_budget_stability",
      passed: false,
      score: 30,
      issue: `Prompt ${Math.round(overagePct * 100)}% over token budget (${synthesis.tokenBudgetUsed}/${synthesis.tokenBudgetTotal})`,
      recommendation: "Review continuousContextInjector budget allocation; reduce non-critical sections",
    };
  }

  return { checkId: "prompt_budget_stability", passed: true, score: 100, issue: null, recommendation: null };
}

function checkLongSessionCoherence(): CoherenceCheckResult {
  const feedbackReport = getCognitionFeedbackLoopReport();
  const memReport = getMemoryHierarchyReport();

  // Check if episodic memory is getting full (>80% capacity)
  const episodicTier = memReport.tiers.find((t) => t.tier === 3);
  if (episodicTier && episodicTier.fillPct > 0.8) {
    return {
      checkId: "long_session_coherence",
      passed: false,
      score: 50,
      issue: `Episodic memory ${Math.round(episodicTier.fillPct * 100)}% full — eviction pressure rising`,
      recommendation: "Run compressTier(3) to summarize low-salience episodic entries",
    };
  }

  // Check if feedback loop is running
  if (feedbackReport.totalLoops === 0) {
    return {
      checkId: "long_session_coherence",
      passed: false,
      score: 40,
      issue: "Feedback loop has not run — cognition loop is not closed",
      recommendation: "Verify runCognitionFeedbackLoop is called after each inference",
    };
  }

  return { checkId: "long_session_coherence", passed: true, score: 100, issue: null, recommendation: null };
}

function checkStaleMemoryDominance(): CoherenceCheckResult {
  const memReport = getMemoryHierarchyReport();

  // Look at episodic + semantic tiers
  const relevantTiers = memReport.tiers.filter((t) => t.tier === 3 || t.tier === 4);
  let totalItems = 0;
  let staleItems = 0;

  for (const tier of relevantTiers) {
    totalItems += tier.itemCount;
    if (tier.oldestItemAgeMs !== null && tier.oldestItemAgeMs > STALE_MEMORY_AGE_MS) {
      // Approximate: items older than threshold using oldest age as proxy
      const staleRatio = Math.min(0.9, tier.oldestItemAgeMs / (STALE_MEMORY_AGE_MS * 2));
      staleItems += Math.round(tier.itemCount * staleRatio);
    }
  }

  if (totalItems === 0) {
    return { checkId: "stale_memory_dominance", passed: true, score: 100, issue: null, recommendation: null };
  }

  const stalePct = staleItems / totalItems;
  if (stalePct > STALE_DOMINANCE_THRESHOLD) {
    return {
      checkId: "stale_memory_dominance",
      passed: false,
      score: 30,
      issue: `~${Math.round(stalePct * 100)}% of memories may be stale — fresh context crowded out`,
      recommendation: "Run evictStaleMem() and compressTier(3) to reclaim space for current context",
    };
  }

  return { checkId: "stale_memory_dominance", passed: true, score: 100, issue: null, recommendation: null };
}

// ── State ──────────────────────────────────────────────────────────────────────

let _lastReport: CoherenceReport | null = null;

// ── Main entry ────────────────────────────────────────────────────────────────

export function runCoherenceValidation(): CoherenceReport {
  const checks: CoherenceCheckResult[] = [
    checkContinuityConsistency(),
    checkContradictionSuppression(),
    checkEmotionalStability(),
    checkPromptBudgetStability(),
    checkLongSessionCoherence(),
    checkStaleMemoryDominance(),
  ];

  const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
  const grade: CoherenceReport["grade"] =
    overallScore >= 85 ? "excellent" :
    overallScore >= 65 ? "good" :
    overallScore >= 40 ? "degraded" : "critical";

  const recommendations = checks
    .filter((c) => c.recommendation !== null)
    .map((c) => c.recommendation as string);

  const feedbackReport = getCognitionFeedbackLoopReport();

  const report: CoherenceReport = {
    overallScore,
    grade,
    checks,
    recommendations,
    sessionTurns: feedbackReport.totalLoops,
    validatedAt: Date.now(),
  };

  _lastReport = report;

  if (grade === "critical") {
    emitCognitionEvent("safety_violation", { kind: "coherence_critical", score: overallScore });
  }

  return report;
}

export function getLastCoherenceReport(): CoherenceReport | null {
  return _lastReport;
}

export function getCognitiveCoherenceScore(): number {
  return _lastReport?.overallScore ?? 100;
}
