// Model manifest types and the production local model definition.

export type ModelFamily = "phi3" | "llama" | "mistral" | "gemma";
export type QuantizationLevel = "q4_0" | "q4_k_m" | "q5_0" | "q8_0" | "f16";
export type ModelCapability = "generate" | "embed" | "summarize";

export type ModelManifest = {
  id: string;
  name: string;
  family: ModelFamily;
  sizeBytes: number;
  quantization: QuantizationLevel;
  contextLength: number;      // tokens — should be ≤2048 for mobile safety
  maxGenerationTokens: number; // conservative per-response ceiling
  capabilities: ModelCapability[];
  downloadUrl?: string;
  checksum?: string;           // sha256 hex — verified before load when present
};

export type ModelLoadState =
  | { phase: "not_loaded" }
  | { phase: "downloading"; progressBytes: number; totalBytes: number; resumedFrom: number }
  | { phase: "verifying" }
  | { phase: "loading"; progressPct: number }
  | { phase: "ready"; loadedAt: number }
  | { phase: "failed"; reason: string };

// Production model: Phi-3 Mini 4K Instruct Q4_0 — smallest viable reasoning
// model for wellness context. 2.39 GB on-device.
//
// Conservative settings tuned for mid-range mobile (Snapdragon 7 Gen / A15+):
//   - contextLength 2048: halves KV cache vs 4096 (critical for RAM)
//   - maxGenerationTokens 256: ~20-60s generation at 4-12 tok/s on mobile
//   - Q4_0: fast decode, broad quantization hardware support
//
// downloadUrl: official Microsoft GGUF release via HuggingFace CDN.
// Replace with dedicated CDN URL before production deployment.
export const PHI3_MINI_MANIFEST: ModelManifest = {
  id: "phi3-mini-4k-instruct-q4",
  name: "Phi-3 Mini",
  family: "phi3",
  sizeBytes: 2_390_000_000,
  quantization: "q4_0",
  contextLength: 2048,
  maxGenerationTokens: 256,
  capabilities: ["generate", "summarize"],
  downloadUrl:
    "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf",
  // checksum: add sha256 after CDN migration for integrity verification
};
