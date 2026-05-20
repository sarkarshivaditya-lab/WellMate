// Quantization-Aware Runtime Router — intelligent model variant selection.
//
// Selects the optimal quantization for the current device, thermal state, and
// memory availability. The goal: highest quality inference that the device can
// sustain without throttling or OOM.
//
// Quantization profiles (for 7B-class models):
//   Q2_K   — 2-bit:  ~1.5GB RAM, ~4 tok/s,  poor quality  — constrained devices only
//   Q4_K_S — 4-bit small: ~2.2GB RAM, ~8 tok/s, acceptable quality
//   Q4_K_M — 4-bit mid:   ~2.5GB RAM, ~8 tok/s, good quality (default mobile target)
//   Q5_K_M — 5-bit mid:   ~3.2GB RAM, ~6 tok/s, very good quality
//   Q8_0   — 8-bit:  ~7.0GB RAM, ~3 tok/s,  near-full quality — high-end only
//
// Routing priority: memory safety > thermal headroom > throughput > quality

import { getMemoryGovernorReport } from "../runtime/memoryGovernor";
import { getThroughputSummary } from "../runtime/throughputProfiler";
import { getThermalState } from "../runtime/thermalGuard";
import { computeThreadScaleDecision } from "../runtime/adaptiveThreadScaler";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuantizationId = "Q2_K" | "Q4_K_S" | "Q4_K_M" | "Q5_K_M" | "Q8_0";

export type QuantizationProfile = {
  id: QuantizationId;
  displayName: string;
  bitsPerWeight: number;
  estimatedRamGb: number;      // for 7B model
  targetTokPerSec: number;     // expected on mid-range device
  qualityScore: number;        // 0-100 relative to F16
  thermalLoad: "low" | "moderate" | "high";
  minRamGb: number;            // minimum RAM to run safely
};

export type SuitabilityScore = {
  profileId: QuantizationId;
  score: number;               // 0-100: higher = better fit for this device now
  memoryFit: boolean;
  thermalFit: boolean;
  throughputFit: boolean;
  disqualifyReason: string | null;
};

export type RoutingDecision = {
  selected: QuantizationId;
  fallback: QuantizationId;
  suitabilityScores: SuitabilityScore[];
  routingReason: string;
  thermalState: string;
  availableRamGb: number | null;
  decidedAt: number;
};

// ── Profile registry ───────────────────────────────────────────────────────────

export const QUANTIZATION_PROFILES: Record<QuantizationId, QuantizationProfile> = {
  Q2_K: {
    id: "Q2_K", displayName: "Q2_K (Extreme Compression)",
    bitsPerWeight: 2, estimatedRamGb: 1.5, targetTokPerSec: 4, qualityScore: 35,
    thermalLoad: "low", minRamGb: 2,
  },
  Q4_K_S: {
    id: "Q4_K_S", displayName: "Q4_K_S (4-bit Small)",
    bitsPerWeight: 4, estimatedRamGb: 2.2, targetTokPerSec: 9, qualityScore: 60,
    thermalLoad: "moderate", minRamGb: 3,
  },
  Q4_K_M: {
    id: "Q4_K_M", displayName: "Q4_K_M (4-bit Medium, Recommended)",
    bitsPerWeight: 4, estimatedRamGb: 2.5, targetTokPerSec: 8, qualityScore: 68,
    thermalLoad: "moderate", minRamGb: 3.5,
  },
  Q5_K_M: {
    id: "Q5_K_M", displayName: "Q5_K_M (5-bit Medium)",
    bitsPerWeight: 5, estimatedRamGb: 3.2, targetTokPerSec: 6, qualityScore: 80,
    thermalLoad: "high", minRamGb: 5,
  },
  Q8_0: {
    id: "Q8_0", displayName: "Q8_0 (8-bit, Near-Full Quality)",
    bitsPerWeight: 8, estimatedRamGb: 7.0, targetTokPerSec: 3, qualityScore: 95,
    thermalLoad: "high", minRamGb: 9,
  },
};

const PROFILE_PRIORITY: QuantizationId[] = ["Q8_0", "Q5_K_M", "Q4_K_M", "Q4_K_S", "Q2_K"];

// ── Performance history ───────────────────────────────────────────────────────

const PERF_HISTORY_KEY = "ai_quant_perf_history_v1";
const MAX_PERF_HISTORY = 50;

type PerfRecord = {
  profileId: QuantizationId;
  tokPerSec: number;
  thermalState: string;
  recordedAt: number;
};

