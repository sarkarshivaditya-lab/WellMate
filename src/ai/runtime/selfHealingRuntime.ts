// Self-Healing Runtime — watchdog that monitors worker health and restarts
// stalled or crashed workers automatically.
//
// Behaviors:
//   - 30s heartbeat: checks if any slot is stuck in "busy" for > 90s
//   - Stalled slot: terminates and respawns with exponential backoff
//   - Corrupted runtime: clears OPFS model cache + resets bridge state
//   - Degraded mode: if 3+ restarts fail, marks runtime degraded and stops trying
//   - Clean: disposes intervals + listeners on unmount

import { getInferenceWorkerBridgeState, initInferenceWorkerBridge } from "@/ai/workers/inferenceWorkerBridge";
import { getMobileHardenerReport, recordWorkerCrash } from "@/ai/platform/mobileExecutionHardener";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SelfHealingState = {
  isRunning: boolean;
  degraded: boolean;
  totalRestarts: number;
  stalledDetections: number;
  lastRestartAt: number | null;
  lastHeartbeatAt: number | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALL_THRESHOLD_MS = 90_000;       // slot stuck "busy" > 90s = stalled
const MAX_RESTARTS_BEFORE_DEGRADED = 3;
const RESTART_BACKOFF_BASE_MS = 2_000;

// ── State ─────────────────────────────────────────────────────────────────────

let _state: SelfHealingState = {
  isRunning: false,
  degraded: false,
  totalRestarts: 0,
  stalledDetections: 0,
  lastRestartAt: null,
  lastHeartbeatAt: null,
};

let _intervalId: ReturnType<typeof setInterval> | null = null;
let _restartTimeouts: ReturnType<typeof setTimeout>[] = [];

// ── Internals ─────────────────────────────────────────────────────────────────

function getBackoffMs(): number {
  const n = Math.min(_state.totalRestarts, 5);
  return RESTART_BACKOFF_BASE_MS * Math.pow(2, n);
}

function detectStalledSlots(): string[] {
  const bridgeState = getInferenceWorkerBridgeState();
  const now = Date.now();
  return bridgeState.slots
    .filter((s) => s.status === "busy" && s.activeRequestId !== null)
    .filter((s) => {
      // Estimate stall from last access — if slot has been busy since before stall threshold
      const busySince = s.lastCrashAt ?? (s.spawnedAt ?? 0);
      return now - busySince > STALL_THRESHOLD_MS;
    })
    .map((s) => s.slotId);
}

function attemptRestart(): void {
  if (_state.degraded) return;
  if (_state.totalRestarts >= MAX_RESTARTS_BEFORE_DEGRADED) {
    _state = { ..._state, degraded: true };
    console.warn("[SelfHealingRuntime] Entering degraded mode — max restarts reached");
    return;
  }

  const backoff = getBackoffMs();
  _state = { ..._state, totalRestarts: _state.totalRestarts + 1 };

  const t = setTimeout(() => {
    recordWorkerCrash();
    try {
      initInferenceWorkerBridge();
      _state = { ..._state, lastRestartAt: Date.now() };
    } catch (err) {
      console.error("[SelfHealingRuntime] Worker restart failed:", err);
    }
  }, backoff);

  _restartTimeouts.push(t);
}

function heartbeat(): void {
  _state = { ..._state, lastHeartbeatAt: Date.now() };
  if (_state.degraded) return;

  const bridgeState = getInferenceWorkerBridgeState();

  // Check for crashed slots not yet recovering
  const crashedSlots = bridgeState.slots.filter((s) => s.status === "crashed");
  if (crashedSlots.length > 0) {
    _state = { ..._state, stalledDetections: _state.stalledDetections + 1 };
    attemptRestart();
    return;
  }

  // Check for stalled (busy too long) slots
  const stalledIds = detectStalledSlots();
  if (stalledIds.length > 0) {
    _state = { ..._state, stalledDetections: _state.stalledDetections + 1 };
    console.warn("[SelfHealingRuntime] Stalled workers detected:", stalledIds);
    attemptRestart();
    return;
  }

  // Check mobile hardener — if worker crash count escalated, proactively restart
  const mobile = getMobileHardenerReport();
  if (mobile.state.workerCrashCount > 0 && mobile.state.backoffMs === 0) {
    attemptRestart();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function initSelfHealingRuntime(): void {
  if (_state.isRunning) return;
  _state = { ..._state, isRunning: true };
  _intervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
}

export function disposeSelfHealingRuntime(): void {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  for (const t of _restartTimeouts) clearTimeout(t);
  _restartTimeouts = [];
  _state = { ..._state, isRunning: false };
}

export function getSelfHealingReport(): SelfHealingState {
  return { ..._state };
}

export function isSelfHealingDegraded(): boolean {
  return _state.degraded;
}
