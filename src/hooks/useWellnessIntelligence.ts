// src/hooks/useWellnessIntelligence.ts
// Reactive hook for all intelligence domain scores.
// Subscribes to all local stores — recomputes on any wellness data change.
// Debounced at 250ms so rapid sequential writes (e.g. QuickAdd) only trigger
// one recompute rather than one per store mutation.

import { useState, useEffect, useRef } from "react";
import { subscribeToMeals } from "@/data/local/mealsStore";
import { subscribeToExercises } from "@/data/local/exercises";
import { subscribeToSleep } from "@/data/local/sleepStore";
import { subscribeToMoods } from "@/data/local/moodsStore";
import { subscribeToJournal } from "@/data/local/journalStore";
import { computeSleepScore, computeSleepDebt, computeSleepRecoveryReadiness } from "@/intelligence/sleepIntelligence";
import { computeRecoveryScore, detectOvertraining } from "@/intelligence/recoveryHeuristics";
import { computeNutritionScore } from "@/intelligence/nutritionIntelligence";
import { computeHabitScore, computeHabitStats } from "@/intelligence/habitIntelligence";
import { computeCompositeWellnessScore } from "@/intelligence/wellnessScore";
import { computeWeeklyComparison } from "@/intelligence/longitudinalEngine";
import type { WellnessScore, CompositeWellnessScore, SleepDebt, WeeklyComparison, OvertrainingSignal } from "@/intelligence/types";
import type { HabitStats } from "@/intelligence/habitIntelligence";

type UserProfile = {
  dob?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  goal?: string;
} | null;

export type WellnessIntelligence = {
  composite: CompositeWellnessScore;
  sleep: WellnessScore;
  recovery: WellnessScore;
  nutrition: WellnessScore;
  habits: WellnessScore;
  habitStats: HabitStats[];
  sleepDebt: SleepDebt;
  recoveryReadiness: { score: number; label: string; context: string };
  overtraining: OvertrainingSignal;
  weeklyComparison: WeeklyComparison;
};

function compute(profile: UserProfile): WellnessIntelligence {
  return {
    composite: computeCompositeWellnessScore(profile),
    sleep: computeSleepScore(),
    recovery: computeRecoveryScore(),
    nutrition: computeNutritionScore(profile),
    habits: computeHabitScore(),
    habitStats: computeHabitStats(),
    sleepDebt: computeSleepDebt(),
    recoveryReadiness: computeSleepRecoveryReadiness(),
    overtraining: detectOvertraining(),
    weeklyComparison: computeWeeklyComparison(),
  };
}

export function useWellnessIntelligence(profile: UserProfile): WellnessIntelligence {
  const [intelligence, setIntelligence] = useState<WellnessIntelligence>(
    () => compute(profile),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    const refresh = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIntelligence(compute(profileRef.current));
      }, 250);
    };

    const unsubs = [
      subscribeToMeals(refresh),
      subscribeToExercises(refresh),
      subscribeToSleep(refresh),
      subscribeToMoods(refresh),
      subscribeToJournal(refresh),
    ];

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      unsubs.forEach((u) => u());
    };
  }, []);

  return intelligence;
}
