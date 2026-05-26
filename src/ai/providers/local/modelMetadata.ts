// Model manifest types and the production local model definition.

export type ModelFamily = "phi3" | "llama" | "mistral" | "gemma" | "qwen";
export type QuantizationLevel = "q4_0" | "q4_k_m" | "q5_0" | "q8_0" | "f16";
export type ModelCapability = "generate" | "embed" | "summarize";
export type ReleaseChannel = "stable" | "beta" | "experimental" | "internal";
export type CapabilityTier = "lightweight" | "standard" | "flagship";
export type DeviceTier = "low" | "mid" | "high" | "flagship";
export type MigrationStrategy = "replace" | "staged" | "parallel";

export type ModelManifest = {
  id: string;
  name: string;
  family: ModelFamily;
  sizeBytes: number;
  quantization: QuantizationLevel;
  contextLength: number;       // tokens — should be ≤1024 for mobile safety
  maxGenerationTokens: number; // conservative per-response ceiling
  capabilities: ModelCapability[];
  downloadUrl?: string;
  checksum?: string;           // sha256 hex — verified before load when present
  // Device requirements — ENFORCED before any WASM allocation attempt
  minRamMB?: number;
  minStorageMB?: number;
  // Deployment control
  capabilityTier?: CapabilityTier;
  targetDeviceTiers?: DeviceTier[];
  releaseChannel?: ReleaseChannel;
  rolloutPct?: number;         // 0–100; which fraction of users get this model
  deprecated?: boolean;
  deprecatedAt?: string;       // ISO date
  // Migration
  migrationStrategy?: MigrationStrategy;
  fallbackModelId?: string;    // model to use if this one cannot activate
  // Metadata
  releasedAt?: string;
  changeNotes?: string;
};

export type ModelLoadState =
  | { phase: "not_loaded" }
  | { phase: "downloading"; progressBytes: number; totalBytes: number; resumedFrom: number }
  | { phase: "verifying" }
  | { phase: "loading"; progressPct: number }
  | { phase: "ready"; loadedAt: number }
  | { phase: "aborted"; intent: "pause" | "cancel"; savedBytes: number }
  | { phase: "failed"; reason: string };

// ── Production mobile manifest ─────────────────────────────────────────────────
//
// Qwen2.5-1.5B-Instruct Q4_K_M — the mobile-safe default.
//
// Memory analysis (why Phi-3 Mini caused Android renderer crashes):
//   Phi-3 Mini Q4_0 = 2.39 GB file → ~3.35 GB peak WASM heap (weights + KV + buffers)
//   Android WebView renderer budget ≈ 35% of device RAM = 1.4 GB on a 4 GB phone
//   Result: WASM memory.grow() kills the renderer → black screen → app crash
//
// Qwen2.5-1.5B Q4_K_M = 1,117,320,736 bytes actual (CDN Content-Length) → ~1.2 GB peak WASM heap
//   - 28 layers, 12 Q heads, 2 KV heads (GQA with 6:1 ratio)
//   - KV cache at n_ctx=1024: only ~9 MB (GQA cuts this dramatically vs full attention)
//   - Total: ~1.06 GB weights + 9 MB KV + 150 MB overhead ≈ 1.22 GB → safe on 4 GB devices
//   - Quality: sufficient for wellness reflections (short, empathetic outputs)
//
// sizeBytes is the exact CDN Content-Length from HEAD request — verified 2026-05-25.
export const QWEN25_15B_MANIFEST: ModelManifest = {
  id: "qwen2.5-1.5b-instruct-q4km",
  name: "Qwen2.5 1.5B",
  family: "qwen",
  sizeBytes: 1_117_320_736,
  quantization: "q4_k_m",
  contextLength: 1024,         // 1K context: KV cache ~9 MB due to GQA — safe on all targets
  maxGenerationTokens: 256,
  capabilities: ["generate", "summarize"],
  downloadUrl:
    "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
  minRamMB: 4096,              // enforced in LocalProvider before any WASM alloc
  minStorageMB: 1200,          // 1.07 GB file + headroom
  capabilityTier: "standard",
  targetDeviceTiers: ["mid", "high", "flagship"],
  releaseChannel: "stable",
  rolloutPct: 100,
  releasedAt: "2025-05-01",
};

// ── Legacy manifest — DEPRECATED ──────────────────────────────────────────────
//
// Phi-3 Mini Q4_0 (2.39 GB) is infeasible on Android WebView:
//   Peak WASM heap ~3.35 GB exceeds the renderer process budget on every common Android device.
//   Attempting to load it causes the renderer to be killed by the OS LMK (black screen crash).
//   Kept here for reference only — do NOT use as a default or load on mobile.
export const PHI3_MINI_MANIFEST: ModelManifest = {
  id: "phi3-mini-4k-instruct-q4",
  name: "Phi-3 Mini (deprecated — too large for Android WebView)",
  family: "phi3",
  sizeBytes: 2_390_000_000,
  quantization: "q4_0",
  contextLength: 2048,
  maxGenerationTokens: 256,
  capabilities: ["generate", "summarize"],
  downloadUrl:
    "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf",
  minRamMB: 8192,              // would need 8 GB device — no common Android WebView device qualifies
  minStorageMB: 3000,
  capabilityTier: "flagship",
  targetDeviceTiers: [],       // empty = no device tier qualifies for WebView deployment
  releaseChannel: "internal",
  rolloutPct: 0,
  deprecated: true,
  deprecatedAt: "2026-05-25",
  releasedAt: "2025-05-01",
  changeNotes: "Retired: 2.39 GB GGUF exceeds Android WebView renderer memory budget. Replaced by QWEN25_15B_MANIFEST.",
};
