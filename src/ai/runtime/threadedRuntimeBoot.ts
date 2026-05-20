// Threaded Runtime Boot — integration contracts for wasm-threads llama.cpp.
//
// Defines the boot sequence a real threaded WASM inference runtime must complete:
//
//   Stage 1 — ENVIRONMENT   Validate SAB + COOP/COEP + thread count
//   Stage 2 — MODULE        Fetch + compile WASM module (once per worker)
//   Stage 3 — HEAP          Initialize WASM linear memory in worker thread
//   Stage 4 — MODEL_LOAD    Load model from OPFS/native into WASM heap
//   Stage 5 — WARMUP        First inference to prime JIT + KV cache
//   Stage 6 — READY         Signal to bridge; slot accepts inference requests
//
// Current state: contracts defined + diagnostics wired; WASM dispatch is stubbed
// until the binary + headers are live. The boot orchestration is fully integration-ready.
//
// Thread allocation: each worker independently claims a slice of hardware threads.
// The bridge negotiates total thread count via adaptiveThreadScaler before spawning.

import { computeThreadScaleDecision } from "./adaptiveThreadScaler";
import { getThreadingCapability } from "./threadingCapability";
import { isSabAvailable } from "./sabMemoryManager";

// ── Boot stage types ──────────────────────────────────────────────────────────

export type ThreadedBootStage =
  | "environment"
  | "module_compile"
  | "heap_init"
  | "model_load"
  | "warmup"
  | "ready";

export type ThreadedBootStageResult = {
  stage: ThreadedBootStage;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  durationMs: number | null;
  detail: string;
};

export type ThreadedBootSession = {
  sessionId: string;
  startedAt: number;
  completedAt: number | null;
  stages: ThreadedBootStageResult[];
  success: boolean;
  threadCount: number;
  failureReason: string | null;
};

export type ThreadedBootStatus = {
  lastSession: ThreadedBootSession | null;
  totalAttempts: number;
  successfulBoots: number;
  averageBootMs: number | null;
  currentlyBooting: boolean;
  blockingReason: string | null;
};

export type ThreadCapabilityNegotiation = {
  requestedThreads: number;
  grantedThreads: number;
  reason: string;
  sabAvailable: boolean;
  crossOriginIsolated: boolean;
  hardwareConcurrency: number;
};

// ── Storage ────────────────────────────────────────────────────────────────────

const BOOT_HISTORY_KEY = "ai_threaded_boot_history_v1";
const MAX_HISTORY = 20;

let _currentSession: ThreadedBootSession | null = null;
let _totalAttempts = 0;
let _successfulBoots = 0;
let _currentlyBooting = false;

function loadHistory(): ThreadedBootSession[] {
  try { return JSON.parse(localStorage.getItem(BOOT_HISTORY_KEY) ?? "[]") as ThreadedBootSession[]; }
  catch { return []; }
}

