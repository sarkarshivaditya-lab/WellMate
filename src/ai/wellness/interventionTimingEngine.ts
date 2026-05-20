// Intervention Timing Engine — determines WHEN the AI should intervene.
//
// Goal: reduce cognitive burden, NOT increase it.
//
// An intervention is any proactive AI communication (insight, suggestion, reflection).
// This engine determines whether to proceed, defer, or suppress.
//
// Factors considered:
//   - Recent engagement (is the user actively using the app?)
//   - Emotional load (stress + burnout → suppress)
//   - Sleep quality (cognitive readiness proxy)
//   - Burnout risk (critical threshold → always suppress)
//   - Notification fatigue (recent interventions)
//   - Disengagement risk (urgency signal)
//   - Recovery windows (positive timing)
//
// Outputs:
//   - timing score: 0-1 (higher = better time to intervene)
//   - decision: "proceed" | "defer" | "suppress"
//   - urgency: "immediate" | "today" | "this_week" | "low"
//   - reason

import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { computeSleepRecoveryReadiness } from "@/intelligence/sleepIntelligence";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";
import { getRetentionMetrics } from "@/analytics/retentionEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type InterventionDecision = "proceed" | "defer" | "suppress";
export type InterventionUrgency = "immediate" | "today" | "this_week" | "low";

export type TimingEvaluation = {
  timingScore: number;           // 0-1 (higher = better to intervene)
  decision: InterventionDecision;
  urgency: InterventionUrgency;
  reason: string;
  deferrableUntil: number | null; // ms timestamp; null if not deferrable
  evaluatedAt: number;
};

export type TimingEngineReport = {
  lastEvaluation: TimingEvaluation | null;
  suppressionCount: number;      // interventions suppressed this session
  deferralCount: number;
  proceedCount: number;
  averageTimingScore: number;
};

// ── Intervention history (session-scoped) ──────────────────────────────────────

const STORAGE_KEY = "ai_intervention_timing_v1";

type TimingHistory = {
  lastInterventionAt: number | null;
  interventionsToday: number;
  suppressionCount: number;
  deferralCount: number;
  proceedCount: number;
  totalTimingScore: number;
  totalEvaluations: number;
};

const MAX_INTERVENTIONS_PER_DAY = 2;
const MIN_INTERVAL_BETWEEN_MS = 4 * 60 * 60 * 1000;  // 4 hours

function loadHistory(): TimingHistory {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as TimingHistory | null;
    if (stored) {
      // Reset daily count if it's a new day
      const lastDate = stored.lastInterventionAt ? new Date(stored.lastInterventionAt).toDateString() : null;
      const today = new Date().toDateString();
      if (lastDate !== today) return { ...stored, interventionsToday: 0 };
      return stored;
    }
  } catch { /* ok */ }
  return {
    lastInterventionAt: null, interventionsToday: 0,
    suppressionCount: 0, deferralCount: 0, proceedCount: 0,
    totalTimingScore: 0, totalEvaluations: 0,
  };
}

function saveHistory(h: TimingHistory): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { /* ok */ }
}

// ── Scoring functions ──────────────────────────────────────────────────────────

function scoreEmotionalLoad(emotional: ReturnType<typeof getEmotionalProfile>): number {
  // Returns 0 when load is high (bad time), 1 when load is low (good time)
  const burnout = emotional.dimensions.burnout.value;
  const stress = emotional.dimensions.stress.value;
  const combined = burnout * 0.6 + stress * 0.4;
  return Math.max(0, 1 - combined);
}

function scoreCognitiveReadiness(): number {
  try {
    const readiness = computeSleepRecoveryReadiness();
    return readiness.score / 100;
  } catch {
    return 0.5;  // unknown: neutral
  }
}

function scoreUserEngagement(retention: ReturnType<typeof getRetentionMetrics>): number {
  // Good engagement window: active today, not dormant
  const activeToday = (retention.entityConsistency?.habit ?? 0) > 0 ||
    (retention.entityConsistency?.mood ?? 0) > 0;
  if (activeToday) return 0.8;
  const recentActive = retention.activeDaysThisWeek > 0;
  return recentActive ? 0.5 : 0.2;
}

