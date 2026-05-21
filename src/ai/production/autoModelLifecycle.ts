// Auto Model Lifecycle — manages startup activation of a downloaded model.
//
// All activation is routed through tryActivateLocalProvider() in the orchestrator,
// which owns the single activation mutex. This prevents concurrent WASM loads
// (the primary cause of OOM on mid-range Android).
//
// Recovery policy:
//   - OOM failures: do not retry — another attempt will also OOM. Enter degraded immediately.
//   - Other failures (timeout, bridge): retry up to MAX_CRASH_RECOVERIES times with backoff.
//   - Degraded: patch runtimeState to failed_degraded so the UI can surface an explicit error.

import { isModelStored } from "@/ai/providers/local/modelLoader";
import { getRecommendedManifest } from "@/ai/models/modelRegistry";
import { getBridgeStatus } from "@/ai/providers/local/llamaBridge";
import { getRuntimeState, patchRuntimeState } from "@/ai/runtime/runtimeState";
import { tryActivateLocalProvider } from "@/ai/orchestration/orchestrator";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CRASH_RECOVERIES = 3;
const LOAD_RETRY_DELAY_MS = 5_000;
const STORAGE_KEY = "ai_model_lifecycle_v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type PersistedLifecycleState = {
  downloadedModelId: string | null;
  downloadedAt: number | null;
  crashRecoveries: number;
  lastLoadAttemptAt: number | null;
};

type AutoModelLifecycleReport = {
  downloadedModelId: string | null;
  isLoaded: boolean;
  crashRecoveries: number;
  degraded: boolean;
  lastLoadAttemptAt: number | null;
  activationFailureReason: string | null;
};

// ── State ─────────────────────────────────────────────────────────────────────

let _initialized = false;
let _degraded = false;
let _activationFailureReason: string | null = null;
let _pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function loadPersistedState(): PersistedLifecycleState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {
      downloadedModelId: null,
      downloadedAt: null,
      crashRecoveries: 0,
      lastLoadAttemptAt: null,
    };
  } catch {
    return { downloadedModelId: null, downloadedAt: null, crashRecoveries: 0, lastLoadAttemptAt: null };
  }
}

function savePersistedState(s: PersistedLifecycleState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

// ── Activation ────────────────────────────────────────────────────────────────

async function tryLoadModel(): Promise<void> {
  if (_degraded) return;

  const state = loadPersistedState();
  if (state.crashRecoveries >= MAX_CRASH_RECOVERIES) {
    _degraded = true;
    return;
  }

  // If WASM is already loaded or currently loading, nothing to do.
  const rtState = getRuntimeState();
  if (rtState.modelLoad === "ready" || rtState.modelLoad === "loading") return;

  // If a previous attempt left a terminal OOM failure, do not retry.
  if (rtState.modelLoad === "failed_oom" || rtState.modelLoad === "failed_degraded") return;

  const manifest = getRecommendedManifest();
  const stored = await isModelStored(manifest);
  if (!stored) return;

  // Bail early if the WASM bridge is known to be unavailable on this device.
  if (getBridgeStatus().env === "none") {
    _degraded = true;
    _activationFailureReason = "Offline AI is not supported on this device.";
    patchRuntimeState({
      modelLoad: "failed_degraded",
      lastError: _activationFailureReason,
    });
    return;
  }

  state.lastLoadAttemptAt = Date.now();
  savePersistedState(state);

  // Route through the orchestrator — this respects the activation mutex and
  // ensures the provider is registered when initialization succeeds.
  const success = await tryActivateLocalProvider(manifest);

  if (success) return;

  // Activation failed. Check whether LocalProvider classified it as OOM.
  const afterRt = getRuntimeState();
  const isOom = afterRt.modelLoad === "failed_oom";

  if (isOom) {
    // OOM is not retryable without a device restart — skip straight to degraded.
    _degraded = true;
    _activationFailureReason = afterRt.lastError
      ?? "Not enough memory to load offline AI. Restart the app and close other apps first.";
    patchRuntimeState({
      modelLoad: "failed_degraded",
      lastError: _activationFailureReason,
    });
    return;
  }

  // Non-OOM failure — count it and schedule a retry with backoff.
  state.crashRecoveries++;
  savePersistedState(state);

  if (state.crashRecoveries >= MAX_CRASH_RECOVERIES) {
    _degraded = true;
    _activationFailureReason = afterRt.lastError
      ?? "Offline AI could not start after multiple attempts. Restart the app to try again.";
    patchRuntimeState({
      modelLoad: "failed_degraded",
      lastError: _activationFailureReason,
    });
    return;
  }

  const t = setTimeout(() => void tryLoadModel(), LOAD_RETRY_DELAY_MS * state.crashRecoveries);
  _pendingTimeouts.push(t);
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function initAutoModelLifecycle(): void {
  if (_initialized) return;
  _initialized = true;

  const state = loadPersistedState();
  if (state.crashRecoveries >= MAX_CRASH_RECOVERIES) {
    _degraded = true;
    return;
  }

  void tryLoadModel();
}

export function getAutoModelLifecycleReport(): AutoModelLifecycleReport {
  const state = loadPersistedState();
  return {
    downloadedModelId: state.downloadedModelId,
    isLoaded: getRuntimeState().modelLoad === "ready",
    crashRecoveries: state.crashRecoveries,
    degraded: _degraded,
    lastLoadAttemptAt: state.lastLoadAttemptAt,
    activationFailureReason: _activationFailureReason,
  };
}

export function resetAutoModelLifecycleCrashState(): void {
  const state = loadPersistedState();
  state.crashRecoveries = 0;
  savePersistedState(state);
  _degraded = false;
  _activationFailureReason = null;
  // Clear the degraded runtimeState so the next tryLoadModel() can proceed.
  const rt = getRuntimeState();
  if (rt.modelLoad === "failed_degraded") {
    patchRuntimeState({ modelLoad: "not_loaded", lastError: null });
  }
}

/** Returns the failure reason if this session entered degraded state, null otherwise. */
export function getActivationFailureReason(): string | null {
  return _activationFailureReason;
}

/** True if autoModelLifecycle has permanently stopped retrying this session. */
export function isAutoModelDegraded(): boolean {
  return _degraded;
}

// Unused download helper retained for compatibility — auto-download is intentionally
// disabled. Downloads must be user-initiated via ModelDownloadCard.
export function getAutoDownloadEnabled(): false {
  return false;
}
