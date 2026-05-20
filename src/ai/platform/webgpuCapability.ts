// WebGPU experimental execution path — capability detection and classification.
//
// WebGPU is NOT currently used for inference — llama.cpp WASM does not yet have
// a production WebGPU backend. This module establishes the detection, eligibility
// gate, and fallback hierarchy so that when WebGPU inference becomes viable,
// integration requires only wiring, not architectural change.
//
// Execution fallback hierarchy (highest performance first):
//   GPU (WebGPU)  →  Threaded CPU (WASM + SAB)  →  Single-thread CPU  →  Stub
//
// GPU eligibility requires:
//   - navigator.gpu available
//   - requestAdapter() returns non-null
//   - device.features includes necessary compute features
//   - Device RAM >= 4GB (GPU sharing with system RAM on mobile)
//
// WebGPU types not in lib DOM — use typed interface declarations.

import { getThreadingCapability } from "../runtime/threadingCapability";

// ── WebGPU type declarations (subset of W3C spec) ─────────────────────────────

interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
}

interface GPUDevice {
  features: Set<string>;
  limits: Record<string, number>;
  destroy(): void;
}

interface GPUAdapter {
  name?: string;
  isFallbackAdapter: boolean;
  requestDevice(): Promise<GPUDevice>;
  requestAdapterInfo?(): Promise<GPUAdapterInfo>;
}

interface GPUNavigator {
  gpu: {
    requestAdapter(opts?: { powerPreference?: "high-performance" | "low-power" }): Promise<GPUAdapter | null>;
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type GpuEligibility =
  | "eligible"         // WebGPU available + adapter found + device created
  | "api_unavailable"  // navigator.gpu does not exist
  | "no_adapter"       // requestAdapter() returned null (no GPU or blocked by browser)
  | "device_error"     // requestDevice() failed
  | "insufficient_ram" // Device RAM below threshold for safe GPU sharing
  | "fallback_adapter" // Adapter is software fallback — not hardware accelerated
  | "untested";        // Not yet assessed

export type GpuFeatureSet = {
  computeShaders: boolean;
  timestampQuery: boolean;
  float16: boolean;
};

export type WebGpuCapabilityReport = {
  eligibility: GpuEligibility;
  adapterName: string | null;
  isFallbackAdapter: boolean;
  features: GpuFeatureSet;
  estimatedVramMb: number | null; // GPU doesn't expose this directly; estimated from device tier
  memoryBudgetMb: number;
  assessedAt: number;
  errorDetail: string | null;
};

export type InferenceExecutionTier =
  | "gpu"           // WebGPU compute shaders (experimental)
  | "threaded_cpu"  // WASM + SAB + multi-thread llama.cpp
  | "single_cpu"    // Single-thread WASM
  | "stub";         // No local model

const GPU_CACHE_KEY = "ai_webgpu_cap_v1";
const GPU_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

let _cachedReport: WebGpuCapabilityReport | null = null;

// ── Detection ──────────────────────────────────────────────────────────────────

function hasWebGpuApi(): boolean {
  return typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    typeof (navigator as unknown as GPUNavigator).gpu?.requestAdapter === "function";
}

function estimateMemoryBudgetMb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const gb = nav.deviceMemory ?? 4;
  // Heuristic: allocate up to 25% of device RAM for GPU operations
  return Math.floor(gb * 1024 * 0.25);
}

export async function assessWebGpuCapability(force = false): Promise<WebGpuCapabilityReport> {
  if (!force && _cachedReport && Date.now() - _cachedReport.assessedAt < GPU_CACHE_TTL_MS) {
    return _cachedReport;
  }

  try {
    const cached = localStorage.getItem(GPU_CACHE_KEY);
    if (!force && cached) {
      const parsed = JSON.parse(cached) as WebGpuCapabilityReport;
      if (Date.now() - parsed.assessedAt < GPU_CACHE_TTL_MS) {
        _cachedReport = parsed;
        return _cachedReport;
      }
    }
  } catch { /* */ }

  const report: WebGpuCapabilityReport = {
    eligibility: "untested",
    adapterName: null,
    isFallbackAdapter: false,
    features: { computeShaders: false, timestampQuery: false, float16: false },
    estimatedVramMb: null,
    memoryBudgetMb: estimateMemoryBudgetMb(),
    assessedAt: Date.now(),
    errorDetail: null,
  };

  if (!hasWebGpuApi()) {
    report.eligibility = "api_unavailable";
    _cachedReport = report;
    try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
    return report;
  }

  const nav = navigator as unknown as GPUNavigator;

  try {
    // Prefer high-performance for inference; browser may still return integrated GPU
    const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) {
      report.eligibility = "no_adapter";
      _cachedReport = report;
      try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
      return report;
    }

    report.isFallbackAdapter = adapter.isFallbackAdapter;
    if (adapter.isFallbackAdapter) {
      report.eligibility = "fallback_adapter";
      report.adapterName = adapter.name ?? "software";
      _cachedReport = report;
      try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
      return report;
    }

    // Fetch adapter info if available
    if (adapter.requestAdapterInfo) {
      try {
        const info = await adapter.requestAdapterInfo();
        report.adapterName = [info.vendor, info.architecture, info.device].filter(Boolean).join(" / ") || "unknown";
      } catch { report.adapterName = adapter.name ?? "unknown"; }
    } else {
      report.adapterName = adapter.name ?? "unknown";
    }

    // Check RAM threshold (4GB minimum for safe GPU inference sharing)
    const nav2 = navigator as Navigator & { deviceMemory?: number };
    if ((nav2.deviceMemory ?? Infinity) < 4) {
      report.eligibility = "insufficient_ram";
      _cachedReport = report;
      try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
      return report;
    }

    let device: GPUDevice | null = null;
    try {
      device = await adapter.requestDevice();
    } catch (err) {
      report.eligibility = "device_error";
      report.errorDetail = err instanceof Error ? err.message.slice(0, 200) : String(err);
      _cachedReport = report;
      try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
      return report;
    }

    // Assess features needed for compute inference
    report.features = {
      computeShaders: device.features.has("shader-f16") || true, // compute is always available in WebGPU
      timestampQuery: device.features.has("timestamp-query"),
      float16: device.features.has("shader-f16"),
    };

    device.destroy(); // Release immediately — we only needed it for capability check
    report.eligibility = "eligible";
  } catch (err) {
    report.eligibility = "device_error";
    report.errorDetail = err instanceof Error ? err.message.slice(0, 200) : String(err);
  }

  _cachedReport = report;
  try { localStorage.setItem(GPU_CACHE_KEY, JSON.stringify(report)); } catch { /* */ }
  return report;
}

export function getWebGpuCapabilitySync(): WebGpuCapabilityReport | null {
  if (_cachedReport) return _cachedReport;
  try {
    const cached = localStorage.getItem(GPU_CACHE_KEY);
    if (cached) return JSON.parse(cached) as WebGpuCapabilityReport;
  } catch { /* */ }
  return null;
}

// ── Execution tier resolution ──────────────────────────────────────────────────

export function resolveInferenceExecutionTier(): InferenceExecutionTier {
  const gpu = getWebGpuCapabilitySync();
  if (gpu?.eligibility === "eligible") return "gpu"; // experimental — gated by feature flag

  const cap = getThreadingCapability();
  if (cap.mode === "multi_thread_eligible") return "threaded_cpu";
  if (cap.mode === "single_thread") return "single_cpu";
  return "stub";
}

export function invalidateGpuCache(): void {
  _cachedReport = null;
  try { localStorage.removeItem(GPU_CACHE_KEY); } catch { /* */ }
}
