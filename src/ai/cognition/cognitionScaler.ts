// Adaptive cognition quality scaler — derives how deeply WellMate "thinks"
// based on runtime state: governor policy, device class, thermal, and battery.
//
// Quality tiers (ascending depth):
//   minimal        — no retrieval; stub-length response; used under thermal/battery emergency
//   efficient      — shallow retrieval (≤3 chunks); direct answer only
//   balanced       — normal WellMate response; retrieval + summarization
//   reflective     — richer reflection; deep retrieval; memory synthesis
//   deep_reflection — full synthesis: longitudinal memory + retrieval + journal analysis
//
// Degradation is designed to feel graceful — responses become shorter and simpler,
// not absent or broken. "minimal" still produces a useful wellness reply.

import type { RuntimeMode } from "../runtime/runtimeGovernor";
import type { CapabilityClass } from "../platform/capabilityClassifier";

export type CognitionQuality =
  | "minimal"
  | "efficient"
  | "balanced"
  | "reflective"
  | "deep_reflection";

export type CognitionProfile = {
  quality: CognitionQuality;
  maxTokens: number;
  retrievalDepth: number;
  enableSummarization: boolean;
  enableMemorySynthesis: boolean;
  enableJournalAnalysis: boolean;
  streamingThrottleMs: number;
  reason: string;
};

const QUALITY_SPECS: Record<CognitionQuality, Omit<CognitionProfile, "quality" | "reason">> = {
  minimal: {
    maxTokens: 64, retrievalDepth: 0, enableSummarization: false,
    enableMemorySynthesis: false, enableJournalAnalysis: false, streamingThrottleMs: 0,
  },
  efficient: {
    maxTokens: 128, retrievalDepth: 3, enableSummarization: false,
    enableMemorySynthesis: false, enableJournalAnalysis: false, streamingThrottleMs: 0,
  },
  balanced: {
    maxTokens: 192, retrievalDepth: 5, enableSummarization: true,
    enableMemorySynthesis: false, enableJournalAnalysis: false, streamingThrottleMs: 0,
  },
  reflective: {
    maxTokens: 256, retrievalDepth: 7, enableSummarization: true,
    enableMemorySynthesis: true, enableJournalAnalysis: false, streamingThrottleMs: 0,
  },
  deep_reflection: {
    maxTokens: 384, retrievalDepth: 10, enableSummarization: true,
    enableMemorySynthesis: true, enableJournalAnalysis: true, streamingThrottleMs: 0,
  },
};

function deriveQuality(
  mode: RuntimeMode,
  capClass: CapabilityClass | undefined,
  thermal: string,
  batteryPct: number | null,
): CognitionQuality {
  if (mode === "suspended") return "minimal";
  if (thermal === "critical" || thermal === "emergency") return "minimal";
  if (mode === "minimal") return "minimal";
  if (batteryPct !== null && batteryPct < 15) return "efficient";
  if (mode === "conservative") return "efficient";
  if (mode === "efficient") {
    if (!capClass || capClass === "LOW_END") return "efficient";
    if (thermal === "hot") return "efficient";
    return "balanced";
  }
  // full mode — scale by device class
  if (!capClass || capClass === "LOW_END") return "balanced";
  if (capClass === "MID_RANGE") return "reflective";
  return "deep_reflection";
}

// ── Pub/sub ────────────────────────────────────────────────────────────────────

type ProfileListener = (profile: CognitionProfile) => void;
const _listeners = new Set<ProfileListener>();

export function subscribeToCognitionProfile(fn: ProfileListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function notifyListeners(profile: CognitionProfile): void {
  _listeners.forEach((fn) => { try { fn(profile); } catch { /* */ } });
}

// ── Main export ────────────────────────────────────────────────────────────────

export function getCognitionProfile(opts?: { batteryPct?: number | null }): CognitionProfile {
  const batteryPct = opts?.batteryPct ?? null;

  // Lazy-resolved to avoid circular dep at import time
  let mode: RuntimeMode = "full";
  let capClass: CapabilityClass | undefined;
  let thermal = "nominal";

  try {
    const { getCurrentPolicy } = require("../runtime/runtimeGovernor") as typeof import("../runtime/runtimeGovernor");
    mode = getCurrentPolicy().mode;
  } catch { /* governor not yet initialized */ }

  try {
    const { getCapabilitiesSync } = require("../platform/capabilityClassifier") as typeof import("../platform/capabilityClassifier");
    capClass = getCapabilitiesSync()?.capabilityClass;
  } catch { /* classifier not yet ready */ }

  try {
    const { getThermalState } = require("../runtime/thermalGuard") as typeof import("../runtime/thermalGuard");
    thermal = getThermalState();
  } catch { /* */ }

  const quality = deriveQuality(mode, capClass, thermal, batteryPct);
  const spec = QUALITY_SPECS[quality];

  let maxTokens = spec.maxTokens;
  try {
    const { getCurrentPolicy } = require("../runtime/runtimeGovernor") as typeof import("../runtime/runtimeGovernor");
    maxTokens = Math.min(spec.maxTokens, getCurrentPolicy().maxGenerationTokens);
  } catch { /* */ }

  const reason = [
    `governor=${mode}`,
    `thermal=${thermal}`,
    capClass ? `class=${capClass}` : null,
    batteryPct !== null ? `battery=${batteryPct}%` : null,
  ].filter(Boolean).join("; ");

  return { quality, ...spec, maxTokens, reason };
}

// Wire up reactive updates — call once from orchestrator startup
let _wired = false;

export function initCognitionScaler(): void {
  if (_wired) return;
  _wired = true;

  import("../runtime/runtimeGovernor").then(({ subscribeToPolicy }) => {
    subscribeToPolicy(() => notifyListeners(getCognitionProfile()));
  }).catch(() => null);
}
