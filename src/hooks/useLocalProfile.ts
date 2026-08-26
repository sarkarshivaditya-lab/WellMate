import { useMemo } from "react";
import {
  readOnboardingPayload,
  type EmergencyContactPayload,
} from "@/data/local/onboardingPayload";

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
  bloodType?: string;
  allergies?: string[];
  emergencyContacts?: EmergencyContactPayload[];
  createdAt: number;
};

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