export function recordInferencePerformance(profileId: QuantizationId, tokPerSec: number, thermalState: string): void {
  try {
    const history: PerfRecord[] = JSON.parse(localStorage.getItem(PERF_HISTORY_KEY) ?? "[]");
    history.push({ profileId, tokPerSec, thermalState, recordedAt: Date.now() });
    localStorage.setItem(PERF_HISTORY_KEY, JSON.stringify(history.slice(-MAX_PERF_HISTORY)));
  } catch { /* */ }
}

function getObservedTokPerSec(profileId: QuantizationId): number | null {
  try {
    const history: PerfRecord[] = JSON.parse(localStorage.getItem(PERF_HISTORY_KEY) ?? "[]");
    const relevant = history.filter((r) => r.profileId === profileId);
    if (!relevant.length) return null;
    return relevant.reduce((s, r) => s + r.tokPerSec, 0) / relevant.length;
  } catch { return null; }
}

// ── Suitability scoring ────────────────────────────────────────────────────────

function getAvailableRamGb(): number | null {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? null;
}

function scoreProfile(profile: QuantizationProfile): SuitabilityScore {
  const ramGb = getAvailableRamGb();
  const thermal = getThermalState();
  const throughput = getThroughputSummary();
  const threadDecision = computeThreadScaleDecision();

  let score = 50;
  let disqualifyReason: string | null = null;

  // Memory fit
  const memoryFit = ramGb === null || ramGb >= profile.minRamGb;
  if (!memoryFit) {
    disqualifyReason = `requires ${profile.minRamGb}GB RAM (device: ${ramGb}GB)`;
    return { profileId: profile.id, score: 0, memoryFit: false, thermalFit: false, throughputFit: false, disqualifyReason };
  }

  // Memory governor check
  const memReport = getMemoryGovernorReport();
  if (memReport.currentTier === "critical" && profile.estimatedRamGb > 2) {
    disqualifyReason = "memory tier critical — too large";
    return { profileId: profile.id, score: 0, memoryFit: false, thermalFit: false, throughputFit: false, disqualifyReason };
  }
  if (ramGb) {
    const headroomGb = ramGb - profile.estimatedRamGb;
    score += Math.min(20, headroomGb * 5);
  }

  // Thermal fit
  const thermalFit = !(
    (thermal === "hot" && profile.thermalLoad === "high") ||
    thermal === "critical" || thermal === "emergency"
  );
  if (!thermalFit) {
    score -= 30;
    if (thermal === "critical" || thermal === "emergency") {
      disqualifyReason = `thermal ${thermal} — unsafe for ${profile.thermalLoad} load model`;
    }
  } else {
    score += 15;
  }

  // Throughput fit
  const observed = getObservedTokPerSec(profile.id);
  const expected = observed ?? profile.targetTokPerSec;
  const throughputFit = expected >= 4; // minimum viable tok/s
  if (!throughputFit) score -= 20;
  else score += Math.min(10, (expected / 10) * 10);

  // Thread scaling
  if (threadDecision.scalingFactor < 0.5 && profile.thermalLoad === "high") score -= 15;

  // Quality bonus
  score += Math.round(profile.qualityScore * 0.1);

  // Device class bonus/penalty
  if (throughput.deviceClass === "constrained" && profile.estimatedRamGb > 3) score -= 20;
  if (throughput.deviceClass === "high_end" && profile.qualityScore > 70) score += 10;

  return {
    profileId: profile.id,
    score: Math.max(0, Math.min(100, Math.round(score))),
    memoryFit,
    thermalFit,
    throughputFit,
    disqualifyReason,
  };
}

// ── Routing decision ──────────────────────────────────────────────────────────

export function getRoutingDecision(): RoutingDecision {
  const scores = PROFILE_PRIORITY.map((id) => scoreProfile(QUANTIZATION_PROFILES[id]));
  const qualified = scores.filter((s) => s.disqualifyReason === null && s.score > 0);
  const sorted = [...qualified].sort((a, b) => b.score - a.score);

  const selected = sorted[0]?.profileId ?? "Q4_K_M";
  const fallback = sorted[1]?.profileId ?? "Q4_K_S";

  const memReport = getMemoryGovernorReport();
  const thermal = getThermalState();
  const ramGb = getAvailableRamGb();

  let routingReason = `selected ${selected}: score ${sorted[0]?.score ?? 0}/100`;
  if (thermal === "hot") routingReason += " (thermal-aware downgrade considered)";
  if (memReport.currentTier === "tight") routingReason += " (memory pressure active)";

  return {
    selected,
    fallback,
    suitabilityScores: scores,
    routingReason,
    thermalState: thermal,
    availableRamGb: ramGb,
    decidedAt: Date.now(),
  };
}

export function getQuantizationProfiles(): QuantizationProfile[] {
  return PROFILE_PRIORITY.map((id) => QUANTIZATION_PROFILES[id]);
}
