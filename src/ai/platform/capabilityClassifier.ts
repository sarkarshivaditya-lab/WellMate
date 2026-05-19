// Runtime device capability classifier.
// Measures actual browser/runtime capabilities rather than device marketing tier.
// Result drives inference parameter selection for the AI governor.
//
// Classification inputs (in priority order):
//   1. WebAssembly SIMD — if missing, device cannot run llama.cpp at viable speed
//   2. Estimated RAM (navigator.deviceMemory — Chrome/Edge only)
//   3. CPU core count (navigator.hardwareConcurrency)
//   4. Available storage
//
// Results are cached after first classification (capabilities don't change at runtime).
// Re-classify on explicit refresh only.

import { getDeviceProfile } from "./deviceProfile";

export type CapabilityClass = "LOW_END" | "MID_RANGE" | "HIGH_END" | "FLAGSHIP";

export type MemoryCleanupAggression = "minimal" | "moderate" | "aggressive";

// Recommended inference parameters per capability class.
// These are the baseline before the runtime governor applies dynamic adjustments.
export type InferenceParams = {
  maxContextTokens: number;
  maxGenerationTokens: number;
  retrievalDepth: number;
  streamingThrottleMs: number;    // 0 = no throttle
  memoryCleanupAggression: MemoryCleanupAggression;
  backgroundTasksAllowed: boolean;
};

export type RuntimeCapabilities = {
  capabilityClass: CapabilityClass;
  hardwareConcurrency: number;
  estimatedRamGB: number | null;
  hasWasmSimd: boolean;
  hasWasmThreads: boolean;
  availableStorageMB: number | null;
  classifiedAt: number;
  params: InferenceParams;       // baseline for this class
};

// ── Detection ─────────────────────────────────────────────────────────────────

async function detectWasmSimd(): Promise<boolean> {
  try {
    // Minimal WASM binary that uses SIMD (v128.const) — compile-only test.
    const binary = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, 0x03,
      0x02, 0x01, 0x00, 0x07, 0x08, 0x01, 0x04, 0x74,
      0x65, 0x73, 0x74, 0x00, 0x00, 0x0a, 0x0a, 0x01,
      0x08, 0x00, 0xfd, 0x0c, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x0b,
    ]);
    await WebAssembly.compile(binary);
    return true;
  } catch {
    return false;
  }
}

function detectWasmThreads(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined" && typeof Atomics !== "undefined";
  } catch {
    return false;
  }
}

function classify(
  cores: number,
  ramGB: number | null,
  hasSimd: boolean,
): CapabilityClass {
  if (!hasSimd) return "LOW_END"; // WASM inference unusably slow without SIMD
  const ram = ramGB ?? 3; // conservative if unknown
  if (ram <= 2 || cores <= 2) return "LOW_END";
  if (ram <= 4 || cores <= 4) return "MID_RANGE";
  if (ram <= 8 || cores <= 8) return "HIGH_END";
  return "FLAGSHIP";
}

// ── Capability parameter table ─────────────────────────────────────────────────

const CLASS_PARAMS: Record<CapabilityClass, InferenceParams> = {
  LOW_END: {
    maxContextTokens: 512,
    maxGenerationTokens: 96,
    retrievalDepth: 3,
    streamingThrottleMs: 50,
    memoryCleanupAggression: "aggressive",
    backgroundTasksAllowed: false,
  },
  MID_RANGE: {
    maxContextTokens: 1024,
    maxGenerationTokens: 192,
    retrievalDepth: 5,
    streamingThrottleMs: 20,
    memoryCleanupAggression: "moderate",
    backgroundTasksAllowed: true,
  },
  HIGH_END: {
    maxContextTokens: 2048,
    maxGenerationTokens: 256,
    retrievalDepth: 8,
    streamingThrottleMs: 0,
    memoryCleanupAggression: "minimal",
    backgroundTasksAllowed: true,
  },
  FLAGSHIP: {
    maxContextTokens: 2048,
    maxGenerationTokens: 256,
    retrievalDepth: 10,
    streamingThrottleMs: 0,
    memoryCleanupAggression: "minimal",
    backgroundTasksAllowed: true,
  },
};

// ── Classification entry points ────────────────────────────────────────────────

let _capabilities: RuntimeCapabilities | null = null;

export async function detectCapabilities(
  opts?: { refresh?: boolean },
): Promise<RuntimeCapabilities> {
  if (_capabilities && !opts?.refresh) return _capabilities;

  const profile = await getDeviceProfile();
  const [hasSimd] = await Promise.all([detectWasmSimd()]);
  const hasThreads = detectWasmThreads();

  const cores = navigator.hardwareConcurrency || 2;
  const capClass = classify(cores, profile.estimatedRamGB, hasSimd);

  _capabilities = {
    capabilityClass: capClass,
    hardwareConcurrency: cores,
    estimatedRamGB: profile.estimatedRamGB,
    hasWasmSimd: hasSimd,
    hasWasmThreads: hasThreads,
    availableStorageMB: profile.availableStorageMB,
    classifiedAt: Date.now(),
    params: CLASS_PARAMS[capClass],
  };

  return _capabilities;
}

export function getCapabilitiesSync(): RuntimeCapabilities | null {
  return _capabilities;
}

export function getParamsForClass(cls: CapabilityClass): InferenceParams {
  return CLASS_PARAMS[cls];
}
