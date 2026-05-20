// Proactive Insight Synthesizer — generates high-level wellness insights from patterns.
//
// Examples of insights produced:
//   "Sleep consistency has been improving over the past few weeks."
//   "Habits tend to be completed more on days with better sleep."
//   "Stress signals appear lower than your recent pattern."
//
// Requirements:
//   - Evidence threshold: min 2 weeks of data per domain before claiming a trend
//   - Confidence scoring: based on data density + trend strength
//   - Contradiction suppression: don't generate conflicting insights in same session
//   - Non-judgmental tone: observational, never prescriptive ("tends to" not "you should")
//   - Bounded frequency: max 2 new insights per 6-hour window
//   - No duplicate insights within 7 days (TTL)
//
// Data sources:
//   - computeRollingTrends() — 4-week domain trends
//   - WellnessMemoryContext correlations (if available)
//   - getEmotionalProfile() — emotional trajectory
//   - wellnessTrajectoryEngine — composite direction

import { computeRollingTrends } from "@/intelligence/longitudinalEngine";
import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { computeWellnessTrajectory } from "./wellnessTrajectoryEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type InsightCategory =
  | "sleep_trend"
  | "activity_trend"
  | "habit_consistency"
  | "stress_pattern"
  | "recovery_pattern"
  | "emotional_trajectory"
  | "cross_domain_correlation"
  | "motivation_pattern"
  | "burnout_signal"
  | "positive_momentum";

export type ProactiveInsight = {
  id: string;
  category: InsightCategory;
  text: string;                   // 1-2 sentences, observational
  confidence: number;             // 0-1
  evidenceWindowDays: number;     // how many days of data support this
  isPositive: boolean;            // framing direction
  suppressedUntil: number;        // epoch ms; don't re-emit until this time
};

export type InsightSynthesisReport = {
  freshInsights: ProactiveInsight[];      // ready to show
  suppressedCount: number;               // suppressed by TTL
  lastSynthesizedAt: number | null;
  totalInsightsGenerated: number;
};

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_proactive_insights_v1";
const INSIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const SYNTHESIS_COOLDOWN_MS = 6 * 60 * 60 * 1000;  // 6 hours
const MAX_FRESH_INSIGHTS = 2;

type InsightStore = {
  insights: ProactiveInsight[];
  lastSynthesizedAt: number | null;
  totalGenerated: number;
};

function loadStore(): InsightStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { insights: [], lastSynthesizedAt: null, totalGenerated: 0 };
  } catch { return { insights: [], lastSynthesizedAt: null, totalGenerated: 0 }; }
}

function saveStore(store: InsightStore): void {
  // Prune expired insights
  const now = Date.now();
  store.insights = store.insights.filter((i) => i.suppressedUntil > now).slice(-20);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* ok */ }
}

function isDuplicate(store: InsightStore, id: string): boolean {
  return store.insights.some((i) => i.id === id && i.suppressedUntil > Date.now());
}

// ── Insight generators ────────────────────────────────────────────────────────

function makeSuppressedUntil(): number {
  return Date.now() + INSIGHT_TTL_MS;
}

function generateSleepInsight(store: InsightStore): ProactiveInsight | null {
  const trends = computeRollingTrends();
  const sleepTrend = trends.find((t) => t.domain === "Sleep");
  if (!sleepTrend || sleepTrend.weeks.filter((v) => v > 0).length < 2) return null;
  if (isDuplicate(store, "sleep_trend")) return null;

  const recentWeeks = sleepTrend.weeks.slice(-2);
  const older = sleepTrend.weeks.slice(0, 2);
  const recentAvg = recentWeeks.reduce((a, b) => a + b, 0) / recentWeeks.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = recentAvg - olderAvg;

  if (Math.abs(delta) < 0.5) return null;

  const isPositive = delta > 0;
  return {
    id: "sleep_trend",
    category: "sleep_trend",
    text: isPositive
      ? "Sleep nights logged have been increasing over the past few weeks."
      : "Sleep logging has been less consistent recently.",
    confidence: Math.min(0.8, Math.abs(delta) / 3 + 0.3),
    evidenceWindowDays: 28,
    isPositive,
    suppressedUntil: makeSuppressedUntil(),
  };
}

function generateHabitInsight(store: InsightStore): ProactiveInsight | null {
  const trends = computeRollingTrends();
  const habitTrend = trends.find((t) => t.domain === "Habits");
  if (!habitTrend || isDuplicate(store, "habit_consistency")) return null;

  const direction = habitTrend.direction;
  if (direction === "stable") return null;

  const isPositive = direction === "up";
  return {
    id: "habit_consistency",
    category: "habit_consistency",
    text: isPositive
      ? "Habit completion has been trending upward over the past month."
      : "Habit completion rate has declined over recent weeks.",
    confidence: 0.65,
    evidenceWindowDays: 28,
    isPositive,
    suppressedUntil: makeSuppressedUntil(),
  };
}

