// Local AI provider — runs inference via llama.cpp (WASM or native Capacitor).
// Falls back gracefully when the bridge or model is unavailable.
//
// Memory safety:
//   - Blob URL is created immediately before load and revoked after wllama
//     has opened its internal copy — avoids holding 2× model size in RAM.
//   - 90-second load timeout prevents hanging on slow/incompatible devices.

import type { AIProvider } from "../types";
import type { InferenceRequest, InferenceResult, ProviderType } from "../../runtime/types";
import type { ModelManifest } from "./modelMetadata";
import { createLlamaBridge, type LlamaBridgeHandle } from "./llamaBridge";
import { isModelStored, getModelBlobUrl, validateModelIntegrity, deleteModel } from "./modelStorage";
import { patchRuntimeState } from "../../runtime/runtimeState";
import { recordModelLoadDuration } from "../../runtime/performanceMonitor";

const LOAD_TIMEOUT_MS = 90_000; // 90 seconds — generous for low-end devices

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
    patchRuntimeState({ status: "initializing", modelLoad: "loading" });

    const stored = await isModelStored(this.manifest.id);
    if (!stored) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "Model not downloaded — use the Offline Intelligence card to download it",
      });
      throw new Error(`Model "${this.modelId}" not in storage`);
    }

    const bridge = await createLlamaBridge();
    if (!bridge) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "llama.cpp runtime not available on this device",
      });
      throw new Error("llama.cpp bridge unavailable");
    }

    // Validate GGUF magic bytes before handing to WASM — avoids cryptic crashes
    const integrity = await validateModelIntegrity(this.manifest.id);
    if (!integrity.valid) {
      // Auto-delete the corrupted file so UI shows "idle" not "stored"
      await deleteModel(this.manifest.id).catch(() => null);
      const msg = `Model file is corrupted (${integrity.reason ?? "invalid header"}) — deleted. Please re-download.`;
      patchRuntimeState({ status: "error", modelLoad: "failed", lastError: msg });
      throw new Error(msg);
    }

    // Create blob URL from storage (OPFS = memory-efficient, IDB = loads into RAM)
    const blobUrl = await getModelBlobUrl(this.manifest.id);
    if (!blobUrl) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "Could not read model from storage — it may be corrupted",
      });
      throw new Error("Model data unreadable — delete and re-download");
    }

    const loadStart = Date.now();

    const loadTimeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Model load timeout (90s) — device may be low on memory")),
        LOAD_TIMEOUT_MS,
      ),
    );

    try {
      await Promise.race([
        bridge.loadFromBlobUrl(this.manifest, blobUrl),
        loadTimeout,
      ]);
    } catch (err) {
      // Classify low-memory errors vs other failures for better UX messages
      const msg = err instanceof Error ? err.message : String(err);
      const isOOM = /out of memory|allocation failed|oom|enomem/i.test(msg);
      const isTimeout = /timeout/i.test(msg);
      const friendlyMsg = isOOM
        ? "Not enough RAM to load model — close other apps and try again"
        : isTimeout
          ? "Model load timed out — device may be overloaded. Try again when cooler."
          : `Model load failed: ${msg}`;
      patchRuntimeState({ status: "error", modelLoad: "failed", lastError: friendlyMsg });
      throw new Error(friendlyMsg);
    } finally {
      // Always revoke — wllama has its own internal copy after loadModelFromUrl
      URL.revokeObjectURL(blobUrl);
    }

    const loadDurationMs = Date.now() - loadStart;
    recordModelLoadDuration(loadDurationMs);

    this.bridge = bridge;
    this._ready = true;

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
