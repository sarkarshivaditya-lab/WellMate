/* ONBOARDING PAYLOAD — LOCAL FIRST */

/**
 * Data captured before authentication is established.
 * The completed local snapshot remains the canonical onboarding/profile source.
 */
export type EmergencyContactPayload = {
  id: string;
  name: string;
  phone: string;
};

export type OnboardingPayload = {
  dob: string;
  sex: "male" | "female" | "other" | "";
  heightCm: number;
  weightKg: number;
  activityLevel:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "veryActive"
    | null;
  dailySteps: string;
  weightGoal: string;
  muscleGoal: string;
  cycleLength?: number;
  lastPeriod?: string;
  additionalHealthNotes?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContacts?: EmergencyContactPayload[];
  createdAt: number;
};

const STORAGE_KEY = "onboarding_profile";

export function readOnboardingPayload(): OnboardingPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPayload;
  } catch {
    return null;
  }
}

export function clearOnboardingPayload(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

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
  bloodType: string;
  allergies: string;
  emergencyContacts: EmergencyContactPayload[];
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
    // ignore storage errors
  }
}
