// Memory governor — runtime memory budgeting and adaptive context management.
//
// Mobile devices share RAM between GPU, OS, and all apps. WellMate's WASM heap
// competes with the system. This module tracks estimated usage, detects heap
// pressure, and adapts inference parameters (primarily n_ctx) to avoid OOM.
//
// Key responsibilities:
//   - Context budget: derives safe n_ctx based on device RAM tier and current pressure
//   - Heap monitoring: tracks estimated WASM heap via performance.measureUserAgentSpecificMemory()
//     with fallback heuristic (inference count × avg tokens × bytes-per-token)
//   - Fragmentation detection: heap grows but inference size stable → fragmentation signal
//   - Model eviction scoring: when memory is critically low, rank models for eviction
//   - Pressure-triggered degradation: escalate through context reduction steps

import { getCurrentPolicy } from "./runtimeGovernor";
import { getThermalState } from "./thermalGuard";

const MEMORY_LOG_KEY = "ai_memory_governor_v1";
const MAX_LOG = 50;

export type MemoryTier = "unconstrained" | "comfortable" | "moderate" | "tight" | "critical";

export type HeapSnapshot = {
  estimatedHeapMb: number;
  method: "measurement_api" | "heuristic" | "unavailable";
  tier: MemoryTier;
  capturedAt: number;
};

export type ContextBudget = {
  recommendedNCtx: number;
  maxNCtx: number;
  minNCtx: number;
  reductionReason: string | null;
  tier: MemoryTier;
};

export type EvictionCandidate = {
  assetId: string;
  estimatedSizeMb: number;
  lastUsedAt: number;
  evictionScore: number; // 0-100; higher = evict first
};

export type MemoryGovernorReport = {
  currentTier: MemoryTier;
  deviceRamGb: number | null;
  estimatedHeapMb: number | null;
  recommendedNCtx: number;
  fragmentation: boolean;
  snapshots: HeapSnapshot[];
};

// ── Device RAM classification ──────────────────────────────────────────────────

function getDeviceRamGb(): number | null {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? null;
}

function classifyRamTier(gb: number | null): MemoryTier {
  if (gb === null) return "moderate"; // unknown — be conservative
  if (gb >= 8) return "unconstrained";
  if (gb >= 4) return "comfortable";
  if (gb >= 2) return "moderate";
  if (gb >= 1) return "tight";
  return "critical";
}

// ── Heap estimation ────────────────────────────────────────────────────────────

let _heuristicHeapMb = 0; // accumulated heuristic estimate

export function recordInferenceMemoryUsage(tokensGenerated: number): void {
  // ~2 bytes per token for BF16 KV cache approximation; ~300MB base for model load
  _heuristicHeapMb = Math.max(_heuristicHeapMb, 300 + (tokensGenerated * 2) / 1024);

  try {
    const log: HeapSnapshot[] = JSON.parse(localStorage.getItem(MEMORY_LOG_KEY) ?? "[]");
    log.push(takeHeapSnapshot());
    localStorage.setItem(MEMORY_LOG_KEY, JSON.stringify(log.slice(-MAX_LOG)));
  } catch { /* */ }
}

export function takeHeapSnapshot(): HeapSnapshot {
  const perf = performance as Performance & { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> };
  const ramGb = getDeviceRamGb();
  const tier = classifyRamTier(ramGb);

  // Use measurement API if available (Chrome 89+ with CrossOriginIsolated)
  if (perf.measureUserAgentSpecificMemory && typeof self !== "undefined" &&
    (self as typeof globalThis & { crossOriginIsolated?: boolean }).crossOriginIsolated) {
    // Can't await here; schedule async capture separately
    // Return heuristic for now
  }

  return {
    estimatedHeapMb: _heuristicHeapMb || null as unknown as number,
    method: _heuristicHeapMb > 0 ? "heuristic" : "unavailable",
    tier,
    capturedAt: Date.now(),
  };
}

