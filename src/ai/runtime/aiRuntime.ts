// AI runtime lifecycle coordinator.
// Single entry point for the entire AI subsystem.
// Call initAIRuntime() once at app startup — idempotent, safe to call multiple times.
// Non-fatal: if initialisation fails, the app continues without AI capabilities.

import { initOrchestrator } from "../orchestration/orchestrator";
import { clearQueue } from "./inferenceQueue";
import { resetRuntimeState, patchRuntimeState } from "./runtimeState";
import { resetThermal } from "./thermalGuard";
import { clearSessionMemory } from "../memory/runtimeMemory";
import { warmEmbeddingPipeline } from "../embeddings/embeddingPipeline";
import { bootstrapWellnessIndex } from "../retrieval/wellnessRetrieval";

let _started = false;

export async function initAIRuntime(): Promise<void> {
  if (_started) return;
  _started = true;

  try {
    // Phase 1: wire the inference queue and register stub provider (fast, sync-safe)
    await initOrchestrator();
  } catch (err) {
    // Non-fatal — stub provider remains active, app continues unaffected
    patchRuntimeState({
      status: "error",
      lastError: err instanceof Error ? err.message : "AI runtime init failed",
    });
    return;
  }

  // Phase 2: warm embeddings + index wellness data in background — never blocks startup
  Promise.resolve()
    .then(() => warmEmbeddingPipeline())
    .then(() => bootstrapWellnessIndex())
    .catch(() => {
      // Non-fatal — retrieval degrades gracefully without embeddings
    });
}

export async function disposeAIRuntime(): Promise<void> {
  if (!_started) return;

  clearQueue();
  clearSessionMemory();
  resetThermal();
  resetRuntimeState();
  _started = false;
}

export function isAIRuntimeStarted(): boolean {
  return _started;
}
