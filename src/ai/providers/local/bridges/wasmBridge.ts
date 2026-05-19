// Real llama.cpp WASM bridge via @wllama/wllama v3.
// Phi-3 Mini (GGUF) runs here, on-device, fully offline.
//
// Architecture:
//   - Single WASM binary — maximum compatibility (iOS WKWebView, Android WebView)
//   - Model loaded from a blob URL — the caller creates and revokes it.
//   - Streaming via onData callback + AbortSignal for clean cancellation.
//   - Conservative mobile settings: n_ctx=2048, n_batch=16, n_threads=1
//
// Mobile inference speed expectations (Q4_0, single-thread WASM):
//   High-end (A17 Pro, SD8 Gen 3): 15–25 tok/s
//   Mid-range (SD7 Gen, A15):      8–15 tok/s
//   Budget (SD4xx, older iPads):   4–8 tok/s
//   At 8 tok/s × 256 max tokens = ~32s — acceptable for wellness reflection.

import type { LlamaBridgeHandle } from "../llamaBridge";
import type { InferenceRequest, InferenceResult } from "../../../runtime/types";
import type { ModelManifest } from "../modelMetadata";
import { recordInferenceComplete } from "../../../runtime/performanceMonitor";

// Vite resolves this ?url import to a public asset URL at build time
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Generation timeout — protects against infinite WASM hangs
const GENERATION_TIMEOUT_MS = 120_000; // 2 minutes

export async function createWasmBridge(): Promise<LlamaBridgeHandle> {
  const { Wllama } = await import("@wllama/wllama");

  const wllama = new Wllama(
    {
      default: "",
      "single-thread/wllama.wasm": wasmUrl,
    },
    {
      suppressNativeLog: !import.meta.env.DEV,
    },
  );

  let _modelLoaded = false;

  return {
    async loadFromBlobUrl(
      manifest: ModelManifest,
      blobUrl: string,
    ): Promise<void> {
      await wllama.loadModelFromUrl(blobUrl, {
        // 2K context: halves KV cache vs 4096 — critical for mobile RAM budget.
        // A 2K context still fits the full wellness prompt + user question + response.
        n_ctx: Math.min(manifest.contextLength, 2048),
        n_batch: 16,       // small batches — lower peak RAM, more stable on weak devices
        n_threads: 1,      // single-thread for maximum cross-device compatibility
        cache_type_k: "q4_0", // quantized KV cache — significant RAM reduction
      });
      _modelLoaded = true;
    },

    async generate(request: InferenceRequest): Promise<InferenceResult> {
      if (!_modelLoaded) throw new Error("WASM bridge: model not loaded");

      const start = Date.now();

      // Phi-3 instruct format — adapted for wellness context
      const prompt = request.systemContext
        ? `<|system|>\n${request.systemContext}<|end|>\n<|user|>\n${request.prompt}<|end|>\n<|assistant|>\n`
        : `<|user|>\n${request.prompt}<|end|>\n<|assistant|>\n`;

      let fullText = "";
      let tokenCount = 0;

      // Conservative token ceiling — prevents runaway generation on weak devices.
      // 256 tokens ≈ 3-4 sentences at typical generation speed — right for wellness reflections.
      const maxTokens = Math.min(request.maxTokens, 256);

      const generatePromise = wllama.createCompletion({
        prompt,
        max_tokens: maxTokens,
        temperature: Math.min(request.temperature, 0.9), // clamp: prevent incoherent outputs
        top_p: 0.9,          // nucleus sampling — natural, non-repetitive text
        repeat_penalty: 1.1, // discourage looping phrases common in small models
        stop: ["<|end|>", "<|endoftext|>", "<|im_end|>", "<|user|>"],
        stream: true,
        onData: (chunk) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const piece = (chunk as any).choices?.[0]?.text ?? "";
          fullText += piece;
          tokenCount++;
          if (piece) request.onToken?.(piece);
        },
        abortSignal: request.controller.signal,
      });

      // Generation timeout — if wllama hangs, we abort cleanly
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Generation timeout")),
          GENERATION_TIMEOUT_MS,
        ),
      );

      try {
        await Promise.race([generatePromise, timeoutPromise]);
      } catch (err) {
        if (request.controller.signal.aborted) {
          // Clean abort — return what we have so far
          const result: InferenceResult = {
            requestId: request.id,
            text: fullText.trim(),
            tokensGenerated: tokenCount,
            durationMs: Date.now() - start,
            provider: "local",
            modelId: "phi3-mini-wasm",
            cached: false,
          };
          return result;
        }
        throw err;
      }

      const durationMs = Date.now() - start;
      recordInferenceComplete(tokenCount, durationMs);

      return {
        requestId: request.id,
        text: fullText.trim(),
        tokensGenerated: tokenCount,
        durationMs,
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
