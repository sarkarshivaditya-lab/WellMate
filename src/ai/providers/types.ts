// Provider abstraction contract.
// Every AI backend — local Phi-3, OpenAI, Claude, or future providers —
// must implement this interface. The orchestrator only ever calls through here.

import type { InferenceRequest, InferenceResult, ProviderType } from "../runtime/types";

export interface AIProvider {
  readonly type: ProviderType;
  readonly modelId: string;

  /** One-time async setup: load weights, authenticate, warm up. */
  initialize(): Promise<void>;

  /** Generate a completion for the given request. */
  generate(request: InferenceRequest): Promise<InferenceResult>;

  /** Produce a short summary of the provided text. */
  summarize(text: string, maxTokens?: number): Promise<string>;

  /** Embed text into a dense vector (for future retrieval). Returns zero vector if unsupported. */
  embed(text: string): Promise<number[]>;

  /** Attempt to cancel an in-flight request by ID. Best-effort. */
  cancel(requestId: string): void;

  /** Release all held resources. Safe to call multiple times. */
  dispose(): Promise<void>;

  /** True only after initialize() succeeds and before dispose() is called. */
  isReady(): boolean;
}
