// Deterministic stub provider — always registered as the safe fallback.
// Returns clearly-labelled stub responses: zero latency risk, zero thermal cost.
// Enables the full UI and hook layer to work before any real model is available.

import type { AIProvider } from "./types";
import type { InferenceRequest, InferenceResult, ProviderType } from "../runtime/types";

export class StubProvider implements AIProvider {
  readonly type: ProviderType = "stub";
  readonly modelId = "wellmate-stub-v0";

  async initialize(): Promise<void> {
    // intentionally no-op
  }

  async generate(request: InferenceRequest): Promise<InferenceResult> {
    const start = Date.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    return {
      requestId: request.id,
      text: "[AI runtime not yet initialised]",
      tokensGenerated: 6,
      durationMs: Date.now() - start,
      provider: "stub",
      modelId: this.modelId,
      cached: false,
    };
  }

  async summarize(text: string): Promise<string> {
    return `[Stub summary — ${text.length} chars]`;
  }

  async embed(_text: string): Promise<number[]> {
    // 384-dimensional zero vector — matches all-MiniLM-L6 shape for future compat
    return new Array(384).fill(0);
  }

  cancel(_requestId: string): void {
    // nothing in-flight to cancel
  }

  async dispose(): Promise<void> {
    // nothing to release
  }

  isReady(): boolean {
    return true;
  }
}
