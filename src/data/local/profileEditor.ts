import {
  readOnboardingPayload,
  OnboardingPayload,
} from "./onboardingPayload";

const STORAGE_KEY = "onboarding_profile";
const PROFILE_UPDATED_EVENT = "wellmate:profile-updated";

const CACHE_KEYS = [
  "wellmate_adaptive_profile_v1",
  "wellmate_recommendations_v1",
  "wellmate_memory_context_v1",
  "wellmate_daily_summaries_v1",
];

export function saveProfilePatch(
  patch: Partial<Omit<OnboardingPayload, "createdAt">>,
): void {
  const existing = readOnboardingPayload();
  if (!existing) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...existing, ...patch }),
    );
    CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));
  } catch {
    // swallow storage errors
  }
}

export function subscribeToProfileUpdates(cb: () => void): () => void {
  window.addEventListener(PROFILE_UPDATED_EVENT, cb);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, cb);
}
