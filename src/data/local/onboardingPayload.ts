/* ONBOARDING PAYLOAD — LOCAL FIRST */

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

function isEmergencyContact(value: unknown): value is EmergencyContactPayload {
  if (!value || typeof value !== "object") return false;
  const contact = value as Record<string, unknown>;
  return (
    typeof contact.id === "string" &&
    typeof contact.name === "string" &&
    typeof contact.phone === "string"
  );
}

export function readOnboardingPayload(): OnboardingPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<OnboardingPayload>;
    if (
      typeof value.dob !== "string" ||
      typeof value.sex !== "string" ||
      typeof value.heightCm !== "number" ||
      !Number.isFinite(value.heightCm) ||
      typeof value.weightKg !== "number" ||
      !Number.isFinite(value.weightKg)
    ) {
      return null;
    }

    const contacts = Array.isArray(value.emergencyContacts)
      ? value.emergencyContacts.filter(isEmergencyContact)
      : undefined;
    const allergies = Array.isArray(value.allergies)
      ? value.allergies.filter((item): item is string => typeof item === "string")
      : undefined;

    return {
      dob: value.dob,
      sex: value.sex as OnboardingPayload["sex"],
      heightCm: value.heightCm,
      weightKg: value.weightKg,
      activityLevel: value.activityLevel ?? null,
      dailySteps: value.dailySteps ?? "",
      weightGoal: value.weightGoal ?? "",
      muscleGoal: value.muscleGoal ?? "",
      cycleLength: typeof value.cycleLength === "number" ? value.cycleLength : undefined,
      lastPeriod: typeof value.lastPeriod === "string" ? value.lastPeriod : undefined,
      additionalHealthNotes:
        typeof value.additionalHealthNotes === "string" ? value.additionalHealthNotes : undefined,
      bloodType: typeof value.bloodType === "string" ? value.bloodType : undefined,
      allergies,
      emergencyContacts: contacts,
      createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    };
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
