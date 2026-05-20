// Long-Session Stability Guard — protects cognition quality over multi-hour sessions.
//
// Problems addressed:
//   drift                  — coaching frame shifts significantly within one session
//   stale_memory           — T3/T4 memories not accessed in >2h dominate context
//   emotional_overfitting  — emotional model updated with too many similar signals
//   context_entropy        — context items are so varied the session has no coherence
//   continuity_break       — goal threads or emotional state are internally inconsistent
//
// Checks run on-demand (after every N inferences) and reported to AIDevPanel.
// Guards do NOT block inference — they emit warnings and adjust salience weights.

import { getActiveGoalThreads } from "./goalThreadTracker";
import { getEmotionalContinuityReport } from "./emotionalContinuityEngine";
import { getAssistantState } from "@/ai/assistant/assistantStateModel";
import { getOrchestratorReport } from "./cognitiveExecutionOrchestrator";
import { getContextBudgetReport } from "./contextPrioritizer";

// ── Types ──────────────────────────────────────────────────────────────────────

export type StabilityCheckId =
  | "coaching_frame_drift"
  | "stale_memory_dominance"
  | "emotional_overfitting"
  | "context_entropy"
  | "continuity_break";

export type StabilityViolation = {
  checkId: StabilityCheckId;
  severity: "warning" | "critical";
  description: string;
  mitigation: string;
};

export type SessionStabilityReport = {
  score: number;             // 0-100
  grade: "stable" | "degrading" | "unstable";
  violations: StabilityViolation[];
  sessionDurationMs: number;
  inferenceCount: number;
  checkedAt: number;
};

// ── Session tracking ───────────────────────────────────────────────────────────

const _sessionStartAt = Date.now();
let _lastFrames: string[] = [];          // coaching frame history (last 10 inferences)
let _emotionalUpdateCount = 0;           // how many emotional signals this session
let _lastEmotionalUpdateAt = 0;
let _lastReport: SessionStabilityReport | null = null;

export function recordCoachingFrame(frame: string): void {
  _lastFrames.push(frame);
  if (_lastFrames.length > 20) _lastFrames.shift();
}

export function recordEmotionalSignalReceived(): void {
  _emotionalUpdateCount++;
  _lastEmotionalUpdateAt = Date.now();
}

// ── Check implementations ─────────────────────────────────────────────────────

function checkCoachingFrameDrift(): StabilityViolation | null {
  if (_lastFrames.length < 5) return null;

  const recent = _lastFrames.slice(-10);
  const uniqueFrames = new Set(recent).size;
  const driftRatio = uniqueFrames / recent.length;

  if (driftRatio > 0.7) {
    return {
      checkId: "coaching_frame_drift",
      severity: "warning",
      description: `Coaching frame changed ${uniqueFrames} times in last ${recent.length} inferences (${(driftRatio * 100).toFixed(0)}% drift).`,
      mitigation: "Run assistantStateModel.syncAssistantState() and hold the frame for at least 3 consecutive inferences.",
    };
  }

  return null;
}

function checkStaleDominance(): StabilityViolation | null {
  const ctx = getContextBudgetReport();
  if (!ctx.lastAssembled) return null;

  const total = ctx.itemsIncluded;
  if (total === 0) return null;

  const now = Date.now();
  const staleThreshold = 2 * 60 * 60 * 1000;  // 2h
  const staleItems = ctx.topItems.filter((item) => {
    // Approximate staleness: episodic/semantic items with low scores are likely stale
    return item.kind === "episodic_memory" && item.score < 0.25;
  });

  if (staleItems.length >= 3) {
    return {
      checkId: "stale_memory_dominance",
      severity: "warning",
      description: `${staleItems.length} stale low-salience episodic memories are appearing in context.`,
      mitigation: "Raise contextPrioritizer minSalience threshold or call applyUserModelDecay() to re-weight stale items.",
    };
  }

  return null;
}

