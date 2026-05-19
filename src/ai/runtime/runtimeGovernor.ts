// Runtime Governor — the AI policy engine.
// Reads device capabilities, thermal state, and performance profile to compute
// a RuntimePolicy that every inference request must pass through before execution.
//
// The governor is the single authority on "how much AI can this device handle
// right now." No other module makes these decisions independently.
//
// Governor hierarchy (worse state wins):
//   device baseline (capability class)
//     → thermal modifier (warm/hot/critical/emergency)
//       → memory pressure modifier (> 85% heap usage)
//         → performance degradation modifier (p90 > degradation threshold)
//
// Resulting mode:
//   full          → no reduction (nominal, healthy)
//   efficient     → -10% tokens, same retrieval
//   conservative  → -30% tokens, -2 retrieval depth
//   minimal       → -50% tokens, -4 retrieval depth, defer heavy cognition
//   suspended     → no inference (thermal emergency)

import { getCapabilitiesSync, detectCapabilities } from "@/ai/platform/capabilityClassifier";
import { getThermalState } from "./thermalGuard";
import { getDetailedSnapshot, getMemoryPressure } from "./performanceProfiler";
import type { InferenceRequest } from "./types";
import type { CapabilityClass, InferenceParams } from "@/ai/platform/capabilityClassifier";

export type RuntimeMode =
  | "full"
  | "efficient"
  | "conservative"
  | "minimal"
  | "suspended";

export type RuntimePolicy = {
  mode: RuntimeMode;
  maxContextTokens: number;
  maxGenerationTokens: number;
  retrievalDepth: number;
  streamingThrottleMs: number;
  deferHeavyCognition: boolean;
  allowBackgroundTasks: boolean;
  reason: string;
  effectiveSince: number;
};

// ── Mode scale (lower = more restricted) ──────────────────────────────────────

const MODE_RANK: Record<RuntimeMode, number> = {
  suspended: 0,
  minimal: 1,
  conservative: 2,
  efficient: 3,
  full: 4,
};

// Latency threshold above which performance is considered degraded.
const P90_DEGRADATION_THRESHOLD_MS = 25_000; // 25s p90 = struggling device
const MEMORY_HIGH_PRESSURE_RATIO = 0.85;

// ── Mode derivation ────────────────────────────────────────────────────────────

function thermalMode(): RuntimeMode {
  const state = getThermalState();
  switch (state) {
    case "critical": return "minimal";
    case "hot":      return "conservative";
    case "warm":     return "efficient";
    default:         return "full";
  }
}

function memoryMode(): RuntimeMode {
  const mem = getMemoryPressure();
  if (!mem) return "full";
  if (mem.ratio > MEMORY_HIGH_PRESSURE_RATIO) return "conservative";
  return "full";
}

function performanceMode(): RuntimeMode {
  const snap = getDetailedSnapshot();
  if (snap.totalProfiled < 3) return "full"; // not enough data yet
  if (snap.p90LatencyMs > P90_DEGRADATION_THRESHOLD_MS) return "conservative";
  return "full";
}

function worstMode(...modes: RuntimeMode[]): RuntimeMode {
  return modes.reduce((worst, m) =>
    MODE_RANK[m] < MODE_RANK[worst] ? m : worst,
  );
}

// ── Parameter scaling by mode ──────────────────────────────────────────────────

