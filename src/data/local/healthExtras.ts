const EXTRAS_KEY = "wellmate_health_extras_v1";
const PROFILE_UPDATED_EVENT = "wellmate:profile-updated";

export type HealthExtras = {
  dietaryRestrictions: string[];
  allergies: string[];
  medicalConditions: string[];
  injuries: string[];
  medications: string[];
  exerciseLimitations: string[];
  recoveryNotes: string;
  mentalWellnessNotes: string;
  accessibilityNeeds: string[];
};

const DEFAULTS: HealthExtras = {
  dietaryRestrictions: [],
  allergies: [],
  medicalConditions: [],
  injuries: [],
  medications: [],
  exerciseLimitations: [],
  recoveryNotes: "",
  mentalWellnessNotes: "",
  accessibilityNeeds: [],
};

export function readHealthExtras(): HealthExtras {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveHealthExtras(patch: Partial<HealthExtras>): void {
  try {
    const updated = { ...readHealthExtras(), ...patch };
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
  } catch {
    // swallow
  }
}
