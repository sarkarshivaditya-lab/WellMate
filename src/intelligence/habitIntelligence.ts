// src/intelligence/habitIntelligence.ts
// Deterministic habit consistency, momentum, and resilience scoring.
// Reuses computeStreak() from habitsStore — no duplication.
// Score weights: consistency (40%) > momentum (30%) > resilience (20%) > rhythm streak (10%).
// Resilience and recovery are weighted higher than streak length — supporting
// sustainable behavioral patterns over perfectionist compliance.

import {
  listHabits,
  listAllEntries,
  computeStreak,
  type LocalHabit,
  type LocalHabitEntry,
} from "@/data/local/habitsStore";
import type { WellnessScore, SignalItem } from "./types";

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function dateIsoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

// ── Per-habit consistency (0-100) ─────────────────────────────────────────────

export type HabitStats = {
  habit: LocalHabit;
  streak: number;
  consistency30: number;    // % of last 30 days completed (0-100 integer)
  momentum7: number;        // % of last 7 days completed (for daily habits)
  bouncebacks: number;      // missed-then-recovered events (resilience)
};

// Consistency health profile — used for overcommitment detection and
// gentle surface-level awareness in the Habits page.
export type HabitConsistencyProfile = {
  overloadRisk: boolean;         // 5+ habits AND avg consistency < 40%
  activeHabitCount: number;
  avgConsistency30: number;      // 0-100 integer
  lowPerformingHabits: string[]; // titles of habits with <30% consistency
  hasReturnOpportunity: boolean; // at least one habit with 0 completions in last 7 days
};

export function computeHabitStats(): HabitStats[] {
  const habits = listHabits();
  const allEntries = listAllEntries();
  const cutoff30 = cutoffIso(30);

  return habits.map((habit) => {
    const entries = allEntries.filter((e) => e.habitLocalId === habit.localId);
    const streak = computeStreak(habit.localId, entries);

    // Consistency: completed days / days since creation or 30 days (whichever shorter)
    const createdDaysAgo = Math.floor(
      (Date.now() - habit.createdAt) / (1000 * 60 * 60 * 24),
    );
    const window = Math.min(30, createdDaysAgo + 1);
    const recentEntries = entries.filter((e) => e.dateIso >= cutoff30 && e.completed);
    const consistency30 = window > 0 ? Math.round((recentEntries.length / window) * 100) : 0;

    // Momentum: last 7 days
    const cutoff7 = cutoffIso(7);
    const entries7 = entries.filter((e) => e.dateIso >= cutoff7 && e.completed);
    const momentum7 = Math.round((entries7.length / 7) * 100);

    // Resilience: count "bounce-back" events
    // A bounce-back = a missed day immediately followed by a completed day
    const sortedEntries = [...entries]
      .filter((e) => e.dateIso >= cutoff30)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

    let bouncebacks = 0;
    for (let i = 1; i < sortedEntries.length; i++) {
      const prev = sortedEntries[i - 1];
      const curr = sortedEntries[i];
      if (!prev.completed && curr.completed) {
        bouncebacks++;
      }
    }

    return { habit, streak, consistency30, momentum7, bouncebacks };
  });
}

// ── Overall Habit Score ───────────────────────────────────────────────────────

