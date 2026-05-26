// Local AI provider — runs inference via llama.cpp (WASM or native Capacitor).
// Falls back gracefully when the bridge or model is unavailable.
//
// Memory safety:
//   - Model is loaded from a Blob reference (OPFS File or IDB Blob).
//   - No intermediate blob URL — avoids holding 2× model size in RAM.
//   - Per-device load timeout prevents hanging on slow/incompatible devices.
//
// Logging: every async phase emits [AI INIT +Xms] to console. On Android,
// these are visible in adb logcat and show exactly which phase stalls.

import type { AIProvider } from "../types";
import type { InferenceRequest, InferenceResult, ProviderType } from "../../runtime/types";
import type { ModelManifest } from "./modelMetadata";
import { createLlamaBridge, type LlamaBridgeHandle } from "./llamaBridge";
import { isModelStored, validateModelIntegrity, deleteModel, getModelFile } from "./modelStorage";
import { patchRuntimeState } from "../../runtime/runtimeState";
import { recordModelLoadDuration } from "../../runtime/performanceMonitor";

// Device-tier-aware load timeout.
// Loading a 2.4GB GGUF model on Android WebView via WASM takes 30–120s depending
// on device tier. These values are intentionally generous so the runtime can
// complete on mid-range hardware. OOM / worker-killed failures surface as
// exceptions from wllama (not as timeouts) on modern Chromium WebViews.
function getLoadTimeoutMs(): number {
  const ram = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  // Note: Android deviceMemory is often capped at 4 even on 8GB devices.
  if (ram >= 8) return 90_000;   // flagship — 90s
  if (ram >= 6) return 120_000;  // high-end — 2min
  if (ram >= 4) return 150_000;  // mid-range — 2.5min
  return 180_000;                // low-end — 3min (likely OOM before this fires)
}

function initLog(phase: string, t0: number, extra?: string): void {
  const elapsed = Date.now() - t0;
  console.log(`[AI INIT +${elapsed}ms] ${phase}${extra ? ` | ${extra}` : ""}`);
}

export class LocalProvider implements AIProvider {
  readonly type: ProviderType = "local";
  readonly modelId: string;

  private readonly manifest: ModelManifest;
  private bridge: LlamaBridgeHandle | null = null;
  private _ready = false;

  constructor(manifest: ModelManifest) {
    this.manifest = manifest;
    this.modelId = manifest.id;
  }

