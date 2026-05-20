// Inference Worker — dedicated Web Worker execution unit for llama.cpp inference.
//
// Owns the WASM heap for the lifetime of the worker. When a wasm-threads binary
// is deployed and COOP/COEP headers are active, real multi-thread inference runs
// entirely inside this worker without touching the main thread heap.
//
// Current state: full execution protocol is wired; WASM dispatch is stubbed
// until the wasm-threads binary + COOP/COEP headers are live in production.
//
// Message protocol:
//   Main → Worker : InferenceWorkerRequest  (init | infer | cancel | health_check | shutdown)
//   Worker → Main : InferenceWorkerResponse (ready | token | complete | error | health | cancelled)
//
// Cancellation paths:
//   1. SAB Atomics: Atomics.store(cancelFlag, 0, 1) — zero-latency, cross-thread
//   2. postMessage { type: "cancel" } — fallback when SAB unavailable
//
// Token delivery paths:
//   1. SAB ring buffer — zero-copy; worker writes, main thread drains
//   2. postMessage { type: "token" } — fallback when SAB unavailable or ring full

interface WorkerGlobal {
  postMessage(data: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
  close(): void;
}

const ctx = self as unknown as WorkerGlobal;

// ── Message types ─────────────────────────────────────────────────────────────

export type WorkerInitConfig = {
  workerId: string;
  threadCount: number;
  maxTokens: number;
  nCtx: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  modelId?: string;
};

export type InferenceRequestConfig = {
  maxTokens: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  nCtx: number;
};

export type InferenceWorkerStats = {
  tokensGenerated: number;
  durationMs: number;
  tokPerSec: number;
  cancelled: boolean;
  wasmMode: "real" | "stub";
  threads: number;
};

type InferenceWorkerRequest =
  | { type: "init"; config: WorkerInitConfig }
  | { type: "infer"; requestId: string; prompt: string; config: InferenceRequestConfig; cancelBuffer?: SharedArrayBuffer; ringBuffer?: SharedArrayBuffer }
  | { type: "cancel"; requestId: string }
  | { type: "health_check" }
  | { type: "shutdown" };

type InferenceWorkerResponse =
  | { type: "ready"; workerId: string; supportsThreaded: boolean; supportsSab: boolean; wasmAvailable: boolean }
  | { type: "token"; requestId: string; token: string }
  | { type: "complete"; requestId: string; stats: InferenceWorkerStats }
  | { type: "error"; requestId: string; message: string; code: string }
  | { type: "health"; workerId: string; status: "healthy" | "degraded"; heapMb: number; inferenceCount: number; uptimeMs: number }
  | { type: "cancelled"; requestId: string };

// ── Worker state ───────────────────────────────────────────────────────────────

let _workerId = `iw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
let _initConfig: WorkerInitConfig | null = null;
let _inferenceCount = 0;
let _activeRequestId: string | null = null;
const _startTime = Date.now();

// ── Ring buffer write — self-contained (Workers cannot import from main bundle) ─
// Layout mirrors sabMemoryManager.ts: [writeHead:Int32][readHead:Int32][length:Int32][data...]

function ringWrite(buf: SharedArrayBuffer, token: string): boolean {
  const meta = new Int32Array(buf, 0, 3);
  const cap = buf.byteLength - 12;
  const data = new Uint8Array(buf, 12);
  const encoded = new TextEncoder().encode(token);
  const needed = encoded.length + 4;
  if (needed > cap) return false;

  const wh = Atomics.load(meta, 0);
  const rh = Atomics.load(meta, 1);
  const used = (wh - rh + cap) % cap;
  if (used + needed > cap - 1) return false;

  const lenBuf = new Uint8Array(4);
  new DataView(lenBuf.buffer).setUint32(0, encoded.length, true);
  for (let i = 0; i < 4; i++) data[(wh + i) % cap] = lenBuf[i];
  for (let i = 0; i < encoded.length; i++) data[(wh + 4 + i) % cap] = encoded[i];

  Atomics.store(meta, 0, (wh + needed) % cap);
  return true;
}

// ── Stub inference — exercises full protocol without real WASM ─────────────────

const STUB_TOKENS = [
  "Inference", " runtime", " active", ".", " WASM", " threads", " pending",
  " deployment", ".", " Full", " execution", " protocol", " wired", " and",
  " ready", " for", " binary", " integration", ".",
];
const STUB_TOK_PER_SEC = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runStubInference(
  requestId: string,
  config: InferenceRequestConfig,
  cancelFlag: Int32Array | null,
  ringBuffer: SharedArrayBuffer | undefined,
): Promise<void> {
  const start = performance.now();
  let tokensGenerated = 0;
  const target = Math.min(config.maxTokens, STUB_TOKENS.length);

  for (let i = 0; i < target; i++) {
    // SAB cancellation — zero latency path
    if (cancelFlag && Atomics.load(cancelFlag, 0) === 1) {
      send({ type: "cancelled", requestId });
      return;
    }
    // postMessage cancellation — fallback path
    if (_activeRequestId !== requestId) {
      send({ type: "cancelled", requestId });
      return;
    }

    const token = STUB_TOKENS[i];
    const deliveredToRing = ringBuffer ? ringWrite(ringBuffer, token) : false;
    if (!deliveredToRing) {
      // Ring full or unavailable — fall back to postMessage
      send({ type: "token", requestId, token });
    }

    tokensGenerated++;
    await sleep(1000 / STUB_TOK_PER_SEC);
  }

  const durationMs = performance.now() - start;
  send({
    type: "complete",
    requestId,
    stats: {
      tokensGenerated,
      durationMs,
      tokPerSec: durationMs > 0 ? tokensGenerated / (durationMs / 1000) : 0,
      cancelled: false,
      wasmMode: "stub",
      threads: _initConfig?.threadCount ?? 1,
    },
  });
}

// ── Message dispatch ──────────────────────────────────────────────────────────

function send(msg: InferenceWorkerResponse): void {
  ctx.postMessage(msg);
}

ctx.onmessage = async (event: MessageEvent<InferenceWorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      _initConfig = msg.config;
      _workerId = msg.config.workerId;
      send({
        type: "ready",
        workerId: _workerId,
        supportsThreaded: typeof SharedArrayBuffer !== "undefined",
        supportsSab: typeof Atomics !== "undefined",
        wasmAvailable: false, // real binary not yet deployed
      });
      break;
    }

    case "infer": {
      if (!_initConfig) {
        send({ type: "error", requestId: msg.requestId, message: "Worker not initialized", code: "NOT_INITIALIZED" });
        return;
      }
      _activeRequestId = msg.requestId;
      _inferenceCount++;
      const cancelFlag = msg.cancelBuffer ? new Int32Array(msg.cancelBuffer) : null;
      try {
        await runStubInference(msg.requestId, msg.config, cancelFlag, msg.ringBuffer);
      } catch (err) {
        send({
          type: "error",
          requestId: msg.requestId,
          message: err instanceof Error ? err.message : "Inference error",
          code: "INFERENCE_ERROR",
        });
      } finally {
        if (_activeRequestId === msg.requestId) _activeRequestId = null;
      }
      break;
    }

    case "cancel": {
      if (_activeRequestId === msg.requestId) _activeRequestId = null;
      break;
    }

    case "health_check": {
      send({
        type: "health",
        workerId: _workerId,
        status: "healthy",
        heapMb: 0, // WASM heap reports real usage when binary is live
        inferenceCount: _inferenceCount,
        uptimeMs: Date.now() - _startTime,
      });
      break;
    }

    case "shutdown": {
      ctx.close();
      break;
    }
  }
};

export {};