export function computeHabitScore(): WellnessScore {
  const habits = listHabits();

  if (habits.length === 0) {
    return {
      score: 0,
      level: "low",
      headline: "No habits set yet",
      explanation: "Add a habit to start tracking. Even one, done regularly, gives you a clearer picture over time.",
      signals: [],
      trend: "stable",
      dataQuality: "insufficient",
    };
  }

  const stats = computeHabitStats();
  const allEntries = listAllEntries();
  const signals: SignalItem[] = [];

  // ── Overall consistency (40 pts) ─────────────────────────────────────────
  const avgConsistency =
    stats.reduce((s, h) => s + h.consistency30, 0) / stats.length;
  const consistencyScore = Math.round((avgConsistency / 100) * 40);

  signals.push({
    label: "30-day consistency",
    value: `${Math.round(avgConsistency)}%`,
    positive: avgConsistency >= 60,
  });

  // ── Momentum (30 pts) — last 7 days ──────────────────────────────────────
  const avgMomentum =
    stats.reduce((s, h) => s + h.momentum7, 0) / stats.length;
  const momentumScore = Math.round((avgMomentum / 100) * 30);

  signals.push({
    label: "This week's completion",
    value: `${Math.round(avgMomentum)}%`,
    positive: avgMomentum >= 50,
  });

  // ── Rhythm streak bonus (10 pts) — informational, not primary ────────────
  // Capped at 10 consecutive days = max bonus. De-emphasized relative to
  // consistency and resilience so short gaps don't overshadow long-run patterns.
  const bestStreak = Math.max(...stats.map((s) => s.streak), 0);
  const streakScore = Math.min(10, bestStreak);

  if (bestStreak > 0) {
    signals.push({
      label: "Current rhythm",
      value: `${bestStreak} day${bestStreak !== 1 ? "s" : ""}`,
      positive: true,
    });
  }

  // ── Resilience bonus (20 pts) — returning after a miss matters more ───────
  // 5 bounce-backs = max bonus. Recovery events are as valuable as sustained
  // streaks — this weight reflects that real human consistency includes gaps.
  const totalBouncebacks = stats.reduce((s, h) => s + h.bouncebacks, 0);
  const resilienceScore = Math.min(20, totalBouncebacks * 4);

  if (totalBouncebacks > 0) {
    signals.push({
      label: "Times returned after a miss",
      value: `${totalBouncebacks}`,
      positive: true,
    });
  }

  const rawScore = consistencyScore + momentumScore + streakScore + resilienceScore;
  const score = Math.min(100, Math.max(0, rawScore));
  const level = score >= 65 ? "high" : score >= 40 ? "medium" : "low";

  // ── Trend: compare this week vs last week ─────────────────────────────────
  const cutoff7 = cutoffIso(7);
  const cutoff14 = cutoffIso(14);

  const thisWeekCompleted = allEntries.filter(
    (e) => e.dateIso >= cutoff7 && e.completed,
  ).length;
  const lastWeekCompleted = allEntries.filter(
    (e) => e.dateIso >= cutoff14 && e.dateIso < cutoff7 && e.completed,
  ).length;

  const trend: WellnessScore["trend"] =
    thisWeekCompleted > lastWeekCompleted + 1
      ? "up"
      : lastWeekCompleted > thisWeekCompleted + 1
        ? "down"
        : "stable";

  // ── Headline + explanation ────────────────────────────────────────────────
  let headline: string;
  let explanation: string;

  if (score >= 70) {
    headline = "Steady habit rhythm";
    explanation = `You're completing ${Math.round(avgMomentum)}% of your habits this week, with ${Math.round(avgConsistency)}% consistency over the past 30 days. ${totalBouncebacks > 0 ? `You've returned after missed days ${totalBouncebacks} time${totalBouncebacks !== 1 ? "s" : ""} — that kind of recovery is what builds lasting rhythm.` : "That consistency is building something real."}`;
  } else if (score >= 45) {
    headline = "Habits are taking shape";
    explanation = `You're completing about ${Math.round(avgMomentum)}% of your habits this week. ${totalBouncebacks > 0 ? `You've come back ${totalBouncebacks} time${totalBouncebacks !== 1 ? "s" : ""} after a missed day — returning is the part that matters most.` : "Missing a day is part of any real pattern. What counts is continuing."}`;
  } else {
    headline = "Building consistency gradually";
    explanation = `Consistency develops over weeks, not days. Even one habit done regularly is meaningful progress. Focusing on just one or two often makes follow-through much more sustainable.`;
  }

  return {
    score,
    level,
    headline,
    explanation,
    signals,
    trend,
    dataQuality: allEntries.length >= 5 ? "sufficient" : "partial",
  };
}

// ── Consistency health profile ────────────────────────────────────────────────
// Used to surface gentle overcommitment awareness and restart opportunities
// in the Habits page UI. Never shown as a warning — only as calm context.

export function computeHabitConsistencyProfile(): HabitConsistencyProfile {
  const habits = listHabits();

  if (habits.length === 0) {
    return {
      overloadRisk: false,
      activeHabitCount: 0,
      avgConsistency30: 0,
      lowPerformingHabits: [],
      hasReturnOpportunity: false,
    };
  }

  const allEntries = listAllEntries();
  const stats = computeHabitStats();
  const avgConsistency30 = Math.round(
    stats.reduce((s, h) => s + h.consistency30, 0) / stats.length,
  );

  const lowPerformingHabits = stats
    .filter((s) => s.consistency30 < 30)
    .map((s) => s.habit.title);

  // Overload = many habits AND low average follow-through.
  // Threshold: 5+ habits AND <40% average consistency.
  const overloadRisk = habits.length >= 5 && avgConsistency30 < 40;

  // Return opportunity = any habit with no completions in the last 7 days,
  // giving the UI a chance to offer a gentle restart prompt.
  const cutoff7 = cutoffIso(7);
  const hasReturnOpportunity = stats.some((hs) => {
    const recentCompletions = allEntries.filter(
      (e) => e.habitLocalId === hs.habit.localId && e.dateIso >= cutoff7 && e.completed,
    );
    return recentCompletions.length === 0;
  });

  return {
    overloadRisk,
    activeHabitCount: habits.length,
    avgConsistency30,
    lowPerformingHabits,
    hasReturnOpportunity,
  };
}