// Async version that uses measureUserAgentSpecificMemory when available
export async function takeHeapSnapshotAsync(): Promise<HeapSnapshot> {
  const ramGb = getDeviceRamGb();
  const tier = classifyRamTier(ramGb);
  const perf = performance as Performance & { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> };

  if (perf.measureUserAgentSpecificMemory) {
    try {
      const result = await perf.measureUserAgentSpecificMemory();
      const mb = result.bytes / (1024 * 1024);
      _heuristicHeapMb = Math.max(_heuristicHeapMb, mb);
      return { estimatedHeapMb: mb, method: "measurement_api", tier, capturedAt: Date.now() };
    } catch { /* API blocked or cross-origin issue */ }
  }

  return {
    estimatedHeapMb: _heuristicHeapMb || 0,
    method: _heuristicHeapMb > 0 ? "heuristic" : "unavailable",
    tier,
    capturedAt: Date.now(),
  };
}

// ── Context budget ─────────────────────────────────────────────────────────────

// n_ctx values per RAM tier (conservative for mobile; we don't want OOM)
const NCTX_BY_TIER: Record<MemoryTier, number> = {
  unconstrained: 4096,
  comfortable: 2048,
  moderate: 1024,
  tight: 512,
  critical: 256,
};

export function getContextBudget(): ContextBudget {
  const ramGb = getDeviceRamGb();
  const tier = classifyRamTier(ramGb);
  const policy = getCurrentPolicy();
  const thermal = getThermalState();

  const maxByTier = NCTX_BY_TIER[tier];

  let recommended = maxByTier;
  let reductionReason: string | null = null;

  // Governor reduction
  if (policy.mode === "minimal") { recommended = Math.min(recommended, 256); reductionReason = "governor=minimal"; }
  else if (policy.mode === "conservative") { recommended = Math.min(recommended, 512); reductionReason = "governor=conservative"; }

  // Thermal reduction
  if (thermal === "critical" || thermal === "emergency") {
    recommended = Math.min(recommended, 512);
    reductionReason = reductionReason ?? `thermal=${thermal}`;
  }

  // Heap pressure reduction
  if (_heuristicHeapMb > (ramGb ?? 4) * 1024 * 0.7) {
    recommended = Math.min(recommended, 512);
    reductionReason = reductionReason ?? "heap_pressure";
  }

  return {
    recommendedNCtx: Math.max(256, recommended),
    maxNCtx: maxByTier,
    minNCtx: 256,
    reductionReason,
    tier,
  };
}

// ── Fragmentation detection ────────────────────────────────────────────────────

export function isFragmentationSuspected(): boolean {
  try {
    const log: HeapSnapshot[] = JSON.parse(localStorage.getItem(MEMORY_LOG_KEY) ?? "[]");
    if (log.length < 5) return false;
    const recent = log.slice(-5);
    const first = recent[0].estimatedHeapMb;
    const last = recent[recent.length - 1].estimatedHeapMb;
    // Heap grew >50% with no obvious explanation (inference sizes were stable)
    return last > first * 1.5;
  } catch { return false; }
}

// ── Eviction scoring ───────────────────────────────────────────────────────────

export function scoreModelEviction(
  models: Array<{ assetId: string; estimatedSizeMb: number; lastUsedAt: number }>
): EvictionCandidate[] {
  const now = Date.now();
  const ONE_DAY = 86_400_000;
  const maxSize = Math.max(...models.map((m) => m.estimatedSizeMb), 1);

  return models.map((m) => {
    const ageDays = (now - m.lastUsedAt) / ONE_DAY;
    const ageScore = Math.min(50, (ageDays / 7) * 50);
    const sizeScore = (m.estimatedSizeMb / maxSize) * 50;
    return { ...m, evictionScore: ageScore + sizeScore };
  }).sort((a, b) => b.evictionScore - a.evictionScore);
}

// ── Full report ────────────────────────────────────────────────────────────────

export function getMemoryGovernorReport(): MemoryGovernorReport {
  const snap = takeHeapSnapshot();
  const budget = getContextBudget();
  try {
    const log: HeapSnapshot[] = JSON.parse(localStorage.getItem(MEMORY_LOG_KEY) ?? "[]");
    return {
      currentTier: budget.tier,
      deviceRamGb: getDeviceRamGb(),
      estimatedHeapMb: snap.estimatedHeapMb > 0 ? snap.estimatedHeapMb : null,
      recommendedNCtx: budget.recommendedNCtx,
      fragmentation: isFragmentationSuspected(),
      snapshots: log.slice(-10),
    };
  } catch {
    return {
      currentTier: budget.tier,
      deviceRamGb: getDeviceRamGb(),
      estimatedHeapMb: null,
      recommendedNCtx: budget.recommendedNCtx,
      fragmentation: false,
      snapshots: [],
    };
  }
}
