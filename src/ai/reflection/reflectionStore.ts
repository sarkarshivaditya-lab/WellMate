// TTL-keyed store for AI-generated reflections.
// Each reflection type is stored independently with a 4-hour TTL.
// On expiry the slot is treated as empty — caller decides whether to regenerate.

import { safeRead, safeWrite } from "@/reliability/persistence";

export type ReflectionType = "daily" | "journal" | "continuity";

export type StoredReflection = {
  type: ReflectionType;
  text: string;
  generatedAt: number;
  confidence: number;  // 0–1 from presence rules
  safetyScore: number; // 0–1 from output filter
};

const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function storageKey(type: ReflectionType): string {
  return `ai_reflection_${type}_v1`;
}

export function getStoredReflection(type: ReflectionType): StoredReflection | null {
  const raw = safeRead<StoredReflection | null>(storageKey(type), null);
  if (!raw) return null;
  if (Date.now() - raw.generatedAt > TTL_MS) return null;
  return raw;
}

export function storeReflection(reflection: StoredReflection): void {
  safeWrite(storageKey(reflection.type), reflection);
}

export function isReflectionStale(type: ReflectionType): boolean {
  const raw = safeRead<StoredReflection | null>(storageKey(type), null);
  if (!raw) return true;
  return Date.now() - raw.generatedAt > TTL_MS;
}

export function clearReflection(type: ReflectionType): void {
  try {
    localStorage.removeItem(storageKey(type));
  } catch {
    // storage unavailable — safe to ignore
  }
}
