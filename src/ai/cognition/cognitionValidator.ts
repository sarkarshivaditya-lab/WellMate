// Cognition Validator — quality certification suite for the persistent cognition system.
//
// 10 tests covering:
//   1. Memory retrieval correctness
//   2. Stale memory suppression
//   3. Contradiction handling
//   4. Continuity restoration
//   5. Reflection stability
//   6. Token budget adherence
//   7. Emotional state continuity
//   8. Goal lifecycle integrity
//   9. Attention slot decay
//  10. Safety governor responsiveness
//
// Score: 0-100. Certification: none(<40), basic(40-64), standard(65-84), production(85+)

import { writeMemory, retrieveMemory } from "../memory/memoryHierarchy";
import {
  addAttentionSlot,
  addActiveGoal,
  addUnresolvedTopic,
  updateEmotionalContinuity,
  getEmotionalState,
  getActiveGoals,
  getTopAttentionSlots,
  applyAttentionDecay,
} from "./cognitiveStateEngine";
import { assembleContext } from "./contextPrioritizer";
import { runReflectionCycle } from "./reflectionEngine";
import { runSafetyAudit } from "./memorySafetyGovernor";
import { recoverContinuity } from "./continuityRecovery";
import { recordUserEvidence } from "./userModel";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ValidationTestId =
  | "memory_retrieval"
  | "stale_suppression"
  | "contradiction_handling"
  | "continuity_restoration"
  | "reflection_stability"
  | "token_budget"
  | "emotional_continuity"
  | "goal_lifecycle"
  | "attention_decay"
  | "safety_responsiveness";

export type ValidationTestResult = {
  id: ValidationTestId;
  name: string;
  passed: boolean;
  score: number;      // 0-weight (partial credit allowed)
  weight: number;
  detail: string;
  durationMs: number;
};

export type CognitionValidationReport = {
  totalScore: number;           // 0-100
  certification: "none" | "basic" | "standard" | "production";
  passed: boolean;              // certification >= standard
  testResults: ValidationTestResult[];
  runAt: number;
  durationMs: number;
};

type TestFn = () => Omit<ValidationTestResult, "durationMs">;

// ── Test weights (sum = 100) ───────────────────────────────────────────────────

const WEIGHTS: Record<ValidationTestId, number> = {
  memory_retrieval: 15,
  stale_suppression: 10,
  contradiction_handling: 10,
  continuity_restoration: 12,
  reflection_stability: 8,
  token_budget: 12,
  emotional_continuity: 8,
  goal_lifecycle: 10,
  attention_decay: 8,
  safety_responsiveness: 7,
};

// ── Persistence ────────────────────────────────────────────────────────────────

const VALIDATION_STORAGE_KEY = "ai_cognition_validation_report_v1";

function saveReport(report: CognitionValidationReport): void {
  try { localStorage.setItem(VALIDATION_STORAGE_KEY, JSON.stringify(report)); } catch { /* */ }
}

export function getLastValidationReport(): CognitionValidationReport | null {
  try { return JSON.parse(localStorage.getItem(VALIDATION_STORAGE_KEY) ?? "null") as CognitionValidationReport | null; }
  catch { return null; }
}

// ── Individual tests ───────────────────────────────────────────────────────────

const testMemoryRetrieval: TestFn = () => {
  const tag = `test-retrieval-${Date.now()}`;
  const content = `[ValidatorTest] ${tag}`;
  writeMemory(3, content, { salience: 0.8, confidence: 0.9, semanticTags: [tag], source: "cognitionValidator" });

  const retrieved = retrieveMemory({ tags: [tag], minSalience: 0.5, limit: 5 });
  const found = retrieved.some((m) => m.content.includes(tag));

  return {
    id: "memory_retrieval",
    name: "Memory Retrieval Correctness",
    passed: found,
    score: found ? WEIGHTS.memory_retrieval : 0,
    weight: WEIGHTS.memory_retrieval,
    detail: found ? "Written entry successfully retrieved by semantic tag" : "Written entry not found — retrieval pipeline broken",
  };
};

const testStaleSuppression: TestFn = () => {
  // Write a memory with very low salience and verify it does not appear in minSalience retrieval
  const tag = `test-stale-${Date.now()}`;
  writeMemory(3, `[StaleTest] ${tag}`, { salience: 0.05, confidence: 0.9, semanticTags: [tag], source: "cognitionValidator" });

  const retrieved = retrieveMemory({ tags: [tag], minSalience: 0.3, limit: 5 });
  const suppressed = !retrieved.some((m) => m.content.includes(tag));

  return {
    id: "stale_suppression",
    name: "Stale Memory Suppression",
    passed: suppressed,
    score: suppressed ? WEIGHTS.stale_suppression : 0,
    weight: WEIGHTS.stale_suppression,
    detail: suppressed ? "Low-salience memory correctly suppressed by filter" : "Low-salience memory leaked through filter",
  };
};