function checkEmotionalOverfitting(): StabilityViolation | null {
  const sessionDurationMs = Date.now() - _sessionStartAt;
  const sessionHours = sessionDurationMs / (60 * 60 * 1000);

  if (sessionHours < 0.5) return null;  // too early to check

  const emotional = getEmotionalContinuityReport();
  const avgEvidenceCount = Object.values(emotional.profile.dimensions)
    .reduce((s, d) => s + d.evidenceCount, 0) / 5;

  // Too many updates per hour suggests the model is being driven by noise
  const updatesPerHour = _emotionalUpdateCount / Math.max(0.1, sessionHours);

  if (updatesPerHour > 20 && avgEvidenceCount > 30) {
    return {
      checkId: "emotional_overfitting",
      severity: "warning",
      description: `Emotional model received ${updatesPerHour.toFixed(0)} updates/hr this session. Risk of noise-driven overfitting.`,
      mitigation: "Increase EMA_ALPHA damping in emotionalContinuityEngine or add minimum inter-update interval.",
    };
  }

  return null;
}

function checkContextEntropy(): StabilityViolation | null {
  const ctx = getContextBudgetReport();
  if (!ctx.lastAssembled || ctx.itemsIncluded < 4) return null;

  // High entropy = many different kinds of items, no dominant theme
  const kindCounts = new Map<string, number>();
  for (const item of ctx.topItems) {
    kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
  }

  const totalItems = ctx.itemsIncluded;
  const kinds = kindCounts.size;
  const entropyRatio = kinds / Math.max(1, totalItems);

  if (entropyRatio > 0.75 && totalItems > 6) {
    return {
      checkId: "context_entropy",
      severity: "warning",
      description: `Context has ${kinds} different item types across ${totalItems} items. Session may lack thematic coherence.`,
      mitigation: "Increase salience threshold to favor high-confidence items; reduce memory retrieval breadth.",
    };
  }

  return null;
}

function checkContinuityBreak(): StabilityViolation | null {
  const goals = getActiveGoalThreads();
  const emotional = getEmotionalContinuityReport();
  const assistantState = getAssistantState();

  // Contradiction: goals say high progress but emotional motivation is very low
  const highProgressGoals = goals.filter((g) => g.progress > 0.7).length;
  const motivationLow = emotional.profile.dimensions.motivation.value < 0.25;

  if (highProgressGoals > 0 && motivationLow) {
    return {
      checkId: "continuity_break",
      severity: "warning",
      description: "Goal threads show high progress but motivation is very low — possible data inconsistency or sudden drop.",
      mitigation: "Validate that goal evidence is current. If motivation drop is real, switch to recovery coaching frame immediately.",
    };
  }

  // Contradiction: interventionCooldown off but burnout sensitivity very high
  const highBurnout = assistantState.burnoutSensitivity > 0.8;
  if (highBurnout && !assistantState.interventionCooldown) {
    return {
      checkId: "continuity_break",
      severity: "critical",
      description: "Burnout sensitivity is very high but intervention cooldown is not active. Proactive delivery risk.",
      mitigation: "Call markInterventionDelivered() to activate cooldown, or manually set interventionCooldown in assistantStateModel.",
    };
  }

  return null;
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function runLongSessionCheck(): SessionStabilityReport {
  const orchestratorReport = getOrchestratorReport();
  const sessionDurationMs = Date.now() - _sessionStartAt;

  const checks = [
    checkCoachingFrameDrift(),
    checkStaleDominance(),
    checkEmotionalOverfitting(),
    checkContextEntropy(),
    checkContinuityBreak(),
  ];

  const violations = checks.filter((c): c is StabilityViolation => c !== null);
  let score = 100;
  for (const v of violations) {
    score -= v.severity === "critical" ? 30 : 15;
  }
  score = Math.max(0, score);

  const grade: SessionStabilityReport["grade"] =
    score >= 80 ? "stable" : score >= 50 ? "degrading" : "unstable";

  _lastReport = {
    score,
    grade,
    violations,
    sessionDurationMs,
    inferenceCount: orchestratorReport.totalExecutions,
    checkedAt: Date.now(),
  };

  return _lastReport;
}

export function getLastSessionStabilityReport(): SessionStabilityReport | null {
  return _lastReport;
}

export function getSessionDurationMs(): number {
  return Date.now() - _sessionStartAt;
}
