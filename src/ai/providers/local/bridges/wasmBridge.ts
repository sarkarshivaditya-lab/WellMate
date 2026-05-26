// Real llama.cpp WASM bridge via @wllama/wllama v3.
// Qwen2.5-1.5B-Instruct Q4_K_M runs here, on-device, fully offline.
//
// Architecture:
//   - Single WASM binary — maximum compatibility (iOS WKWebView, Android WebView)
//   - Model loaded from a Blob — bypasses wllama's internal download/cache layer.
//     (loadModelFromUrl with a blob URL triggers wllama's cache manager, which
//      re-downloads and re-stores the model file, doubling I/O and causing hangs.)
//   - Streaming via onData callback + AbortSignal for clean cancellation.
//   - Conservative mobile settings: n_ctx=1024, n_batch=16, n_threads=1
//
// Why n_ctx=1024 (not 2048):
//   Qwen2.5-1.5B has GQA (2 KV heads vs 12 Q heads).
//   KV cache at n_ctx=1024: ~9 MB (vs ~502 MB for Phi-3 Mini at n_ctx=2048 with full attention).
//   1K context fits full wellness prompt + user message + 256-token response with room to spare.
//
// Mobile inference speed expectations (Q4_K_M, single-thread WASM):
//   High-end (A17 Pro, SD8 Gen 3): 12–20 tok/s
//   Mid-range (SD7 Gen, A15):      6–12 tok/s
//   Budget (SD4xx, older iPads):   3–7 tok/s
//   At 6 tok/s × 256 max tokens = ~43s — acceptable for wellness reflection.

import type { LlamaBridgeHandle } from "../llamaBridge";
import type { InferenceRequest, InferenceResult } from "../../../runtime/types";
import type { ModelManifest } from "../modelMetadata";
import { recordInferenceComplete } from "../../../runtime/performanceMonitor";

// Vite resolves this ?url import to a public asset URL at build time
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Generation timeout — protects against infinite WASM hangs during inference
const GENERATION_TIMEOUT_MS = 120_000; // 2 minutes

// Heartbeat interval for model loading — logs progress so Android logs show activity
const HEARTBEAT_INTERVAL_MS = 5_000;

function aiLog(phase: string, t0: number, extra?: string): void {
  const elapsed = Date.now() - t0;
  const msg = `[AI WASM +${elapsed}ms] ${phase}${extra ? ` | ${extra}` : ""}`;
  console.log(msg);
}

export async function createWasmBridge(): Promise<LlamaBridgeHandle> {
  const t0 = Date.now();
  aiLog("createWasmBridge begin", t0);

  const { Wllama } = await import("@wllama/wllama");
  aiLog("wllama module imported", t0);

  // AssetsPathConfig: `default` must be a non-empty truthy string — wllama v3
  // checks `!pathConfig["default"]` (truthiness, not existence) and uses it as
  // the WASM URL directly via absoluteUrl(). The Vite ?url import resolves to
  // an absolute asset path at build time, satisfying both requirements.
  // "single-thread/wllama.wasm" is not used by the v3.1.1 loadModel runtime;
  // only `default` is read when building the internal mPathConfig.
  const wllama = new Wllama(
    {
      default: wasmUrl,
    },
    {
      suppressNativeLog: !import.meta.env.DEV,
    },
  );
  aiLog("Wllama instance created", t0, `wasmUrl=${wasmUrl.substring(0, 60)}`);

  let _modelLoaded = false;

  return {
    async loadModel(
      manifest: ModelManifest,
      blob: Blob,
    ): Promise<void> {
      const lt0 = Date.now();
      const log = (phase: string, extra?: string) => aiLog(phase, lt0, extra);

      const modelMB = (blob.size / (1024 * 1024)).toFixed(0);
      const nCtxActual = Math.min(manifest.contextLength, 1024);
      log(
        "loadModel begin",
        `blobSize=${blob.size} (${modelMB} MB) sizeExpected=${manifest.sizeBytes} n_ctx=${nCtxActual}`,
      );

      // Heartbeat: Android logcat must show activity every few seconds so the OS
      // doesn't consider the WebView frozen. Cleared after load completes/fails.
      const heartbeat = setInterval(() => {
        log("heartbeat — wllama.loadModel still in progress", `elapsed=${Date.now() - lt0}ms`);
      }, HEARTBEAT_INTERVAL_MS);

      try {
        // CRASH PHASE INSTRUMENTATION
        // If the app crashes on Android between these two log lines, the WebView renderer
        // was killed by Android's LMK during WASM memory.grow() — the model is too large
        // for this device's renderer process budget. The pre-flight check in LocalProvider
        // should have caught this, but device memory reporting is not always reliable.
        log("WASM alloc phase START — if crash follows, model exceeds renderer RAM budget");

        // Pass Blob directly to wllama — no URL fetch, no internal cache write.
        await wllama.loadModel([blob], {
          // 1K context: safe for all target devices (Qwen2.5-1.5B GQA = tiny KV cache).
          // Wellness prompt + question + 256-token response fits in 1K with room to spare.
          n_ctx: nCtxActual,
          n_batch: 16,          // small batches — lower peak RAM, more stable on weak devices
          n_threads: 1,         // single-thread for maximum cross-device compatibility
          cache_type_k: "q4_0", // quantized K cache — reduces KV RAM
          cache_type_v: "q4_0", // quantized V cache — further reduces KV RAM
        });

        log("WASM alloc phase COMPLETE — weights loaded, KV cache allocated");

        log("wllama.loadModel complete");
        _modelLoaded = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("wllama.loadModel FAILED", msg);
        throw err;
      } finally {
        clearInterval(heartbeat);
        log("loadModel finally block");
      }
    },

    async generate(request: InferenceRequest): Promise<InferenceResult> {
      if (!_modelLoaded) throw new Error("WASM bridge: model not loaded");

      const start = Date.now();

      // Qwen2.5 / ChatML instruct format — used by Qwen2.5-1.5B-Instruct
      const prompt = request.systemContext
        ? `<|im_start|>system\n${request.systemContext}<|im_end|>\n<|im_start|>user\n${request.prompt}<|im_end|>\n<|im_start|>assistant\n`
        : `<|im_start|>user\n${request.prompt}<|im_end|>\n<|im_start|>assistant\n`;

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
        penalty_repeat: 1.1, // discourage looping phrases common in small models
        stop: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
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
            modelId: "qwen2.5-1.5b-wasm",
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
        modelId: "qwen2.5-1.5b-wasm",
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
