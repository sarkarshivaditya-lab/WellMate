// src/intelligence/sleepIntelligence.ts
// Deterministic sleep scoring and debt estimation.
// All signals are traceable — every score change is explainable to the user.

import { getAllLocalSleep } from "@/data/local/sleepStore";
import { getAllLocalExercises } from "@/data/local/exercises";
import type { WellnessScore, SleepDebt, SignalItem } from "./types";

const TARGET_SLEEP_MIN = 450; // 7.5 hours
const MINIMUM_LOGS = 3;

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  const variance = nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function extractBedtimeHour(startIso: string): number {
  const d = new Date(startIso);
  // Normalise: 10pm = 22, midnight = 0, 1am = 1
  // Shift midnight so bedtimes cluster (22,23,0,1 should be treated as similar)
  const h = d.getHours() + d.getMinutes() / 60;
  // Map so midnight (0h) reads as 24 for stdDev purposes if bedtime > noon
  return h < 12 ? h + 24 : h;
}

// ── Sleep Debt ────────────────────────────────────────────────────────────────

export function computeSleepDebt(): SleepDebt {
  const cutoff = cutoffIso(7);
  const recent = getAllLocalSleep()
    .filter((s) => s.startIso >= cutoff)
    .slice(-7);

  if (recent.length === 0) {
    return { hoursDebt: 0, context: "No sleep data available yet." };
  }

  const totalDebt = recent.reduce(
    (sum, s) => sum + Math.max(0, TARGET_SLEEP_MIN - s.durationMin),
    0,
  );

  // Also account for nights with no log (assume adequate for missing nights)
  const hoursDebt = Math.round((totalDebt / 60) * 10) / 10;

  let context: string;
  if (hoursDebt === 0) {
    context = "You're meeting your sleep target consistently.";
  } else if (hoursDebt <= 2) {
    context = `About ${hoursDebt}h of sleep missed this week — a short recovery session can help.`;
  } else if (hoursDebt <= 5) {
    context = `${hoursDebt}h of cumulative sleep missed this week. Prioritising rest tonight will help.`;
  } else {
    context = `${hoursDebt}h of sleep missed this week. Consistent early bedtimes are the most effective recovery.`;
  }

  return { hoursDebt, context };
}

// ── Sleep Score ───────────────────────────────────────────────────────────────

export function computeSleepScore(): WellnessScore {
  const cutoff14 = cutoffIso(14);
  const allLogs = getAllLocalSleep()
    .filter((s) => s.startIso >= cutoff14)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  if (allLogs.length < MINIMUM_LOGS) {
    return {
      score: 0,
      level: "low",
      headline: "Not enough sleep data yet",
      explanation: `Log at least ${MINIMUM_LOGS} nights of sleep to unlock your sleep score. Tracking just a few nights reveals meaningful patterns.`,
      signals: [],
      trend: "stable",
      dataQuality: "insufficient",
    };
  }

  // Use last 7 nights for scoring, but up to 14 for trend
  const recent7 = allLogs.slice(-7);
  const signals: SignalItem[] = [];

  // ── 1. Duration adequacy (35 pts) ─────────────────────────────────────────
  const avgDuration = avg(recent7.map((s) => s.durationMin));
  const durationHours = Math.round((avgDuration / 60) * 10) / 10;

  let durationScore: number;
  if (avgDuration >= 420) {
    durationScore = 35;
  } else if (avgDuration >= 300) {
    // Linear scale from 0 at 5h to 35 at 7h
    durationScore = Math.round(((avgDuration - 300) / 120) * 35);
  } else {
    durationScore = 0;
  }

  signals.push({
    label: "Avg sleep duration",
    value: `${Math.floor(durationHours)}h ${Math.round((durationHours % 1) * 60)}m`,
    positive: avgDuration >= 390,
  });

  // ── 2. Quality rating (30 pts) ────────────────────────────────────────────
  const avgQuality = avg(recent7.map((s) => s.rating));
  const qualityScore = Math.round(((avgQuality - 1) / 4) * 30);

  signals.push({
    label: "Avg sleep quality",
    value: `${avgQuality.toFixed(1)}/5`,
    positive: avgQuality >= 3,
  });

  // ── 3. Bedtime consistency (20 pts) ───────────────────────────────────────
  const bedtimeHours = recent7.map((s) => extractBedtimeHour(s.startIso));
  const bedtimeStdDev = stdDev(bedtimeHours);

  let consistencyScore: number;
  let consistencyLabel: string;
  if (bedtimeStdDev < 0.5) {
    consistencyScore = 20;
    consistencyLabel = "Very consistent";
  } else if (bedtimeStdDev < 1) {
    consistencyScore = 15;
    consistencyLabel = "Mostly consistent";
  } else if (bedtimeStdDev < 1.5) {
    consistencyScore = 10;
    consistencyLabel = "Somewhat variable";
  } else if (bedtimeStdDev < 2.5) {
    consistencyScore = 5;
    consistencyLabel = "Variable";
  } else {
    consistencyScore = 0;
    consistencyLabel = "Irregular";
  }

  signals.push({
    label: "Bedtime schedule",
    value: consistencyLabel,
    positive: bedtimeStdDev < 1,
  });

  // ── 4. Trend bonus (15 pts) ───────────────────────────────────────────────
  let trendScore = 7; // neutral baseline
  let trend: WellnessScore["trend"] = "stable";

  if (allLogs.length >= 6) {
    const half = Math.floor(allLogs.length / 2);
    const olderAvgQ = avg(allLogs.slice(0, half).map((s) => s.rating));
    const recentAvgQ = avg(allLogs.slice(-half).map((s) => s.rating));
    const delta = recentAvgQ - olderAvgQ;

    if (delta >= 0.4) {
      trendScore = 15;
      trend = "up";
    } else if (delta <= -0.4) {
      trendScore = 0;
      trend = "down";
    } else {
      trendScore = 7;
      trend = "stable";
    }
  }

  const rawScore = durationScore + qualityScore + consistencyScore + trendScore;
  const score = Math.min(100, Math.max(0, rawScore));
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  // ── Headline + explanation ────────────────────────────────────────────────
  let headline: string;
  let explanation: string;

  if (score >= 75) {
    headline = "Strong sleep foundation";
    explanation = `Your sleep duration averages ${durationHours}h with ${consistencyLabel.toLowerCase()} timing — a solid recovery base. ${trend === "up" ? "Sleep quality has been trending up recently." : "Consistent timing is the foundation of good sleep."}`;
  } else if (score >= 55) {
    headline = "Decent sleep with room to grow";
    explanation = `Averaging ${durationHours}h with ${consistencyLabel.toLowerCase()} timing. ${avgQuality < 3.5 ? "Improving sleep quality through a wind-down routine could help." : "Aiming for a more consistent bedtime would strengthen your recovery."}`;
  } else if (score >= 35) {
    headline = "Sleep needs more attention";
    explanation = `Your average of ${durationHours}h is ${avgDuration < 390 ? "below the recommended 7–8h" : "adequate"}, but ${bedtimeStdDev >= 1.5 ? "irregular bedtimes are disrupting your rhythm" : "sleep quality could be improved"}. Small, consistent changes make a big difference.`;
  } else {
    headline = "Sleep is significantly affecting recovery";
    explanation = `With an average of ${durationHours}h and variable sleep timing, your body has limited time to recover. Even shifting bedtime 30 minutes earlier and keeping it consistent can meaningfully improve how you feel.`;
  }

  if (trend === "up") {
    signals.push({ label: "Recent trend", value: "Improving", positive: true });
  } else if (trend === "down") {
    signals.push({ label: "Recent trend", value: "Declining", positive: false });
  }

  return {
    score,
    level,
    headline,
    explanation,
    signals,
    trend,
    dataQuality: allLogs.length >= 7 ? "sufficient" : "partial",
  };
}