  async initialize(): Promise<void> {
    const t0 = Date.now();
    const log = (phase: string, extra?: string) => initLog(phase, t0, extra);

    log("begin", `modelId=${this.manifest.id}`);
    patchRuntimeState({ status: "initializing", modelLoad: "loading" });

    // ── Phase 0: pre-flight RAM feasibility check ─────────────────────────────
    // Estimate total peak WASM heap the model will require:
    //   model weights in WASM linear memory ≈ file size × 1.1
    //   KV cache at manifest.contextLength tokens (upper bound, conservative)
    //   compute buffers + WASM runtime overhead = 200 MB flat
    //
    // Android WebView renderer process budget ≈ 35% of device RAM.
    // If the estimate exceeds the budget, the WASM memory.grow() calls will trigger
    // Android's Low Memory Killer, killing the renderer process silently (black screen).
    // We reject here with a clear OOM error rather than let the renderer die.
    {
      const deviceRamGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
      const rendererBudgetMB = deviceRamGB * 1024 * 0.35;

      const modelMB = this.manifest.sizeBytes / (1024 * 1024);
      // KV cache per-token cost: conservative 0.3 MB/token for full-attention models,
      // much lower for GQA models — the 0.3 figure errs on the side of safety.
      const kvCacheMB = this.manifest.contextLength * 0.3;
      const estimatedPeakMB = modelMB * 1.1 + kvCacheMB + 200;

      log(
        "preflight RAM check",
        `modelMB=${modelMB.toFixed(0)} kvMB=${kvCacheMB.toFixed(0)} ` +
        `estimatedPeakMB=${estimatedPeakMB.toFixed(0)} rendererBudgetMB=${rendererBudgetMB.toFixed(0)} ` +
        `deviceRamGB=${deviceRamGB}`,
      );

      if (estimatedPeakMB > rendererBudgetMB) {
        const msg =
          `Model "${this.manifest.name}" requires ~${estimatedPeakMB.toFixed(0)} MB peak WASM heap ` +
          `but the Android WebView renderer budget on this ${deviceRamGB} GB device is ` +
          `~${rendererBudgetMB.toFixed(0)} MB. ` +
          `Use a smaller model (≤${(rendererBudgetMB * 0.75).toFixed(0)} MB file size).`;
        log("preflight RAM check FAILED — model is infeasible on this device", msg);
        patchRuntimeState({ status: "error", modelLoad: "failed_oom", lastError: msg });
        throw new Error(msg);
      }

      // Enforce manifest's declared minRamMB hard floor (e.g. 4096 for Qwen2.5-1.5B)
      if (this.manifest.minRamMB && deviceRamGB * 1024 < this.manifest.minRamMB) {
        const msg =
          `Model "${this.manifest.name}" requires ${this.manifest.minRamMB} MB device RAM ` +
          `but this device reports ${(deviceRamGB * 1024).toFixed(0)} MB. ` +
          `Loading would likely crash the WebView renderer.`;
        log("preflight minRamMB check FAILED", msg);
        patchRuntimeState({ status: "error", modelLoad: "failed_oom", lastError: msg });
        throw new Error(msg);
      }

      log("preflight RAM check PASSED");
    }

    // ── Phase 1: confirm model is stored ─────────────────────────────────────
    log("checking storage");
    const stored = await isModelStored(this.manifest.id);
    log("storage check done", `stored=${stored}`);

    if (!stored) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "Model not downloaded — use the Offline Intelligence card to download it",
      });
      throw new Error(`Model "${this.modelId}" not in storage`);
    }

    // ── Phase 2: create WASM bridge ───────────────────────────────────────────
    log("creating bridge");
    const bridge = await createLlamaBridge();
    log("bridge created", `bridge=${bridge ? "ok" : "null"}`);

    if (!bridge) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "llama.cpp runtime not available on this device",
      });
      throw new Error("llama.cpp bridge unavailable");
    }

    // ── Phase 3: GGUF integrity check ─────────────────────────────────────────
    log("validating integrity");
    const integrity = await validateModelIntegrity(this.manifest.id);
    log("integrity done", `valid=${integrity.valid} reason=${integrity.reason ?? "none"}`);

    if (!integrity.valid) {
      // Auto-delete the corrupted file so UI shows "idle" not "stored"
      await deleteModel(this.manifest.id).catch(() => null);
      const msg = `Model file is corrupted (${integrity.reason ?? "invalid header"}) — deleted. Please re-download.`;
      patchRuntimeState({ status: "error", modelLoad: "failed", lastError: msg });
      throw new Error(msg);
    }

    // ── Phase 4: obtain Blob reference ────────────────────────────────────────
    // getModelFile returns an OPFS File handle (lazy — not yet in RAM) or an
    // IDB-assembled Blob. Either way, wllama.loadModel([blob]) reads from it
    // directly without creating an intermediate blob URL or triggering the
    // wllama cache manager (which would re-store 2.4GB to its own OPFS directory).
    log("getting model file");
    const modelBlob = await getModelFile(this.manifest.id);
    log("model file ready", `blobSize=${modelBlob?.size ?? "null"}`);

    if (!modelBlob) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "Could not read model from storage — it may be corrupted",
      });
      throw new Error("Model data unreadable — delete and re-download");
    }

    // ── Phase 5: load model into WASM runtime ─────────────────────────────────
    const timeoutMs = getLoadTimeoutMs();
    log("starting model load", `timeoutMs=${timeoutMs}`);

    const loadStart = Date.now();

    const loadTimeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Model load timed out after ${timeoutMs / 1000}s — device may be low on memory or WASM is unavailable`)),
        timeoutMs,
      ),
    );

    try {
      await Promise.race([
        bridge.loadModel(this.manifest, modelBlob),
        loadTimeout,
      ]);
      log("model load complete", `durationMs=${Date.now() - loadStart}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("model load FAILED", msg);

      const isOOM = /out of memory|allocation failed|oom|enomem/i.test(msg);
      const isTimeout = /timed out/i.test(msg);
      const friendlyMsg = isOOM
        ? "Not enough memory to load offline AI — close other apps and restart"
        : isTimeout
          ? `Offline AI took too long to load (${timeoutMs / 1000}s). Try restarting the app.`
          : `Offline AI failed to load: ${msg}`;

      // Use failed_oom for memory failures so the degraded path can detect them
      // and avoid pointless retries that will also OOM.
      patchRuntimeState({
        status: "error",
        modelLoad: isOOM ? "failed_oom" : "failed",
        lastError: friendlyMsg,
      });
      throw new Error(friendlyMsg);
    }

    const loadDurationMs = Date.now() - loadStart;
    recordModelLoadDuration(loadDurationMs);

    this.bridge = bridge;
    this._ready = true;

    log("provider ready", `totalMs=${Date.now() - t0}`);
    patchRuntimeState({
      status: "ready",
      provider: "local",
      modelId: this.modelId,
      modelLoad: "ready",
      offlineCapable: true,
      lastError: null,
    });
  }

  async generate(request: InferenceRequest): Promise<InferenceResult> {
    if (!this.bridge || !this._ready) {
      throw new Error("LocalProvider.generate called before initialize()");
    }
    return this.bridge.generate(request);
  }

  async summarize(text: string, maxTokens = 200): Promise<string> {
    const controller = new AbortController();
    const result = await this.generate({
      id: crypto.randomUUID(),
      prompt: `Summarise the following wellness note in ${maxTokens} words or fewer:\n\n${text}`,
      maxTokens,
      temperature: 0.3,
      priority: "low",
      controller,
    });
    return result.text;
  }

  async embed(_text: string): Promise<number[]> {
    // Phi-3 is a generation model — embedding uses the separate xenova pipeline.
    return new Array(384).fill(0);
  }

  cancel(_requestId: string): void {
    // Cancellation is via InferenceRequest.controller.signal — handled in bridge.
  }

  async dispose(): Promise<void> {
    if (this.bridge) {
      await this.bridge.unloadModel();
      this.bridge = null;
    }
    this._ready = false;
    patchRuntimeState({
      status: "disposed",
      modelLoad: "not_loaded",
      offlineCapable: false,
    });
  }

  isReady(): boolean {
    return this._ready;
  }
}
