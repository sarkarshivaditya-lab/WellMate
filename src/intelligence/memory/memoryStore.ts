// src/intelligence/memory/memoryStore.ts
// Local-first persistence for the wellness memory context.
// Versioned, TTL-gated — rebuilds at most every 4 hours.

import type { WellnessMemoryContext } from "./types";

const STORAGE_KEY = "wellmate_memory_context_v1";
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type StoredMemory = {
  version: 1;
  context: WellnessMemoryContext;
};

export function loadMemoryContext(): WellnessMemoryContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredMemory;
    if (stored.version !== 1) return null;
    return stored.context;
  } catch {
    return null;
  }
}

export function saveMemoryContext(context: WellnessMemoryContext): void {
  try {
    const stored: StoredMemory = { version: 1, context };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

// Returns cached context if still within TTL, otherwise null.
export function getCachedMemoryContext(): WellnessMemoryContext | null {
  const ctx = loadMemoryContext();
  if (!ctx) return null;
  if (Date.now() - ctx.generatedAt > TTL_MS) return null;
  return ctx;
}

export function clearMemoryCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