// ── Recovery Readiness (sleep-based component) ────────────────────────────────

export function computeSleepRecoveryReadiness(): {
  score: number;
  label: string;
  context: string;
} {
  const cutoff = cutoffIso(3);
  const recent = getAllLocalSleep()
    .filter((s) => s.startIso >= cutoff)
    .sort((a, b) => b.startIso.localeCompare(a.startIso));

  if (recent.length === 0) {
    return { score: 50, label: "Unknown", context: "Log sleep to track recovery readiness." };
  }

  // Last night carries most weight
  const lastNight = recent[0];
  const prevNight = recent[1] ?? null;

  const lastQuality = lastNight.rating;
  const lastDuration = lastNight.durationMin;
  const prevQuality = prevNight?.rating ?? lastQuality;

  // 0-100 readiness
  let score = 0;
  // Duration contribution (50%)
  if (lastDuration >= 420) score += 50;
  else if (lastDuration >= 330) score += Math.round(((lastDuration - 330) / 90) * 50);

  // Quality contribution (50%)
  score += Math.round(((lastQuality - 1) / 4) * 30);
  score += Math.round(((prevQuality - 1) / 4) * 20);

  // Modifier: if heavy exercise yesterday, need better sleep for same readiness
  const exerciseCutoff = new Date();
  exerciseCutoff.setDate(exerciseCutoff.getDate() - 1);
  const cutoffExIso = exerciseCutoff.toISOString().split("T")[0];
  const yesterdayExercise = getAllLocalExercises().filter(
    (e) => !e.deletedAt && e.dateIso === cutoffExIso,
  );
  const exerciseLoad = yesterdayExercise.reduce((s, e) => s + e.caloriesBurnedEst, 0);
  if (exerciseLoad > 400 && lastQuality < 4) {
    score = Math.max(0, score - 10);
  }

  score = Math.min(100, Math.max(0, score));

  let label: string;
  let context: string;

  if (score >= 75) {
    label = "Ready";
    context = "Your body is well-recovered. Good time for higher-intensity training.";
  } else if (score >= 55) {
    label = "Moderate";
    context = "Moderate readiness. Moderate-intensity activity is appropriate.";
  } else if (score >= 35) {
    label = "Low";
    context = "Your body may still be recovering. Light movement or rest is recommended.";
  } else {
    label = "Rest needed";
    context = "Prioritise rest today. Your recovery signals suggest your body needs more sleep.";
  }

  return { score, label, context };
}
