// Adaptive retrieval policy — governor-aware retrieval parameters.
// Bridges the runtime governor's policy mode with retrieval pipeline configuration.
//
// Without this, retrieval ignores thermal state, memory pressure, and device class —
// burning resources regardless of runtime conditions. This module makes retrieval
// a first-class participant in the adaptive runtime.
//
// Usage: call getAdaptiveRetrievalPolicy() before any retrieval operation,
// then pass topK/minScore to the retrievalBridge query.

import { getCurrentPolicy } from "../runtime/runtimeGovernor";
import { getThermalState } from "../runtime/thermalGuard";
import { getCapabilitiesSync } from "../platform/capabilityClassifier";

export type AdaptiveRetrievalPolicy = {
  topK: number;
  minScore: number;
  maxContextBytes: number;
  embeddingSearchBreadth: number; // vector search candidate multiplier
  rerankingEnabled: boolean;
  memoryRecallLimit: number;      // max injected memory items
  reason: string;
};

const MODE_DEFAULTS: Record<string, AdaptiveRetrievalPolicy> = {
  full: {
    topK: 10, minScore: 0.15, maxContextBytes: 4096, embeddingSearchBreadth: 2,
    rerankingEnabled: true, memoryRecallLimit: 8, reason: "full",
  },
  efficient: {
    topK: 7, minScore: 0.2, maxContextBytes: 3072, embeddingSearchBreadth: 1,
    rerankingEnabled: true, memoryRecallLimit: 6, reason: "efficient",
  },
  conservative: {
    topK: 5, minScore: 0.25, maxContextBytes: 2048, embeddingSearchBreadth: 1,
    rerankingEnabled: false, memoryRecallLimit: 4, reason: "conservative",
  },
  minimal: {
    topK: 3, minScore: 0.3, maxContextBytes: 1024, embeddingSearchBreadth: 1,
    rerankingEnabled: false, memoryRecallLimit: 2, reason: "minimal",
  },
  suspended: {
    topK: 0, minScore: 1.0, maxContextBytes: 0, embeddingSearchBreadth: 0,
    rerankingEnabled: false, memoryRecallLimit: 0, reason: "suspended",
  },
};

// Thermal multiplier for topK — hot device = shallower retrieval
function thermalTopKMultiplier(thermal: string): number {
  if (thermal === "critical" || thermal === "emergency") return 0.3;
  if (thermal === "hot") return 0.55;
  if (thermal === "warm") return 0.8;
  return 1.0;
}

// Capability class multiplier for context window budget
function capsContextMultiplier(capClass: string | undefined): number {
  if (capClass === "LOW_END") return 0.4;
  if (capClass === "MID_RANGE") return 0.7;
  return 1.0;
}

export function getAdaptiveRetrievalPolicy(): AdaptiveRetrievalPolicy {
  const policy = getCurrentPolicy();
  const base = MODE_DEFAULTS[policy.mode] ?? MODE_DEFAULTS.conservative;

  const thermal = getThermalState();
  const caps = getCapabilitiesSync();

  const topK = Math.max(
    0,
    Math.min(
      Math.round(base.topK * thermalTopKMultiplier(thermal)),
      policy.retrievalDepth,
    ),
  );

  const maxContextBytes = Math.round(base.maxContextBytes * capsContextMultiplier(caps?.capabilityClass));

  const reason = [
    `mode=${policy.mode}`,
    `thermal=${thermal}`,
    caps?.capabilityClass ? `class=${caps.capabilityClass}` : null,
  ].filter(Boolean).join("; ");

  return { ...base, topK, maxContextBytes, reason };
}

// Constrain caller-provided retrieval opts to the current adaptive policy limits.
// Call site example:
//   const opts = constrainToPolicy({ topK: 10, minScore: 0.1 });
export function constrainToPolicy(opts: {
  topK?: number;
  minScore?: number;
}): { topK: number; minScore: number } {
  const policy = getAdaptiveRetrievalPolicy();
  return {
    topK: Math.min(opts.topK ?? policy.topK, policy.topK),
    minScore: Math.max(opts.minScore ?? policy.minScore, policy.minScore),
  };
}
