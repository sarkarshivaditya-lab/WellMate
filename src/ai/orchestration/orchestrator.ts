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
import { patchRuntimeState, getRuntimeState } from "../runtime/runtimeState";
import { getCurrentPolicy, applyGovernorPolicy, initGovernor } from "../runtime/runtimeGovernor";
import { recordInferenceProfile } from "../runtime/performanceProfiler";
import {
  withStuckStreamDetection,
  withInferenceTimeout,
  cleanupStaleDownloadMarkers,
  recordInferenceFailure,
} from "../runtime/executionRecovery";
import { recordThermalIncident, updateDailyPerformance } from "../runtime/performanceHistory";
import { initAppLifecycle, subscribeToLifecycle } from "../runtime/appLifecycle";
import { startSessionGuard, recordSessionInference } from "../runtime/sessionGuard";
import { initCognitionScaler } from "../cognition/cognitionScaler";
import { createOptimizedStream } from "../runtime/streamingOptimizer";
import { initStartupProfile, recordStageStart, recordStageComplete } from "../runtime/coldStartOptimizer";
import { assessAndRecover, markCleanExit } from "../runtime/lifecycleRecovery";

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
  initStartupProfile();
  recordStageStart("core");

  // Crash recovery + migration recovery are independent — run in parallel
  await Promise.all([
    assessAndRecover().catch(() => null),
    import("../models/migrationEngine")
      .then(({ recoverInterruptedMigration }) => recoverInterruptedMigration())
      .catch(() => null),
  ]);

  initAppLifecycle();
  initCognitionScaler();
  startSessionGuard();

  subscribeToLifecycle((event) => {
    if (event === "before_unload") markCleanExit();
  });

  recordStageComplete("core");

  recordStageStart("governor");
  initGovernor();
  recordStageComplete("governor");

  cleanupStaleDownloadMarkers();

  // Remote manifest fetch — background, non-blocking
  void (async () => {
    try {
      const { fetchManifest } = await import("../models/remoteManifest");
      const { hydrateFromRemote } = await import("../models/modelRegistry");
      const result = await fetchManifest();
      if (result.models.length) hydrateFromRemote(result.models);
    } catch { /* non-fatal */ }
  })();

  // Auto-activate local model if already installed.
  // Fast-path: when the install marker is present, skip checkLifecycleState()
  // entirely. That function runs validateModelIntegrity + evaluateModelUpdate
  // (300-1000ms of storage/battery I/O). LocalProvider.initialize() catches
  // corruption independently, so the integrity check is not needed here.
  recordStageStart("warmup");
  try {
    const { getPersistedInstallState, checkLifecycleState } = await import("../models/modelLifecycle");
    const { getRecommendedManifest } = await import("../models/modelRegistry");

    if (getPersistedInstallState() === "installed") {
      const manifest = getRecommendedManifest();
      await tryActivateLocalProvider(manifest);
    } else {
      const state = await checkLifecycleState();
      if (state === "installed") {
        const manifest = getRecommendedManifest();
        await tryActivateLocalProvider(manifest);
      }
    }
  } catch { /* silent — startup activation is best-effort */ }
  recordStageComplete("warmup");

  recordStageStart("ready");
  recordStageComplete("ready");
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

  // Streaming chain: llama → stuckGuard.wrappedOnToken → optimizer.wrappedOnToken → UI onToken
  // stuckGuard resets its watchdog on real tokens; optimizer paces UI delivery.
  const optimizer = createOptimizedStream({
    onToken: governedRequest.onToken ?? (() => undefined),
    policy,
  });
  const stuckGuard = withStuckStreamDetection(
    optimizer.wrappedOnToken,
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

    optimizer.flush();
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
    optimizer.cancel();
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

// Mutex — prevents concurrent activations (e.g. _startupTasks + lifecycle subscription
// both seeing "installed" simultaneously and each creating a LocalProvider).
let _activationInFlight: Promise<boolean> | null = null;

// Attempt to activate the local model provider at runtime.
// Falls back silently to stub if llama.cpp bridge is unavailable.
// Concurrent callers share the same in-flight promise (safe to call from multiple sites).
export async function tryActivateLocalProvider(
  manifest: ModelManifest,
): Promise<boolean> {
  const existing = getProvider("local");
  if (existing?.isReady()) return true;

  if (_activationInFlight) return _activationInFlight;

  _activationInFlight = (async () => {
    const { LocalProvider } = await import("../providers/local/LocalProvider");
    const local = new LocalProvider(manifest);

    try {
      await local.initialize();
      registerProvider(local);
      setActiveProvider("local");
      return true;
    } catch {
      // LocalProvider.initialize() patches its own failure state before throwing.
      // Preserve failed_oom — it needs a different recovery path (no retries).
      // For all other failures, surface "failed" (not "not_loaded"):
      //   - "not_loaded" + installed=true causes WellMateLauncher to show "activating"
      //     indefinitely, because deriveModelStatus() returns "activating" whenever the
      //     model is installed but not yet in memory — hiding the real failure.
      //   - "failed" correctly surfaces the error so the user sees what went wrong.
      //   - autoModelLifecycle still retries (it only skips failed_oom / failed_degraded).
      const { modelLoad, lastError } = getRuntimeState();
      const isOom = modelLoad === "failed_oom";
      patchRuntimeState({
        status: "ready",
        provider: "stub",
        modelLoad: isOom ? "failed_oom" : "failed",
        lastError: isOom ? lastError : (lastError ?? "Offline AI could not load — restart the app to try again"),
      });
      return false;
    }
  })().finally(() => {
    _activationInFlight = null;
  });

  return _activationInFlight;
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
