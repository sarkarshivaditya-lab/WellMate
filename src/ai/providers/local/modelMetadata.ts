// Model manifest types and the Phase-1 target model definition.

export type ModelFamily = "phi3" | "llama" | "mistral" | "gemma";
export type QuantizationLevel = "q4_0" | "q4_k_m" | "q5_0" | "q8_0" | "f16";
export type ModelCapability = "generate" | "embed" | "summarize";

export type ModelManifest = {
  id: string;
  name: string;
  family: ModelFamily;
  sizeBytes: number;
  quantization: QuantizationLevel;
  contextLength: number;
  capabilities: ModelCapability[];
  downloadUrl?: string;
  checksum?: string; // sha256 hex — for integrity verification before load
};

export type ModelLoadState =
  | { phase: "not_loaded" }
  | { phase: "downloading"; progressBytes: number; totalBytes: number }
  | { phase: "verifying" }
  | { phase: "loading"; progressPct: number }
  | { phase: "ready"; loadedAt: number }
  | { phase: "failed"; reason: string };

// Phase-1 local model target: Phi-3 Mini (3.8B, Q4_K_M quantization).
// ~2.3 GB on-device — smallest viable reasoning model for wellness context.
// Context: 4096 tokens (sufficient for assembled wellness context + response).
export const PHI3_MINI_MANIFEST: ModelManifest = {
  id: "phi3-mini-4k-instruct-q4km",
  name: "Phi-3 Mini (4K, Q4_K_M)",
  family: "phi3",
  sizeBytes: 2_300_000_000,
  quantization: "q4_k_m",
  contextLength: 4096,
  capabilities: ["generate", "summarize"],
  // downloadUrl: filled in when model hosting is configured
};