function scoreNotificationFatigue(history: TimingHistory): number {
  if (history.interventionsToday >= MAX_INTERVENTIONS_PER_DAY) return 0;
  const timeSinceLast = history.lastInterventionAt
    ? Date.now() - history.lastInterventionAt
    : Infinity;
  if (timeSinceLast < MIN_INTERVAL_BETWEEN_MS) {
    return timeSinceLast / MIN_INTERVAL_BETWEEN_MS;
  }
  return 1;
}

// ── Decision logic ────────────────────────────────────────────────────────────

function makeDecision(
  timingScore: number,
  history: TimingHistory,
  urgency: InterventionUrgency,
  emotional: ReturnType<typeof getEmotionalProfile>,
): { decision: InterventionDecision; reason: string; deferrableUntil: number | null } {
  const burnout = emotional.dimensions.burnout.value;

  // Always suppress if burnout is critical
  if (burnout > 0.8) {
    return { decision: "suppress", reason: "Burnout critical — suppressing to avoid adding burden", deferrableUntil: null };
  }

  // Always suppress if daily cap reached
  if (history.interventionsToday >= MAX_INTERVENTIONS_PER_DAY) {
    return { decision: "suppress", reason: `Daily intervention cap (${MAX_INTERVENTIONS_PER_DAY}) reached`, deferrableUntil: null };
  }

  // Suppress if timing score is too low and urgency is not high
  if (timingScore < 0.25 && urgency !== "immediate") {
    const deferMs = MIN_INTERVAL_BETWEEN_MS;
    return {
      decision: "defer",
      reason: "Timing conditions unfavorable — defer for better window",
      deferrableUntil: Date.now() + deferMs,
    };
  }

  if (timingScore < 0.4 && urgency === "low") {
    return { decision: "suppress", reason: "Low timing score + low urgency — not the right moment", deferrableUntil: null };
  }

  return { decision: "proceed", reason: "Timing conditions acceptable", deferrableUntil: null };
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function evaluateInterventionTiming(
  urgency: InterventionUrgency = "today",
): TimingEvaluation {
  const emotional = getEmotionalProfile();
  const retention = getRetentionMetrics();
  const history = loadHistory();
  const ctx = buildRecommendationContext(null);

  const emotionalScore = scoreEmotionalLoad(emotional);
  const cognitiveScore = scoreCognitiveReadiness();
  const engagementScore = scoreUserEngagement(retention);
  const fatigueScore = scoreNotificationFatigue(history);

  // Weighted composite (cognitive readiness weighted most)
  const timingScore = Math.min(1,
    emotionalScore * 0.35 +
    cognitiveScore * 0.25 +
    engagementScore * 0.2 +
    fatigueScore * 0.2,
  );

  const { decision, reason, deferrableUntil } = makeDecision(timingScore, history, urgency, emotional);

  // Update history
  const newHistory: TimingHistory = {
    ...history,
    totalTimingScore: history.totalTimingScore + timingScore,
    totalEvaluations: history.totalEvaluations + 1,
    suppressionCount: history.suppressionCount + (decision === "suppress" ? 1 : 0),
    deferralCount: history.deferralCount + (decision === "defer" ? 1 : 0),
    proceedCount: history.proceedCount + (decision === "proceed" ? 1 : 0),
  };
  if (decision === "proceed") {
    newHistory.lastInterventionAt = Date.now();
    newHistory.interventionsToday = history.interventionsToday + 1;
  }
  saveHistory(newHistory);

  return {
    timingScore,
    decision,
    urgency,
    reason,
    deferrableUntil,
    evaluatedAt: Date.now(),
  };
}

export function recordInterventionDelivered(): void {
  const history = loadHistory();
  history.lastInterventionAt = Date.now();
  history.interventionsToday = (history.interventionsToday ?? 0) + 1;
  saveHistory(history);
}

export function getTimingEngineReport(): TimingEngineReport {
  const history = loadHistory();
  return {
    lastEvaluation: null,
    suppressionCount: history.suppressionCount,
    deferralCount: history.deferralCount,
    proceedCount: history.proceedCount,
    averageTimingScore: history.totalEvaluations > 0
      ? history.totalTimingScore / history.totalEvaluations
      : 0,
  };
}
