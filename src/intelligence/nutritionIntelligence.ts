// src/intelligence/nutritionIntelligence.ts
// Deterministic nutrition pattern analysis.
// Reuses nutritionEngine.ts for all TDEE/macro calculations — no duplication.
// Avoids medical claims — framed as wellness guidance, not diagnosis.

import { getAllLocalMeals } from "@/data/local/mealsStore";
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacroTargets,
  calculateAge,
  type ActivityLevel,
  type Goal,
  type Sex,
} from "@/services/nutritionEngine";
import type { WellnessScore, SignalItem } from "./types";

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type UserProfile = {
  dob?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  goal?: string;
};

// ── Target computation (reusing nutritionEngine.ts) ───────────────────────────

function computeTargets(profile: UserProfile | null): {
  calorieTarget: number | null;
  proteinTarget: number | null;
} {
  if (
    !profile?.dob ||
    !profile?.sex ||
    !profile?.heightCm ||
    !profile?.weightKg ||
    !profile?.activityLevel ||
    !profile?.goal
  ) {
    return { calorieTarget: null, proteinTarget: null };
  }

  try {
    const age = calculateAge(profile.dob);
    const bmr = calculateBMR(
      profile.weightKg,
      profile.heightCm,
      age,
      profile.sex as Sex,
    );
    const tdee = calculateTDEE(bmr, profile.activityLevel as ActivityLevel);
    const calorieTarget = calculateCalorieTarget(tdee, profile.goal as Goal);
    const macros = calculateMacroTargets(calorieTarget, profile.weightKg, profile.goal as Goal);
    return { calorieTarget, proteinTarget: macros.proteinG };
  } catch {
    return { calorieTarget: null, proteinTarget: null };
  }
}

// ── Calorie Pattern Analysis ──────────────────────────────────────────────────

