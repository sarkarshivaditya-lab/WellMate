// src/personalization/adaptationStore.ts
// Persists the adaptive profile to localStorage with a 4-hour TTL.

import type { AdaptiveProfile } from "./types";

const STORAGE_KEY = "wellmate_adaptive_profile_v1";
const TTL_MS = 4 * 60 * 60 * 1000;

type StoredProfile = {
  version: 1;
  profile: AdaptiveProfile;
  cachedAt: number;
};

function load(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedAdaptiveProfile(): AdaptiveProfile | null {
  const stored = load();
  if (!stored) return null;
  if (Date.now() - stored.cachedAt > TTL_MS) return null;
  return stored.profile;
}

export function saveAdaptiveProfile(profile: AdaptiveProfile): void {
  try {
    const stored: StoredProfile = { version: 1, profile, cachedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // quota exceeded — silently ignore; profile will recompute next session
  }
}

export function clearAdaptiveProfileCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-fatal
  }
}
