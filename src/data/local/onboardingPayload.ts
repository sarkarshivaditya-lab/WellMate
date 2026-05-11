/* ======================================================
   ONBOARDING PAYLOAD — LOCAL FIRST
   ====================================================== */

/**
 * This represents onboarding data captured
 * BEFORE authentication is established.
 *
 * It is:
 * - written by Onboarding.tsx
 * - consumed by AuthSyncBoundary
 * - promoted to Convex user profile exactly once
 */

export type OnboardingPayload = {
  // identity
  dob: string;
  sex: "male" | "female" | "other" | "";

  // body
  heightCm: number;
  weightKg: number;

  // activity
  activityLevel:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "veryActive"
    | null;

  dailySteps: string;

  // goals
  weightGoal: string;
  muscleGoal: string;

  // female health (optional)
  cycleLength?: number;
  lastPeriod?: string;

  // other health (optional)
  additionalHealthNotes?: string;

  // metadata
  createdAt: number;
};

/* ======================================================
   STORAGE HELPERS
   ====================================================== */

const STORAGE_KEY = "onboarding_profile";

export function readOnboardingPayload():
  | OnboardingPayload
  | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPayload;
  } catch {
    return null;
  }
}

export function clearOnboardingPayload() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