function saveSession(session: ThreadedBootSession): void {
  try {
    const history = loadHistory();
    history.push(session);
    localStorage.setItem(BOOT_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch { /* storage full */ }
}

// ── Thread capability negotiation ─────────────────────────────────────────────

export function negotiateThreadAllocation(requestedThreads: number): ThreadCapabilityNegotiation {
  const cap = getThreadingCapability();
  const sabAvailable = isSabAvailable();
  const crossOriginIsolated = self.crossOriginIsolated ?? false;
  const hw = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 1 : 1;

  let granted = requestedThreads;
  let reason = "granted as requested";

  if (!sabAvailable) {
    granted = 1;
    reason = "SAB unavailable — single thread only";
  } else if (!crossOriginIsolated) {
    granted = 1;
    reason = "COOP/COEP not active — SAB degraded";
  } else if (cap.mode !== "multi_thread_eligible") {
    granted = 1;
    reason = `threading mode: ${cap.mode}`;
  } else if (granted > hw) {
    granted = hw;
    reason = `capped at hardware concurrency (${hw})`;
  }

  return { requestedThreads, grantedThreads: granted, reason, sabAvailable, crossOriginIsolated, hardwareConcurrency: hw };
}

// ── Boot session simulation (full protocol, WASM stubbed) ─────────────────────

const STAGE_ORDER: ThreadedBootStage[] = [
  "environment", "module_compile", "heap_init", "model_load", "warmup", "ready",
];

function makeStageResult(stage: ThreadedBootStage): ThreadedBootStageResult {
  return { stage, status: "pending", durationMs: null, detail: "" };
}

export async function runThreadedBoot(opts: {
  threadCount?: number;
  modelId?: string;
  onStageChange?: (stage: ThreadedBootStage, status: ThreadedBootStageResult["status"]) => void;
} = {}): Promise<ThreadedBootSession> {
  if (_currentlyBooting) {
    return _currentSession ?? {
      sessionId: "in-progress",
      startedAt: Date.now(), completedAt: null,
      stages: [], success: false, threadCount: 0, failureReason: "already booting",
    };
  }

  _currentlyBooting = true;
  _totalAttempts++;

  const decision = computeThreadScaleDecision();
  const threadCount = opts.threadCount ?? decision.targetThreads;
  const negotiation = negotiateThreadAllocation(threadCount);

  const session: ThreadedBootSession = {
    sessionId: `boot-${Date.now()}`,
    startedAt: Date.now(), completedAt: null,
    stages: STAGE_ORDER.map(makeStageResult),
    success: false, threadCount: negotiation.grantedThreads, failureReason: null,
  };
  _currentSession = session;

  const setStage = (stage: ThreadedBootStage, status: ThreadedBootStageResult["status"], detail: string, durationMs: number | null) => {
    const result = session.stages.find((s) => s.stage === stage);
    if (result) { result.status = status; result.detail = detail; result.durationMs = durationMs; }
    opts.onStageChange?.(stage, status);
  };

  try {
    // Stage 1: Environment validation
    const t1 = Date.now();
    setStage("environment", "running", "", null);
    await delay(5);
    if (!negotiation.sabAvailable && negotiation.grantedThreads > 1) {
      throw new Error("SAB required for multi-thread inference");
    }
    setStage("environment", "complete",
      `threads=${negotiation.grantedThreads} sab=${negotiation.sabAvailable} isolated=${negotiation.crossOriginIsolated}`,
      Date.now() - t1);

    // Stage 2: WASM module compile (stubbed — binary not deployed)
    const t2 = Date.now();
    setStage("module_compile", "running", "", null);
    await delay(10);
    // Real: const module = await WebAssembly.compileStreaming(fetch(WASM_URL))
    setStage("module_compile", "skipped", "wasm-threads binary pending deployment", Date.now() - t2);

    // Stage 3: WASM heap init (stubbed)
    const t3 = Date.now();
    setStage("heap_init", "running", "", null);
    await delay(5);
    // Real: instantiate with { memory: new WebAssembly.Memory({ shared: true, initial: 256, maximum: 4096 }) }
    setStage("heap_init", "skipped", "WASM module not compiled", Date.now() - t3);

    // Stage 4: Model load from OPFS (stubbed)
    const t4 = Date.now();
    setStage("model_load", "running", "", null);
    await delay(5);
    // Real: llama_model_load_from_file(model_path, params) in WASM heap
    setStage("model_load", "skipped", opts.modelId ? `model: ${opts.modelId}` : "no model specified", Date.now() - t4);

    // Stage 5: Warmup inference (stubbed)
    const t5 = Date.now();
    setStage("warmup", "running", "", null);
    await delay(5);
    setStage("warmup", "skipped", "model not loaded", Date.now() - t5);

    // Stage 6: Ready
    const t6 = Date.now();
    setStage("ready", "running", "", null);
    await delay(2);
    setStage("ready", "complete", `worker ready (stub mode, ${negotiation.grantedThreads} thread(s))`, Date.now() - t6);

    session.success = true;
    _successfulBoots++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Boot failed";
    session.failureReason = msg;
    // Mark remaining stages as failed
    for (const stage of session.stages) {
      if (stage.status === "pending" || stage.status === "running") {
        stage.status = "failed";
        stage.detail = msg;
      }
    }
  } finally {
    session.completedAt = Date.now();
    _currentlyBooting = false;
    saveSession(session);
  }

  return session;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getThreadedBootStatus(): ThreadedBootStatus {
  const history = loadHistory();
  const successes = history.filter((s) => s.success);
  const avgMs = successes.length > 0
    ? successes.reduce((sum, s) => sum + ((s.completedAt ?? s.startedAt) - s.startedAt), 0) / successes.length
    : null;

  let blockingReason: string | null = null;
  if (!isSabAvailable()) blockingReason = "SharedArrayBuffer unavailable";
  else if (!(self.crossOriginIsolated ?? false)) blockingReason = "COOP/COEP headers not active";
  else if (computeThreadScaleDecision().targetThreads === 0) blockingReason = "thread count = 0 (thermal/policy)";

  return {
    lastSession: history[history.length - 1] ?? null,
    totalAttempts: _totalAttempts,
    successfulBoots: _successfulBoots,
    averageBootMs: avgMs,
    currentlyBooting: _currentlyBooting,
    blockingReason,
  };
}

export function getBootHistory(): ThreadedBootSession[] {
  return loadHistory();
}