function scaleParams(base: InferenceParams, mode: RuntimeMode): RuntimePolicy {
  switch (mode) {
    case "suspended":
      return {
        mode,
        maxContextTokens: 0,
        maxGenerationTokens: 0,
        retrievalDepth: 0,
        streamingThrottleMs: 0,
        deferHeavyCognition: true,
        allowBackgroundTasks: false,
        reason: "Thermal emergency — inference suspended",
        effectiveSince: Date.now(),
      };
    case "minimal":
      return {
        mode,
        maxContextTokens: Math.round(base.maxContextTokens * 0.5),
        maxGenerationTokens: Math.round(base.maxGenerationTokens * 0.5),
        retrievalDepth: Math.max(1, base.retrievalDepth - 4),
        streamingThrottleMs: Math.max(base.streamingThrottleMs, 80),
        deferHeavyCognition: true,
        allowBackgroundTasks: false,
        reason: "Critical thermal state — minimal mode",
        effectiveSince: Date.now(),
      };
    case "conservative":
      return {
        mode,
        maxContextTokens: Math.round(base.maxContextTokens * 0.7),
        maxGenerationTokens: Math.round(base.maxGenerationTokens * 0.7),
        retrievalDepth: Math.max(2, base.retrievalDepth - 2),
        streamingThrottleMs: Math.max(base.streamingThrottleMs, 40),
        deferHeavyCognition: true,
        allowBackgroundTasks: false,
        reason: "Elevated thermal or memory pressure — conservative mode",
        effectiveSince: Date.now(),
      };
    case "efficient":
      return {
        mode,
        maxContextTokens: Math.round(base.maxContextTokens * 0.9),
        maxGenerationTokens: Math.round(base.maxGenerationTokens * 0.9),
        retrievalDepth: base.retrievalDepth,
        streamingThrottleMs: base.streamingThrottleMs,
        deferHeavyCognition: false,
        allowBackgroundTasks: base.backgroundTasksAllowed,
        reason: "Warm thermal state — efficiency mode",
        effectiveSince: Date.now(),
      };
    default: // full
      return {
        mode: "full",
        maxContextTokens: base.maxContextTokens,
        maxGenerationTokens: base.maxGenerationTokens,
        retrievalDepth: base.retrievalDepth,
        streamingThrottleMs: base.streamingThrottleMs,
        deferHeavyCognition: false,
        allowBackgroundTasks: base.backgroundTasksAllowed,
        reason: "Nominal conditions",
        effectiveSince: Date.now(),
      };
  }
}

// ── Pub/sub ────────────────────────────────────────────────────────────────────

type PolicyListener = (policy: RuntimePolicy) => void;
const _listeners = new Set<PolicyListener>();
let _lastPolicy: RuntimePolicy | null = null;

function emit(policy: RuntimePolicy): void {
  _lastPolicy = policy;
  _listeners.forEach((fn) => { try { fn(policy); } catch { /* never crash */ } });
}

export function subscribeToPolicy(fn: PolicyListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Primary API ────────────────────────────────────────────────────────────────

export function getCurrentPolicy(): RuntimePolicy {
  const caps = getCapabilitiesSync();
  const base = caps?.params ?? {
    maxContextTokens: 1024,
    maxGenerationTokens: 192,
    retrievalDepth: 5,
    streamingThrottleMs: 20,
    memoryCleanupAggression: "moderate" as const,
    backgroundTasksAllowed: true,
  };

  const mode = worstMode(thermalMode(), memoryMode(), performanceMode());
  const policy = scaleParams(base, mode);

  // Only emit if mode changed to avoid noisy pub/sub
  if (!_lastPolicy || _lastPolicy.mode !== policy.mode) {
    emit(policy);
  } else {
    _lastPolicy = policy; // update params silently
  }

  return policy;
}

export function getLastPolicy(): RuntimePolicy | null {
  return _lastPolicy;
}

// Returns true if heavy background cognition (summarization, re-indexing) is allowed.
export function isHeavyCognitionAllowed(): boolean {
  const policy = getCurrentPolicy();
  return !policy.deferHeavyCognition;
}

// Applies governor policy to an inference request — returns adjusted copy.
// maxTokens is capped but never increased; priority requests bypass most caps.
export function applyGovernorPolicy(
  request: InferenceRequest,
  policy: RuntimePolicy,
): InferenceRequest {
  if (policy.mode === "suspended") {
    // Suspended mode: abort the request immediately
    request.controller.abort();
    return request;
  }

  const cappedMaxTokens = request.priority === "high"
    ? Math.min(request.maxTokens, policy.maxGenerationTokens * 1.5) // high-priority gets more headroom
    : Math.min(request.maxTokens, policy.maxGenerationTokens);

  return {
    ...request,
    maxTokens: Math.round(cappedMaxTokens),
  };
}

// Initialize capability detection on first governor use.
// Non-blocking — capabilities used on next policy evaluation.
export function initGovernor(): void {
  void detectCapabilities().catch(() => null);
}

// For the CapabilityClass type (needed by AIDevPanel)
export type { CapabilityClass };
