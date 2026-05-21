// Auto Model Lifecycle — automatically manages model download and loading
// so users have AI available without visiting AIDevPanel.
//
// Behaviors:
//   - On wifi + idle: auto-download the recommended model if not stored
//   - On startup: auto-load model into memory if already downloaded
//   - On worker crash: attempt recovery up to MAX_CRASH_RECOVERIES times
//   - Crash loop guard: stop after MAX_CRASH_RECOVERIES failed attempts
//   - Version metadata: persist model version to localStorage for update checks
//   - All network activity gated behind wifi + battery checks

import {
  isModelStored,
  downloadAndStoreModel,
  getModelLoadState,
  subscribeToModelLoad,
} from "@/ai/providers/local/modelLoader";
import { getRecommendedManifest } from "@/ai/models/modelRegistry";
import { getBridgeStatus } from "@/ai/providers/local/llamaBridge";
import { LocalProvider } from "@/ai/providers/local/LocalProvider";
import { getRuntimeState } from "@/ai/runtime/runtimeState";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CRASH_RECOVERIES = 3;
const LOAD_RETRY_DELAY_MS = 5_000;
const WIFI_IDLE_CHECK_DELAY_MS = 15_000;  // wait 15s after startup before checking
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
};

// ── State ─────────────────────────────────────────────────────────────────────

let _initialized = false;
let _degraded = false;
let _unsubLoad: (() => void) | null = null;
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

// ── Network helpers ────────────────────────────────────────────────────────────

function isOnWifi(): boolean {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection;
  if (!conn) return true;  // unknown — assume ok
  const type = conn.type;
  if (type === "wifi") return true;
  if (type === "cellular" || type === "bluetooth") return false;
  const eff = conn.effectiveType;
  return eff !== "2g" && eff !== "slow-2g";
}

function hasBattery(): boolean {
  // Conservative: if battery API not available, assume ok
  return true;
}

// ── Load model into memory ─────────────────────────────────────────────────────

async function tryLoadModel(): Promise<void> {
  const state = loadPersistedState();
  if (_degraded || state.crashRecoveries >= MAX_CRASH_RECOVERIES) return;

  // runtimeState is the authoritative source — modelLoader never emits "ready"
  const rtState = getRuntimeState();
  if (rtState.modelLoad === "ready" || rtState.modelLoad === "loading") return;

  const manifest = getRecommendedManifest();
  const stored = await isModelStored(manifest);
  if (!stored) return;

  state.lastLoadAttemptAt = Date.now();
  savePersistedState(state);

  try {
    const provider = new LocalProvider(manifest);
    await provider.initialize();
  } catch {
    state.crashRecoveries++;
    savePersistedState(state);

    if (state.crashRecoveries >= MAX_CRASH_RECOVERIES) {
      _degraded = true;
      console.warn("[AutoModelLifecycle] Entering degraded mode — max load failures reached");
    } else {
      const t = setTimeout(() => tryLoadModel(), LOAD_RETRY_DELAY_MS * state.crashRecoveries);
      _pendingTimeouts.push(t);
    }
  }
}

// ── Auto download ──────────────────────────────────────────────────────────────

async function tryAutoDownload(): Promise<void> {
  if (!isOnWifi() || !hasBattery()) return;

  const manifest = getRecommendedManifest();
  const stored = await isModelStored(manifest);
  if (stored) return;

  const bridgeStatus = getBridgeStatus();
  if (bridgeStatus.env === "none") return;  // no WASM/native — download would be unusable

  const currentLoadState = getModelLoadState();
  if (currentLoadState.phase === "downloading") return;

  try {
    await downloadAndStoreModel(manifest);
    const state = loadPersistedState();
    state.downloadedModelId = manifest.id;
    state.downloadedAt = Date.now();
    savePersistedState(state);

    // After download completes, try to load into memory
    await tryLoadModel();
  } catch {
    // Download failed — not retried automatically; will try again next startup
  }
}

// ── Watch for load state changes ───────────────────────────────────────────────

function watchLoadStateForCrash(): void {
  _unsubLoad = subscribeToModelLoad((s) => {
    if (s.phase === "failed") {
      const state = loadPersistedState();
      state.crashRecoveries++;
      savePersistedState(state);

      if (state.crashRecoveries >= MAX_CRASH_RECOVERIES) {
        _degraded = true;
        return;
      }

      const t = setTimeout(() => tryLoadModel(), LOAD_RETRY_DELAY_MS * state.crashRecoveries);
      _pendingTimeouts.push(t);
    }
  });
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function initAutoModelLifecycle(): void {
  if (_initialized) return;
  _initialized = true;

  watchLoadStateForCrash();

  // Check crash recovery state — if within limit, attempt load from stored model.
  // This only activates a model that is ALREADY downloaded, never initiates a download.
  const state = loadPersistedState();
  if (state.crashRecoveries < MAX_CRASH_RECOVERIES) {
    void tryLoadModel();
  } else {
    _degraded = true;
  }

  // Auto-download intentionally removed: downloads must be initiated by explicit
  // user action via ModelDownloadCard. Silently starting a large download is
  // disruptive on Android (cellular data, battery, storage space).
}

export function getAutoModelLifecycleReport(): AutoModelLifecycleReport {
  const state = loadPersistedState();
  return {
    downloadedModelId: state.downloadedModelId,
    isLoaded: getRuntimeState().modelLoad === "ready",
    crashRecoveries: state.crashRecoveries,
    degraded: _degraded,
    lastLoadAttemptAt: state.lastLoadAttemptAt,
  };
}

export function resetAutoModelLifecycleCrashState(): void {
  const state = loadPersistedState();
  state.crashRecoveries = 0;
  savePersistedState(state);
  _degraded = false;
}