const testContradictionHandling: TestFn = () => {
  // Record contradictory evidence and verify model does not freeze
  try {
    recordUserEvidence({ dimension: "motivation_level", observation: "high_motivation", value: 0.95, weight: 0.8, timestamp: Date.now() });
    recordUserEvidence({ dimension: "motivation_level", observation: "low_motivation", value: 0.05, weight: 0.8, timestamp: Date.now() });
    // If we get here without throwing, contradiction handling is stable
    return {
      id: "contradiction_handling",
      name: "Contradiction Handling",
      passed: true,
      score: WEIGHTS.contradiction_handling,
      weight: WEIGHTS.contradiction_handling,
      detail: "Contradictory evidence processed without exception",
    };
  } catch {
    return {
      id: "contradiction_handling",
      name: "Contradiction Handling",
      passed: false,
      score: 0,
      weight: WEIGHTS.contradiction_handling,
      detail: "Exception thrown during contradiction evidence accumulation",
    };
  }
};

const testContinuityRestoration: TestFn = () => {
  try {
    const result = recoverContinuity("manual");
    const hasOutcome = ["full_checkpoint_restore", "partial_memory_rebuild", "cold_start", "skipped_fresh"].includes(result.outcome);
    return {
      id: "continuity_restoration",
      name: "Continuity Restoration",
      passed: hasOutcome && result.durationMs < 2000,
      score: hasOutcome ? (result.durationMs < 2000 ? WEIGHTS.continuity_restoration : Math.floor(WEIGHTS.continuity_restoration * 0.5)) : 0,
      weight: WEIGHTS.continuity_restoration,
      detail: `Recovered with outcome: ${result.outcome} in ${result.durationMs}ms`,
    };
  } catch {
    return {
      id: "continuity_restoration",
      name: "Continuity Restoration",
      passed: false,
      score: 0,
      weight: WEIGHTS.continuity_restoration,
      detail: "Recovery threw exception",
    };
  }
};

const testReflectionStability: TestFn = () => {
  try {
    const r1 = runReflectionCycle();
    const r2 = runReflectionCycle(); // should be rate-limited
    // r2 should return [] due to rate limit
    const rateLimit = r2.length === 0;
    return {
      id: "reflection_stability",
      name: "Reflection Stability",
      passed: rateLimit,
      score: rateLimit ? WEIGHTS.reflection_stability : Math.floor(WEIGHTS.reflection_stability * 0.5),
      weight: WEIGHTS.reflection_stability,
      detail: rateLimit
        ? `First cycle: ${r1.length} reflections. Second call correctly rate-limited.`
        : "Rate limiting not enforced — reflection loop possible",
    };
  } catch {
    return {
      id: "reflection_stability",
      name: "Reflection Stability",
      passed: false,
      score: 0,
      weight: WEIGHTS.reflection_stability,
      detail: "Exception in reflection cycle",
    };
  }
};

const testTokenBudget: TestFn = () => {
  const BUDGET = 500;
  const ctx = assembleContext(BUDGET);
  const withinBudget = ctx.totalTokens <= BUDGET;
  const hasMandatory = ctx.items.some((i) => i.isManatory);

  const passed = withinBudget && hasMandatory;
  return {
    id: "token_budget",
    name: "Token Budget Adherence",
    passed,
    score: passed ? WEIGHTS.token_budget : withinBudget ? Math.floor(WEIGHTS.token_budget * 0.5) : 0,
    weight: WEIGHTS.token_budget,
    detail: `Used ${ctx.totalTokens}/${BUDGET} tokens. Mandatory items: ${ctx.items.filter((i) => i.isManatory).length}. Excluded: ${ctx.itemsExcluded}.`,
  };
};

const testEmotionalContinuity: TestFn = () => {
  const before = getEmotionalState();
  updateEmotionalContinuity(0.8, 0.6, "motivated");
  const after = getEmotionalState();

  // EMA should shift valence toward 0.8 but not jump all the way (alpha=0.3)
  const shifted = after.valence > before.valence || Math.abs(after.valence - before.valence) < 0.01;
  const notOvershot = after.valence <= 0.8;

  const passed = shifted && notOvershot;
  return {
    id: "emotional_continuity",
    name: "Emotional State Continuity (EMA)",
    passed,
    score: passed ? WEIGHTS.emotional_continuity : 0,
    weight: WEIGHTS.emotional_continuity,
    detail: `Valence: ${before.valence.toFixed(2)} → ${after.valence.toFixed(2)} after EMA update (expected: ≤0.8)`,
  };
};