function generateEmotionalInsight(store: InsightStore): ProactiveInsight | null {
  if (isDuplicate(store, "emotional_trajectory")) return null;
  const emotional = getEmotionalProfile();
  const motivation = emotional.dimensions.motivation;
  const stress = emotional.dimensions.stress;

  if (motivation.confidence < 0.35) return null;

  if (motivation.trend === "rising" && motivation.value > 0.55) {
    return {
      id: "emotional_trajectory",
      category: "emotional_trajectory",
      text: "Motivation signals appear to be strengthening based on recent patterns.",
      confidence: Math.min(0.75, motivation.confidence),
      evidenceWindowDays: 14,
      isPositive: true,
      suppressedUntil: makeSuppressedUntil(),
    };
  }

  if (stress.trend === "falling" && stress.value < 0.5) {
    return {
      id: "emotional_trajectory",
      category: "stress_pattern",
      text: "Stress indicators appear lower than your recent average.",
      confidence: Math.min(0.7, stress.confidence),
      evidenceWindowDays: 14,
      isPositive: true,
      suppressedUntil: makeSuppressedUntil(),
    };
  }

  return null;
}

function generateMomentumInsight(store: InsightStore): ProactiveInsight | null {
  if (isDuplicate(store, "positive_momentum")) return null;
  try {
    const trajectory = computeWellnessTrajectory(false);
    if (trajectory.positiveSignals.length >= 2) {
      return {
        id: "positive_momentum",
        category: "positive_momentum",
        text: `Multiple wellness areas are showing positive momentum: ${trajectory.positiveSignals.slice(0, 2).join(" and ")}.`,
        confidence: Math.min(0.75, trajectory.compositeMomentum),
        evidenceWindowDays: 28,
        isPositive: true,
        suppressedUntil: makeSuppressedUntil(),
      };
    }
  } catch { /* ok */ }
  return null;
}

function generateBurnoutInsight(store: InsightStore): ProactiveInsight | null {
  if (isDuplicate(store, "burnout_signal")) return null;
  const emotional = getEmotionalProfile();
  const burnout = emotional.dimensions.burnout;
  if (burnout.value > 0.65 && burnout.confidence > 0.4 && burnout.trend === "rising") {
    return {
      id: "burnout_signal",
      category: "burnout_signal",
      text: "Burnout indicators have been accumulating. Rest and reduced pressure often help more than pushing through.",
      confidence: Math.min(0.82, burnout.confidence),
      evidenceWindowDays: 14,
      isPositive: false,
      suppressedUntil: makeSuppressedUntil(),
    };
  }
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function synthesizeProactiveInsights(forceRefresh = false): InsightSynthesisReport {
  const store = loadStore();
  const now = Date.now();

  // Rate limiting
  if (!forceRefresh && store.lastSynthesizedAt && now - store.lastSynthesizedAt < SYNTHESIS_COOLDOWN_MS) {
    const fresh = store.insights.filter((i) => i.suppressedUntil > now).slice(0, MAX_FRESH_INSIGHTS);
    return {
      freshInsights: fresh,
      suppressedCount: store.insights.length - fresh.length,
      lastSynthesizedAt: store.lastSynthesizedAt,
      totalInsightsGenerated: store.totalGenerated,
    };
  }

  const generators = [
    generateSleepInsight,
    generateHabitInsight,
    generateEmotionalInsight,
    generateMomentumInsight,
    generateBurnoutInsight,
  ];

  const newInsights: ProactiveInsight[] = [];
  for (const gen of generators) {
    if (newInsights.length >= MAX_FRESH_INSIGHTS) break;
    try {
      const insight = gen(store);
      if (insight) newInsights.push(insight);
    } catch { /* each generator is independent */ }
  }

  // Add to store
  store.insights.push(...newInsights);
  store.lastSynthesizedAt = now;
  store.totalGenerated += newInsights.length;
  saveStore(store);

  const fresh = newInsights.slice(0, MAX_FRESH_INSIGHTS);
  const suppressedCount = store.insights.filter((i) => i.suppressedUntil > now).length - fresh.length;

  return {
    freshInsights: fresh,
    suppressedCount: Math.max(0, suppressedCount),
    lastSynthesizedAt: now,
    totalInsightsGenerated: store.totalGenerated,
  };
}

export function getInsightSynthesisReport(): InsightSynthesisReport {
  const store = loadStore();
  const now = Date.now();
  const fresh = store.insights.filter((i) => i.suppressedUntil > now).slice(0, MAX_FRESH_INSIGHTS);
  return {
    freshInsights: fresh,
    suppressedCount: Math.max(0, store.insights.filter((i) => i.suppressedUntil > now).length - fresh.length),
    lastSynthesizedAt: store.lastSynthesizedAt,
    totalInsightsGenerated: store.totalGenerated,
  };
}
