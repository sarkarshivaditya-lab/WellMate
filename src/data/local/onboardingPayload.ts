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

/* ======================================================
   ONBOARDING DRAFT — IN-PROGRESS FORM STATE
   Persists the user's work-in-progress across reloads,
   auth redirects, and app-backgrounding so no data is
   lost before finish() is called.
   ====================================================== */

export type OnboardingDraft = {
  step: number;
  dob: string;
  sex: string;
  height: string;
  heightUnit: "cm" | "ftin";
  heightFt: string;
  heightIn: string;
  weight: string;
  activityLevel: string | null;
  dailySteps: string;
  weightGoal: string;
  muscleGoal: string;
  cycleLength: string;
  lastPeriod: string;
  additionalHealthChoice: string;
  additionalHealthNotes: string;
};

const DRAFT_KEY = "onboarding_draft";

export function readOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
}

export function clearOnboardingDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
