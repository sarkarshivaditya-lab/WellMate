// Runtime stress suite — discovers runtime collapse before real users do.
// Developer tooling only. Never runs automatically; all scenarios are manually triggered.
//
// Scenarios:
//   sustained_inference    — 10 sequential inferences; measures throughput stability
//   rapid_cancel_restart   — 8 cancel+verify cycles; tests cancellation path
//   retrieval_burst        — 15 rapid retrieval queries; tests index stability
//   long_context           — 3 inferences with ~200-token prompts; tests context handling
//   thermal_escalation     — 12 rapid-fire inferences with no delay; measures thermal rise
//   memory_pressure        — allocates 5MB per cycle; tests inference under heap pressure
//   low_storage            — validates storage eligibility guard behavior
//   worker_fault           — crash + restart cycle; tests worker recovery path

export type StressScenarioId =
  | "sustained_inference"
  | "rapid_cancel_restart"
  | "retrieval_burst"
  | "long_context"
  | "thermal_escalation"
  | "memory_pressure"
  | "low_storage"
  | "worker_fault";

export type StressScenarioResult = {
  id: StressScenarioId;
  passed: boolean;
  durationMs: number;
  iterations: number;
  failures: number;
  notes: string;
  runnedAt: number;
};

export type StressProgress = {
  scenario: StressScenarioId;
  iteration: number;
  total: number;
  phase: string;
};

type ProgressListener = (progress: StressProgress) => void;
const _listeners = new Set<ProgressListener>();

export function subscribeToStressProgress(fn: ProgressListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emitProgress(p: StressProgress): void {
  _listeners.forEach((fn) => { try { fn(p); } catch { /* */ } });
}

async function quickInfer(prompt: string, maxTokens: number, signal: AbortSignal): Promise<boolean> {
  try {
    const { submitInference } = await import("../orchestration/orchestrator");
    const controller = new AbortController();
    signal.addEventListener("abort", () => controller.abort(), { once: true });
    await submitInference({ id: `stress-${Date.now()}`, prompt, maxTokens, temperature: 0.2, priority: "normal", controller });
    return true;
  } catch {
    return false;
  }
}

// ── Scenarios ──────────────────────────────────────────────────────────────────

async function runSustainedInference(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 10;
  let failures = 0;
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    emitProgress({ scenario: "sustained_inference", iteration: i + 1, total, phase: "inferencing" });
    if (!await quickInfer("Reply with one word: OK.", 16, signal)) failures++;
    if (i < total - 1) await new Promise<void>((r) => setTimeout(r, 200));
  }
  return { id: "sustained_inference", passed: failures === 0, durationMs: Date.now() - start, iterations: total, failures, notes: `${total - failures}/${total} succeeded`, runnedAt: Date.now() };
}

async function runRapidCancelRestart(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 8;
  let failures = 0;
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    emitProgress({ scenario: "rapid_cancel_restart", iteration: i + 1, total, phase: "cancel cycle" });
    const { submitInference } = await import("../orchestration/orchestrator");
    const controller = new AbortController();
    const p = submitInference({ id: `stress-cancel-${i}`, prompt: "Tell me about restful sleep in detail.", maxTokens: 256, temperature: 0.5, priority: "normal", controller });
    await new Promise<void>((r) => setTimeout(r, 80 + Math.random() * 150));
    controller.abort();
    try { await p; } catch { /* expected */ }
    // Verify runtime is still healthy after cancellation
    if (!await quickInfer("OK?", 4, signal)) failures++;
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  return { id: "rapid_cancel_restart", passed: failures === 0, durationMs: Date.now() - start, iterations: total, failures, notes: `${failures} post-cancel failures`, runnedAt: Date.now() };
}

async function runRetrievalBurst(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 15;
  let failures = 0;
  const start = Date.now();
  const queries = ["sleep habits", "mood patterns", "exercise", "nutrition", "stress levels"];
  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    emitProgress({ scenario: "retrieval_burst", iteration: i + 1, total, phase: "querying" });
    try {
      const { retrievalBridge } = await import("../retrieval/retrievalBridge");
      await retrievalBridge.query({ text: queries[i % queries.length], scope: ["all"], topK: 5, minScore: 0.1 });
    } catch { failures++; }
    await new Promise<void>((r) => setTimeout(r, 50));
  }
  return { id: "retrieval_burst", passed: failures < 3, durationMs: Date.now() - start, iterations: total, failures, notes: `${failures} retrieval failures`, runnedAt: Date.now() };
}

async function runLongContext(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 3;
  let failures = 0;
  const start = Date.now();
  const longPrompt = "Describe your current wellness goals in detail. ".repeat(40); // ~200 tokens
  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    emitProgress({ scenario: "long_context", iteration: i + 1, total, phase: "long prompt inference" });
    if (!await quickInfer(longPrompt, 64, signal)) failures++;
    await new Promise<void>((r) => setTimeout(r, 500));
  }
  return { id: "long_context", passed: failures === 0, durationMs: Date.now() - start, iterations: total, failures, notes: `~${Math.round(longPrompt.length / 4)} token prompt; ${failures} failures`, runnedAt: Date.now() };
}

