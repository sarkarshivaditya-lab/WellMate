// Real llama.cpp WASM bridge via @wllama/wllama v3.
// Phi-3 Mini (GGUF format) runs here, on-device, fully offline.
//
// Architecture:
//   - Single WASM binary — maximum compatibility (iOS WKWebView, Android WebView)
//   - Streaming via onData callback + AbortSignal for clean cancellation
//   - Model loaded from IndexedDB blob URL (no network required after download)
//   - AbortSignal wired through the full stack: hook → queue → bridge → wllama

import type { LlamaBridgeHandle } from "../llamaBridge";
import type { InferenceRequest, InferenceResult } from "../../../runtime/types";
import type { ModelManifest } from "../modelMetadata";

// Vite resolves this ?url import to a public asset URL at build time
// The WASM file is served as a static asset and cached by the browser
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

export async function createWasmBridge(): Promise<LlamaBridgeHandle> {
  const { Wllama } = await import("@wllama/wllama");

  const wllama = new Wllama(
    {
      default: "", // overridden by explicit WASM path below
      "single-thread/wllama.wasm": wasmUrl,
    },
    {
      suppressNativeLog: !import.meta.env.DEV,
    },
  );

  let _modelLoaded = false;

  return {
    async loadModel(manifest: ModelManifest, modelData: ArrayBuffer): Promise<void> {
      const blob = new Blob([modelData], { type: "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);

      try {
        await wllama.loadModelFromUrl(blobUrl, {
          n_ctx: manifest.contextLength,
          n_batch: 32,      // conservative for mobile — avoids OOM
          n_threads: 1,     // single-thread WASM for maximum compatibility
          cache_type_k: "q4_0", // quantized KV cache reduces memory pressure
        });
        _modelLoaded = true;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    },

    async generate(request: InferenceRequest): Promise<InferenceResult> {
      if (!_modelLoaded) throw new Error("Model not loaded");

      const start = Date.now();

      // Phi-3 instruct format — adapted for wellness context
      const prompt = request.systemContext
        ? `<|system|>\n${request.systemContext}<|end|>\n<|user|>\n${request.prompt}<|end|>\n<|assistant|>\n`
        : `<|user|>\n${request.prompt}<|end|>\n<|assistant|>\n`;

      let fullText = "";
      let tokenCount = 0;

      // Streaming generation with AbortSignal for clean mid-generation cancellation
      await wllama.createCompletion({
        prompt,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stop: ["<|end|>", "<|endoftext|>", "<|im_end|>", "<|user|>"],
        stream: true,
        onData: (chunk) => {
          const piece = chunk.choices[0]?.text ?? "";
          fullText += piece;
          tokenCount++;
        },
        abortSignal: request.controller.signal,
      });

      return {
        requestId: request.id,
        text: fullText.trim(),
        tokensGenerated: tokenCount,
        durationMs: Date.now() - start,
        provider: "local",
        modelId: "phi3-mini-wasm",
        cached: false,
      };
    },

    async unloadModel(): Promise<void> {
      if (_modelLoaded) {
        await wllama.exit();
        _modelLoaded = false;
      }
    },

    isModelLoaded(): boolean {
      return _modelLoaded;
    },
  };
}
