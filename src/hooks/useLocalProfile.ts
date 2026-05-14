import { useMemo } from "react";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";

/**
 * The canonical local profile shape — derived from onboarding_profile
 * and used as primary data source for all health calculations.
 *
 * This is local-first and device-resident. The `goal` field is the
 * normalized form of `weightGoal` (Convex-compatible naming).
 */
export type LocalProfile = {
  dob: string;
  sex: "male" | "female" | "other" | "";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "veryActive" | null;
  goal: "lose" | "maintain" | "gain" | null;
  weightGoal: string;
  muscleGoal: string;
  dailySteps: string;
  cycleLength?: number;
  lastPeriod?: string;
  additionalHealthNotes?: string;
  createdAt: number;
};

/**
 * Reads the completed onboarding profile from local storage.
 *
 * Returns immediately (no network, no auth dependency).
 * Returns null if onboarding has not been completed.
 *
 * The profile is stable for the lifetime of the session — it is written
 * once at onboarding completion and never modified by in-app navigation.
 */
export function useLocalProfile(): LocalProfile | null {
  return useMemo(() => {
    const payload = readOnboardingPayload();
    if (!payload) return null;

    const goal: "lose" | "maintain" | "gain" | null =
      payload.weightGoal === "lose" ||
      payload.weightGoal === "maintain" ||
      payload.weightGoal === "gain"
        ? payload.weightGoal
        : null;

    return { ...payload, goal };
  }, []);
}