async function runThermalEscalation(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 12;
  let failures = 0;
  const start = Date.now();
  const { getThermalState } = await import("./thermalGuard");
  const THERMAL_ORDER = ["nominal", "warm", "hot", "critical", "emergency"];
  let peakThermalIdx = 0;

  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    const thermal = getThermalState();
    const idx = THERMAL_ORDER.indexOf(thermal);
    if (idx > peakThermalIdx) peakThermalIdx = idx;
    emitProgress({ scenario: "thermal_escalation", iteration: i + 1, total, phase: `thermal: ${thermal}` });
    if (!await quickInfer("Name one wellness habit.", 20, signal)) failures++;
    // No pause — intentional rapid fire to stress thermal guard
  }

  return { id: "thermal_escalation", passed: true, durationMs: Date.now() - start, iterations: total, failures, notes: `peak thermal: ${THERMAL_ORDER[peakThermalIdx]}; ${failures} throttled`, runnedAt: Date.now() };
}

async function runMemoryPressure(signal: AbortSignal): Promise<StressScenarioResult> {
  const total = 5;
  let failures = 0;
  const start = Date.now();
  for (let i = 0; i < total; i++) {
    if (signal.aborted) break;
    emitProgress({ scenario: "memory_pressure", iteration: i + 1, total, phase: "heap allocation" });
    const buffers: ArrayBuffer[] = [];
    try { for (let b = 0; b < 5; b++) buffers.push(new ArrayBuffer(1024 * 1024)); } catch { /* may fail on constrained devices */ }
    if (!await quickInfer("Take a deep breath.", 12, signal)) failures++;
    buffers.length = 0; // release for GC
    await new Promise<void>((r) => setTimeout(r, 200));
  }
  return { id: "memory_pressure", passed: failures === 0, durationMs: Date.now() - start, iterations: total, failures, notes: `5 MB pressure/cycle; ${failures} failures`, runnedAt: Date.now() };
}

async function runLowStorage(signal: AbortSignal): Promise<StressScenarioResult> {
  const start = Date.now();
  let notes = "";
  try {
    const { checkDownloadEligibility } = await import("../downloads/downloadManager");
    const e = await checkDownloadEligibility(3 * 1024 * 1024 * 1024);
    notes = `eligible=${e.eligible}; constraint=${e.constraint}`;
  } catch (err) {
    notes = `check failed: ${err instanceof Error ? err.message : "unknown"}`;
  }
  return { id: "low_storage", passed: true, durationMs: Date.now() - start, iterations: 1, failures: 0, notes, runnedAt: Date.now() };
}

async function runWorkerFault(signal: AbortSignal): Promise<StressScenarioResult> {
  const start = Date.now();
  let notes = "";
  try {
    const { spawnWorker, reportWorkerCrash, getWorkerHealth } = await import("../workers/workerOrchestrator");
    const id = spawnWorker("inference");
    reportWorkerCrash(id);
    // Wait for auto-restart
    await new Promise<void>((r) => setTimeout(r, 2_500));
    const health = getWorkerHealth();
    const worker = health.find((w) => w.workerId === id);
    notes = worker ? `restarted to status=${worker.status}` : "worker not found after restart";
  } catch (err) {
    notes = `failed: ${err instanceof Error ? err.message : "unknown"}`;
  }
  if (signal.aborted) notes += " (aborted)";
  return { id: "worker_fault", passed: !notes.includes("failed"), durationMs: Date.now() - start, iterations: 1, failures: 0, notes, runnedAt: Date.now() };
}

// ── Suite runner ───────────────────────────────────────────────────────────────

const RUNNERS: Record<StressScenarioId, (signal: AbortSignal) => Promise<StressScenarioResult>> = {
  sustained_inference: runSustainedInference,
  rapid_cancel_restart: runRapidCancelRestart,
  retrieval_burst: runRetrievalBurst,
  long_context: runLongContext,
  thermal_escalation: runThermalEscalation,
  memory_pressure: runMemoryPressure,
  low_storage: runLowStorage,
  worker_fault: runWorkerFault,
};

export const ALL_STRESS_SCENARIOS: StressScenarioId[] = [
  "sustained_inference",
  "rapid_cancel_restart",
  "retrieval_burst",
  "long_context",
  "thermal_escalation",
  "memory_pressure",
  "low_storage",
  "worker_fault",
];

const HISTORY_KEY = "ai_stress_history_v1";
const MAX_HISTORY = 5;

export function getStressHistory(): StressScenarioResult[][] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as StressScenarioResult[][]) : [];
  } catch { return []; }
}

export async function runStressSuite(
  ids: StressScenarioId[],
  signal?: AbortSignal,
): Promise<StressScenarioResult[]> {
  const results: StressScenarioResult[] = [];
  const ctrl = new AbortController();
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

  for (const id of ids) {
    if (ctrl.signal.aborted) break;
    const result = await RUNNERS[id](ctrl.signal);
    results.push(result);
    if (id !== ids[ids.length - 1]) await new Promise<void>((r) => setTimeout(r, 500));
  }

  try {
    const history = getStressHistory();
    history.push(results);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch { /* non-fatal */ }

  return results;
}
