// Long-session stability guard — protects multi-hour runtime sessions from degradation.
//
// Monitors: memory pressure, inference accumulation, cache staleness, storage growth.
// Runs periodic self-heal actions before degradation becomes user-visible.
//
// Self-heal actions (every 30 min):
//   prune_caches     — remove completed background jobs older than 24h
//   evict_old_models — free evictable model storage if > 500 MB available to reclaim
//
// The guard operates silently. It never blocks inference — it works in the margins.

import { getDetailedSnapshot } from "./performanceProfiler";
import { getTodayRecord } from "./performanceHistory";

export type SessionHealthStatus = "healthy" | "degraded" | "critical";

export type SessionHealthReport = {
  status: SessionHealthStatus;
  sessionDurationMs: number;
  sessionInferenceCount: number;
  memoryPressureLevel: string | null;
  cacheCleanupDue: boolean;
  storageHealthy: boolean;
  stabilityScore: number;
  lastSelfHealAt: number | null;
  issues: string[];
  recommendations: string[];
};

const SESSION_START = Date.now();
const SELF_HEAL_INTERVAL_MS = 30 * 60 * 1_000;
const CACHE_PRUNE_INTERVAL_MS = 15 * 60 * 1_000;
const HIGH_SESSION_INFERENCE_THRESHOLD = 200;

let _sessionInferenceCount = 0;
let _lastSelfHealAt: number | null = null;
let _lastCachePruneAt = Date.now();
let _healTimer: ReturnType<typeof setInterval> | null = null;

// ── Inference tracking ─────────────────────────────────────────────────────────

export function recordSessionInference(): void {
  _sessionInferenceCount++;
}

export function getSessionInferenceCount(): number {
  return _sessionInferenceCount;
}

// ── Health assessment ──────────────────────────────────────────────────────────

export async function getSessionHealth(): Promise<SessionHealthReport> {
  const now = Date.now();
  const issues: string[] = [];
  const recommendations: string[] = [];

  const profilerSnap = getDetailedSnapshot();
  const memoryPressureLevel = profilerSnap.memoryPressure?.level ?? null;
  if (memoryPressureLevel === "high") {
    issues.push("High heap memory pressure");
    recommendations.push("Reduce inference frequency or reload the page");
  }

  if (_sessionInferenceCount > HIGH_SESSION_INFERENCE_THRESHOLD) {
    issues.push(`Very high session inference count (${_sessionInferenceCount})`);
    recommendations.push("Consider reloading after extended session");
  }

  const cacheCleanupDue = now - _lastCachePruneAt > CACHE_PRUNE_INTERVAL_MS;
  if (cacheCleanupDue) recommendations.push("Cache prune is due");

  let storageHealthy = true;
  try {
    const { getHistoryStorageBytes } = await import("./performanceHistory");
    const bytes = getHistoryStorageBytes();
    if (bytes > 100_000) {
      issues.push(`Performance history large (${Math.round(bytes / 1024)} KB)`);
      storageHealthy = false;
    }
  } catch { /* non-fatal */ }

  const today = getTodayRecord();
  if (today.modelStabilityScore < 70) {
    issues.push(`Low stability score today (${today.modelStabilityScore})`);
    recommendations.push("Review failure events for patterns");
  }

  const status: SessionHealthStatus =
    memoryPressureLevel === "high" || today.modelStabilityScore < 50
      ? "critical"
      : issues.length > 0
      ? "degraded"
      : "healthy";

  return {
    status,
    sessionDurationMs: now - SESSION_START,
    sessionInferenceCount: _sessionInferenceCount,
    memoryPressureLevel,
    cacheCleanupDue,
    storageHealthy,
    stabilityScore: today.modelStabilityScore,
    lastSelfHealAt: _lastSelfHealAt,
    issues,
    recommendations,
  };
}

// ── Self-heal ──────────────────────────────────────────────────────────────────

type HealAction = "prune_caches" | "evict_old_models";

export async function runSelfHeal(): Promise<HealAction[]> {
  const now = Date.now();
  const actioned: HealAction[] = [];

  if (now - _lastCachePruneAt > CACHE_PRUNE_INTERVAL_MS) {
    try {
      const { pruneCompletedJobs } = await import("../platform/backgroundJobQueue");
      pruneCompletedJobs();
      actioned.push("prune_caches");
      _lastCachePruneAt = now;
    } catch { /* non-fatal */ }
  }

  try {
    const { getStorageInventory, evictInactiveModels } = await import("../storage/storageAccountant");
    const inv = await getStorageInventory();
    if (inv.evictableBytes > 500 * 1024 * 1024) {
      await evictInactiveModels();
      actioned.push("evict_old_models");
    }
  } catch { /* non-fatal */ }

  _lastSelfHealAt = now;
  return actioned;
}

// ── Guard lifecycle ────────────────────────────────────────────────────────────

export function startSessionGuard(): void {
  if (_healTimer) return;
  _healTimer = setInterval(() => {
    void runSelfHeal().catch(() => null);
  }, SELF_HEAL_INTERVAL_MS);
}

export function stopSessionGuard(): void {
  if (_healTimer) {
    clearInterval(_healTimer);
    _healTimer = null;
  }
}