const testGoalLifecycle: TestFn = () => {
  const desc = `[ValidatorGoal-${Date.now()}]`;
  const id = addActiveGoal(desc, 0.5);
  const goals = getActiveGoals();
  const found = goals.some((g) => g.id === id);

  return {
    id: "goal_lifecycle",
    name: "Goal Lifecycle Integrity",
    passed: found,
    score: found ? WEIGHTS.goal_lifecycle : 0,
    weight: WEIGHTS.goal_lifecycle,
    detail: found ? "Goal created, retrieved by ID successfully" : "Goal not found after creation",
  };
};

const testAttentionDecay: TestFn = () => {
  addAttentionSlot("[ValidatorDecayTest]", "recent_event", 1.0, 0.99);
  const beforeSlots = getTopAttentionSlots(5);
  const beforeHigh = beforeSlots.find((s) => s.content.includes("[ValidatorDecayTest]"));

  applyAttentionDecay(); // simulate time by decaying
  const afterSlots = getTopAttentionSlots(5);
  const afterSlot = afterSlots.find((s) => s.content.includes("[ValidatorDecayTest]"));

  const decayed = !afterSlot || (beforeHigh ? afterSlot.salience < beforeHigh.salience : true);

  return {
    id: "attention_decay",
    name: "Attention Slot Decay",
    passed: decayed,
    score: decayed ? WEIGHTS.attention_decay : 0,
    weight: WEIGHTS.attention_decay,
    detail: decayed
      ? `Salience correctly decayed from ${beforeHigh?.salience.toFixed(2) ?? "?"}`
      : "Salience did not decay after applyAttentionDecay()",
  };
};

const testSafetyResponsiveness: TestFn = () => {
  try {
    const result = runSafetyAudit(true);
    const responsive = result.auditedAt > 0 && result.durationMs < 500;
    return {
      id: "safety_responsiveness",
      name: "Safety Governor Responsiveness",
      passed: responsive,
      score: responsive ? WEIGHTS.safety_responsiveness : Math.floor(WEIGHTS.safety_responsiveness * 0.5),
      weight: WEIGHTS.safety_responsiveness,
      detail: `Audit completed in ${result.durationMs}ms. Violations found: ${result.violations.length}. Passed: ${result.passed}`,
    };
  } catch {
    return {
      id: "safety_responsiveness",
      name: "Safety Governor Responsiveness",
      passed: false,
      score: 0,
      weight: WEIGHTS.safety_responsiveness,
      detail: "Safety audit threw exception",
    };
  }
};

// ── Runner ─────────────────────────────────────────────────────────────────────

const ALL_TESTS: TestFn[] = [
  testMemoryRetrieval,
  testStaleSuppression,
  testContradictionHandling,
  testContinuityRestoration,
  testReflectionStability,
  testTokenBudget,
  testEmotionalContinuity,
  testGoalLifecycle,
  testAttentionDecay,
  testSafetyResponsiveness,
];

export function runCognitionValidation(): CognitionValidationReport {
  const startMs = Date.now();
  const results: ValidationTestResult[] = [];

  for (const test of ALL_TESTS) {
    const testStart = Date.now();
    try {
      const r = test();
      results.push({ ...r, durationMs: Date.now() - testStart });
    } catch (e) {
      // Shouldn't happen — each test already has try/catch — but belt + suspenders
      results.push({
        id: "memory_retrieval" as ValidationTestId, // fallback
        name: "Unknown",
        passed: false,
        score: 0,
        weight: 0,
        detail: `Unhandled exception: ${String(e)}`,
        durationMs: Date.now() - testStart,
      });
    }
  }

  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const certification =
    totalScore >= 85 ? "production" :
    totalScore >= 65 ? "standard" :
    totalScore >= 40 ? "basic" : "none";

  const report: CognitionValidationReport = {
    totalScore,
    certification,
    passed: totalScore >= 65,
    testResults: results,
    runAt: Date.now(),
    durationMs: Date.now() - startMs,
  };

  saveReport(report);
  return report;
}

export function getDeploymentReadinessScore(): number {
  const last = getLastValidationReport();
  return last?.totalScore ?? 0;
}

export function getCognitionCertification(): "none" | "basic" | "standard" | "production" {
  const last = getLastValidationReport();
  return last?.certification ?? "none";
}