export function computeNutritionScore(profile: UserProfile | null): WellnessScore {
  const cutoff7 = cutoffIso(7);
  const meals7 = getAllLocalMeals().filter(
    (m) => !m.deletedAt && m.dateIso >= cutoff7,
  );

  // Unique logged days
  const loggedDates = new Set(meals7.map((m) => m.dateIso));
  const loggedDays = loggedDates.size;

  if (loggedDays < 2) {
    return {
      score: 0,
      level: "low",
      headline: "Not enough nutrition data yet",
      explanation: "Log meals on at least 2 days to unlock nutrition insights. Even logging once a day builds a useful picture of your patterns.",
      signals: [],
      trend: "stable",
      dataQuality: "insufficient",
    };
  }

  const signals: SignalItem[] = [];
  let score = 50; // neutral baseline

  // ── Logging regularity (30 pts) ───────────────────────────────────────────
  const regularityPct = loggedDays / 7;
  const regularityScore = Math.round(regularityPct * 30);
  score += regularityScore - 15; // -15 so neutral at 50%

  signals.push({
    label: "Logged days this week",
    value: `${loggedDays}/7`,
    positive: loggedDays >= 4,
  });

  // ── Calorie pattern (35 pts) ──────────────────────────────────────────────
  const { calorieTarget, proteinTarget } = computeTargets(profile);

  const caloriesByDate = new Map<string, number>();
  for (const meal of meals7) {
    caloriesByDate.set(
      meal.dateIso,
      (caloriesByDate.get(meal.dateIso) ?? 0) + meal.totalCalories,
    );
  }

  const dailyCalories = Array.from(caloriesByDate.values());
  const avgDailyKcal = avg(dailyCalories);

  if (calorieTarget !== null && calorieTarget > 0) {
    const ratio = avgDailyKcal / calorieTarget;

    let caloriePatternScore: number;
    let calorieLabel: string;

    if (ratio >= 0.85 && ratio <= 1.15) {
      // Within ±15% of target — ideal
      caloriePatternScore = 35;
      calorieLabel = "On target";
    } else if (ratio < 0.7) {
      // Significant under-eating
      caloriePatternScore = 10;
      calorieLabel = "Well below target";
    } else if (ratio < 0.85) {
      // Mild deficit
      caloriePatternScore = 25;
      calorieLabel = profile?.goal === "lose" ? "In deficit" : "Below target";
    } else if (ratio <= 1.3) {
      // Mild surplus
      caloriePatternScore = 25;
      calorieLabel = profile?.goal === "gain" ? "In surplus" : "Slightly above target";
    } else {
      // Significant surplus
      caloriePatternScore = 15;
      calorieLabel = "Well above target";
    }

    score += caloriePatternScore - 17; // rebalance

    signals.push({
      label: "Avg daily intake",
      value: `${Math.round(avgDailyKcal)} kcal (${calorieLabel})`,
      positive: caloriePatternScore >= 25,
    });
  } else {
    // No profile — just note average
    if (avgDailyKcal > 0) {
      signals.push({
        label: "Avg daily intake",
        value: `${Math.round(avgDailyKcal)} kcal`,
        positive: true,
      });
    }
  }

  // ── Protein consistency (20 pts) ──────────────────────────────────────────
  const proteinByDate = new Map<string, number>();
  for (const meal of meals7) {
    proteinByDate.set(
      meal.dateIso,
      (proteinByDate.get(meal.dateIso) ?? 0) + meal.totalProteinG,
    );
  }
  const avgProtein = avg(Array.from(proteinByDate.values()));

  if (proteinTarget !== null && avgProtein > 0) {
    const proteinRatio = avgProtein / proteinTarget;
    const proteinScore = proteinRatio >= 0.85 ? 20 : proteinRatio >= 0.65 ? 12 : 5;
    score += proteinScore - 10;

    signals.push({
      label: "Avg daily protein",
      value: `${Math.round(avgProtein)}g${proteinTarget ? ` / ${proteinTarget}g target` : ""}`,
      positive: proteinRatio >= 0.85,
    });
  } else if (avgProtein > 0) {
    signals.push({
      label: "Avg daily protein",
      value: `${Math.round(avgProtein)}g`,
      positive: true,
    });
  }

  // ── Trend (last 3 vs previous 3 days) ────────────────────────────────────
  const cutoff3 = cutoffIso(3);
  const last3Dates = new Set(
    meals7.filter((m) => m.dateIso >= cutoff3).map((m) => m.dateIso),
  );
  const prev3Dates = new Set(
    meals7.filter((m) => m.dateIso < cutoff3).map((m) => m.dateIso),
  );

  let trend: WellnessScore["trend"] = "stable";
  if (last3Dates.size > prev3Dates.size + 1) trend = "up";
  else if (prev3Dates.size > last3Dates.size + 1) trend = "down";

  score = Math.min(100, Math.max(0, score));
  const level = score >= 65 ? "high" : score >= 40 ? "medium" : "low";

  // ── Headline + explanation ────────────────────────────────────────────────
  let headline: string;
  let explanation: string;

  if (score >= 70) {
    headline = "Nutrition tracking is working well";
    explanation = `You've logged meals on ${loggedDays} of the last 7 days${calorieTarget ? `, averaging ${Math.round(avgDailyKcal)} kcal — close to your ${Math.round(calorieTarget)} kcal target` : ""}. Consistent tracking is the foundation of effective nutrition.`;
  } else if (score >= 50) {
    headline = "Building good nutrition habits";
    explanation = `Logging meals on ${loggedDays} of 7 days gives a partial picture. ${calorieTarget && avgDailyKcal < calorieTarget * 0.85 ? "Your intake appears below your target — ensure you're eating enough to support your goals." : "Increasing logging frequency will help surface more meaningful patterns."}`;
  } else {
    headline = "Nutrition patterns are still forming";
    explanation = `With ${loggedDays} day${loggedDays !== 1 ? "s" : ""} of data this week, it's hard to draw conclusions. Logging even one meal per day for a few more days will unlock calorie and macro insights.`;
  }

  return {
    score,
    level,
    headline,
    explanation,
    signals,
    trend,
    dataQuality: loggedDays >= 5 ? "sufficient" : loggedDays >= 2 ? "partial" : "insufficient",
  };
}

// ── Under-eating detection ────────────────────────────────────────────────────
// Returns a gentle signal if average intake is significantly below target.
// Framed as wellness guidance, not medical advice.

export function detectUnderEating(profile: UserProfile | null): {
  detected: boolean;
  context?: string;
} {
  const { calorieTarget } = computeTargets(profile);
  if (!calorieTarget) return { detected: false };

  const cutoff7 = cutoffIso(7);
  const meals7 = getAllLocalMeals().filter(
    (m) => !m.deletedAt && m.dateIso >= cutoff7,
  );

  const loggedDays = new Set(meals7.map((m) => m.dateIso)).size;
  if (loggedDays < 3) return { detected: false };

  const caloriesByDate = new Map<string, number>();
  for (const meal of meals7) {
    caloriesByDate.set(
      meal.dateIso,
      (caloriesByDate.get(meal.dateIso) ?? 0) + meal.totalCalories,
    );
  }

  const avgKcal = avg(Array.from(caloriesByDate.values()));

  if (avgKcal < calorieTarget * 0.7) {
    return {
      detected: true,
      context: `Your average intake (${Math.round(avgKcal)} kcal) is noticeably below your estimated target (${Math.round(calorieTarget)} kcal). Consistently eating below your needs can reduce energy and affect recovery.`,
    };
  }

  return { detected: false };
}
