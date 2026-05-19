// Local AI provider — runs inference via llama.cpp (WASM or native Capacitor).
// Falls back gracefully when the llama.cpp bridge is not yet available.
// The orchestrator catches the init error and keeps the stub provider active.

import type { AIProvider } from "../types";
import type { InferenceRequest, InferenceResult, ProviderType } from "../../runtime/types";
import type { ModelManifest } from "./modelMetadata";
import { createLlamaBridge, type LlamaBridgeHandle } from "./llamaBridge";
import { isModelStored, getStoredModelData } from "./modelLoader";
import { patchRuntimeState } from "../../runtime/runtimeState";

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

    const stored = await isModelStored(this.manifest);
    if (!stored) {
      patchRuntimeState({ status: "error", modelLoad: "failed", lastError: "Model not downloaded" });
      throw new Error(`Model "${this.modelId}" not in storage. Download it first.`);
    }

    const bridge = await createLlamaBridge();
    if (!bridge) {
      patchRuntimeState({
        status: "error",
        modelLoad: "failed",
        lastError: "llama.cpp runtime not available in this environment",
      });
      throw new Error("llama.cpp bridge unavailable");
    }

    const data = await getStoredModelData(this.manifest);
    if (!data) {
      patchRuntimeState({ status: "error", modelLoad: "failed", lastError: "Model data unreadable" });
      throw new Error("Model data could not be read from IndexedDB");
    }

    await bridge.loadModel(this.manifest, data);
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

  async summarize(text: string, maxTokens = 256): Promise<string> {
    const controller = new AbortController();
    const result = await this.generate({
      id: crypto.randomUUID(),
      prompt: `Summarise concisely in ${maxTokens} tokens or fewer:\n\n${text}`,
      maxTokens,
      temperature: 0.3,
      priority: "low",
      controller,
    });
    return result.text;
  }

  async embed(_text: string): Promise<number[]> {
    // Embedding requires a dedicated embedding model or layer.
    // Return zero vector until that capability is explicitly added.
    return new Array(384).fill(0);
  }

  cancel(_requestId: string): void {
    // Cancellation flows through the InferenceRequest's AbortController.
    // The bridge receives the signal on its next token-generation tick.
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
