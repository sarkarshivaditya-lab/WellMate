// src/intelligence/habitIntelligence.ts
// Deterministic habit consistency, momentum, and resilience scoring.
// Reuses computeStreak() from habitsStore — no duplication.
// Streaks are supportive, never punishing.

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
  consistency30: number;    // % of last 30 days completed
  momentum7: number;        // % of last 7 days completed (for daily habits)
  bouncebacks: number;      // missed-then-recovered events (resilience)
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

  // ── Overall consistency (35 pts) ─────────────────────────────────────────
  const avgConsistency =
    stats.reduce((s, h) => s + h.consistency30, 0) / stats.length;
  const consistencyScore = Math.round((avgConsistency / 100) * 35);

  signals.push({
    label: "30-day consistency",
    value: `${Math.round(avgConsistency)}%`,
    positive: avgConsistency >= 60,
  });

  // ── Momentum (35 pts) — last 7 days ──────────────────────────────────────
  const avgMomentum =
    stats.reduce((s, h) => s + h.momentum7, 0) / stats.length;
  const momentumScore = Math.round((avgMomentum / 100) * 35);

  signals.push({
    label: "This week's completion",
    value: `${Math.round(avgMomentum)}%`,
    positive: avgMomentum >= 50,
  });

  // ── Streak bonus (20 pts) ─────────────────────────────────────────────────
  const bestStreak = Math.max(...stats.map((s) => s.streak), 0);
  const streakScore = Math.min(20, bestStreak * 2);

  if (bestStreak > 0) {
    signals.push({
      label: "Best active streak",
      value: `${bestStreak} day${bestStreak !== 1 ? "s" : ""}`,
      positive: true,
    });
  }

  // ── Resilience bonus (10 pts) ─────────────────────────────────────────────
  const totalBouncebacks = stats.reduce((s, h) => s + h.bouncebacks, 0);
  const resilienceScore = Math.min(10, totalBouncebacks * 2);

  if (totalBouncebacks > 0) {
    signals.push({
      label: "Recovery events",
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
    headline = "Strong habit momentum";
    explanation = `You're completing ${Math.round(avgMomentum)}% of your habits this week, with ${Math.round(avgConsistency)}% consistency over the past 30 days. ${bestStreak > 0 ? `Your best active streak is ${bestStreak} day${bestStreak !== 1 ? "s" : ""}.` : "That consistency is building something real."}`;
  } else if (score >= 45) {
    headline = "Habits are taking shape";
    explanation = `You're completing about ${Math.round(avgMomentum)}% of your habits this week. ${totalBouncebacks > 0 ? `You've come back ${totalBouncebacks} time${totalBouncebacks !== 1 ? "s" : ""} after a missed day — that's what matters.` : "Missing a day is normal — what matters is returning the next day."}`;
  } else {
    headline = "Room to build consistency";
    explanation = `Habit consistency takes time to develop. Even completing one habit each day builds a foundation. Focusing on just one or two makes follow-through much easier.`;
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
