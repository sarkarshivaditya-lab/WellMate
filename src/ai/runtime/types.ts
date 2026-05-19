// AI runtime type contracts.
// Separate from src/ai/types.ts (context/citation layer) — these are runtime concerns.

export type RuntimeStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "loading_model"
  | "inferencing"
  | "error"
  | "disposed";

export type ModelLoadStatus =
  | "not_loaded"
  | "loading"
  | "ready"
  | "failed"
  | "unloading";

export type ThermalState = "nominal" | "warm" | "hot" | "critical";

export type ProviderType = "local" | "openai" | "claude" | "stub";

export type InferencePriority = "high" | "normal" | "low";

export type InferenceRequest = {
  id: string;
  prompt: string;
  systemContext?: string;
  maxTokens: number;
  temperature: number;
  priority: InferencePriority;
  controller: AbortController;
};

export type InferenceResult = {
  requestId: string;
  text: string;
  tokensGenerated: number;
  durationMs: number;
  provider: ProviderType;
  modelId: string;
  cached: boolean;
};

export type InferenceStatus =
  | { phase: "idle" }
  | { phase: "queued"; position: number }
  | { phase: "running"; requestId: string }
  | { phase: "complete"; result: InferenceResult }
  | { phase: "failed"; error: string }
  | { phase: "cancelled" };

export type AIRuntimeState = {
  status: RuntimeStatus;
  provider: ProviderType;
  modelId: string | null;
  modelLoad: ModelLoadStatus;
  queueDepth: number;
  lastError: string | null;
  thermal: ThermalState;
  offlineCapable: boolean;
  totalInferences: number;
};
