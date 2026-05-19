// Provider orchestrator — the only place where provider selection logic lives.
// Implements a priority fallback chain: local → (future cloud) → stub.
// No component, hook, or provider should make routing decisions directly.

import type { InferenceRequest, InferenceResult } from "../runtime/types";
import type { ModelManifest } from "../providers/local/modelMetadata";
import {
  getActiveProvider,
  getProvider,
  registerProvider,
  setActiveProvider,
} from "../providers/registry";
import { StubProvider } from "../providers/StubProvider";
import { enqueue, setQueueExecutor } from "../runtime/inferenceQueue";
import {
  awaitThermalClearance,
  recordInference,
  isAppVisible,
  subscribeToThermalEmergency,
} from "../runtime/thermalGuard";
import { patchRuntimeState } from "../runtime/runtimeState";

let _initialised = false;

export async function initOrchestrator(): Promise<void> {
  if (_initialised) return;

  const stub = new StubProvider();
  registerProvider(stub);
  setActiveProvider("stub");

  setQueueExecutor(executeInference);

  patchRuntimeState({
    status: "ready",
    provider: "stub",
    modelId: stub.modelId,
    offlineCapable: true,
  });

  // Emergency thermal shutdown — unload local model if device is overheating
  subscribeToThermalEmergency(() => {
    const local = getProvider("local");
    if (local?.isReady()) {
      void local.dispose().catch(() => null);
      setActiveProvider("stub");
      patchRuntimeState({
        provider: "stub",
        modelLoad: "not_loaded",
        lastError: "Model unloaded: thermal emergency. Restart when device cools.",
      });
    }
  });

  _initialised = true;
}

async function executeInference(
  request: InferenceRequest,
): Promise<InferenceResult> {
  // Defer inference while the app is backgrounded — avoids wasted cycles
  if (!isAppVisible()) {
    await new Promise<void>((resolve) => {
      const poll = () => {
        if (isAppVisible()) resolve();
        else setTimeout(poll, 500);
      };
      poll();
    });
  }

  await awaitThermalClearance();

  if (request.controller.signal.aborted) {
    throw new Error("Cancelled before execution");
  }

  const provider = getActiveProvider();
  if (!provider) throw new Error("No active AI provider");

  patchRuntimeState({ status: "inferencing" });

  try {
    const result = await provider.generate(request);
    recordInference();
    patchRuntimeState({ status: "ready" });
    return result;
  } catch (err) {
    patchRuntimeState({ status: "ready" });
    throw err;
  }
}

// Attempt to activate the local model provider at runtime.
// Falls back silently to stub if llama.cpp bridge is unavailable.
export async function tryActivateLocalProvider(
  manifest: ModelManifest,
): Promise<boolean> {
  const existing = getProvider("local");
  if (existing?.isReady()) return true;

  const { LocalProvider } = await import("../providers/local/LocalProvider");
  const local = new LocalProvider(manifest);

  try {
    await local.initialize();
    registerProvider(local);
    setActiveProvider("local");
    return true;
  } catch {
    patchRuntimeState({
      status: "ready",
      provider: "stub",
      lastError: "Local model unavailable — inference via stub",
    });
    return false;
  }
}

export function submitInference(
  request: InferenceRequest,
): Promise<InferenceResult> {
  return enqueue(request);
}

export function getActiveProviderInfo(): {
  type: string;
  modelId: string;
  ready: boolean;
} | null {
  const p = getActiveProvider();
  return p ? { type: p.type, modelId: p.modelId, ready: p.isReady() } : null;
}
