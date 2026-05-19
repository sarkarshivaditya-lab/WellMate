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
  resetThermal,
  getInferenceRate,
} from "../runtime/thermalGuard";
import { patchRuntimeState } from "../runtime/runtimeState";
import { getCurrentPolicy, applyGovernorPolicy, initGovernor } from "../runtime/runtimeGovernor";
import { recordInferenceProfile } from "../runtime/performanceProfiler";
import {
  withStuckStreamDetection,
  withInferenceTimeout,
  cleanupStaleDownloadMarkers,
  recordInferenceFailure,
} from "../runtime/executionRecovery";
import { recordThermalIncident, updateDailyPerformance } from "../runtime/performanceHistory";
import { initAppLifecycle } from "../runtime/appLifecycle";
import { startSessionGuard, recordSessionInference } from "../runtime/sessionGuard";
import { initCognitionScaler } from "../cognition/cognitionScaler";

let _initialised = false;
let _sessionInferenceCount = 0;

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
      resetThermal();
      recordThermalIncident({
        occurredAt: Date.now(),
        thermalState: "emergency",
        inferencesPerMin: getInferenceRate(),
        action: "emergency_unload",
      });
      patchRuntimeState({
        provider: "stub",
        modelLoad: "not_loaded",
        lastError: "Model unloaded: thermal emergency. Restart when device cools.",
      });
    }
  });

  _initialised = true;

  // Non-blocking startup tasks — run after orchestrator is fully initialised.
  void _startupTasks();
}

async function _startupTasks(): Promise<void> {
  // 0. App lifecycle tracking + cognition scaler + session guard
  initAppLifecycle();
  initCognitionScaler();
  startSessionGuard();

  // 1. Initialize governor (begins device capability detection in background)
  initGovernor();

  // 1b. Cleanup any stale download markers from prior sessions
  cleanupStaleDownloadMarkers();

  // 1. Recover any interrupted migration from a prior session
  try {
    const { recoverInterruptedMigration } = await import("../models/migrationEngine");
    await recoverInterruptedMigration();
  } catch { /* non-fatal */ }

  // 2. Fetch remote manifest and hydrate registry (background, non-blocking)
  void (async () => {
    try {
      const { fetchManifest } = await import("../models/remoteManifest");
      const { hydrateFromRemote } = await import("../models/modelRegistry");
      const result = await fetchManifest();
      if (result.models.length) hydrateFromRemote(result.models);
    } catch { /* non-fatal — static fallback remains active */ }
  })();

  // 3. Auto-activate local model if already installed
  try {
    const { checkLifecycleState } = await import("../models/modelLifecycle");
    const { getRecommendedManifest } = await import("../models/modelRegistry");

    const state = await checkLifecycleState();
    if (state === "installed") {
      const manifest = getRecommendedManifest();
      await tryActivateLocalProvider(manifest);
    }
  } catch { /* silent — startup activation is best-effort */ }
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

  // Apply governor policy — adjusts maxTokens based on device state
  const policy = getCurrentPolicy();
  const governedRequest = applyGovernorPolicy(request, policy);

  if (governedRequest.controller.signal.aborted) {
    throw new Error("Inference suspended by runtime governor");
  }

  // Wrap streaming with stuck-stream watchdog
  const stuckGuard = withStuckStreamDetection(
    governedRequest.onToken,
    governedRequest.controller,
  );
  const finalRequest: InferenceRequest = {
    ...governedRequest,
    onToken: stuckGuard.wrappedOnToken,
  };

  patchRuntimeState({ status: "inferencing" });
  const inferenceStart = Date.now();

  try {
    const result = await withInferenceTimeout(
      provider.generate(finalRequest),
      finalRequest.controller,
    );

    stuckGuard.cancel();
    recordInference();
    recordSessionInference();

    const durationMs = Date.now() - inferenceStart;
    const tokPerSec = result.durationMs > 0
      ? (result.tokensGenerated / result.durationMs) * 1_000
      : 0;

    recordInferenceProfile(durationMs, tokPerSec, result.tokensGenerated);

    _sessionInferenceCount++;
    if (_sessionInferenceCount % 5 === 0) {
      // Periodic daily record update every 5 inferences
      const { getDetailedSnapshot } = await import("../runtime/performanceProfiler");
      const snap = getDetailedSnapshot();
      updateDailyPerformance(_sessionInferenceCount, snap.avgTokPerSec, snap.p90LatencyMs);
    }

    patchRuntimeState({ status: "ready", totalInferences: _sessionInferenceCount });
    return result;
  } catch (err) {
    stuckGuard.cancel();
    const isAbort = err instanceof Error && (
      err.message.includes("Cancelled") ||
      err.message.includes("aborted") ||
      err.message.includes("suspended")
    );
    if (!isAbort) {
      recordInferenceFailure(err, provider.type, false, false);
    }
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
