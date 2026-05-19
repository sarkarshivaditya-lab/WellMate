// llama.cpp integration bridge.
//
// This is the architectural seam between WellMate and native inference.
// Two future integration paths are planned — only THIS file changes when
// either path is activated. No provider or orchestrator logic moves.
//
// Path 1 — WebAssembly
//   llama.cpp compiled to WASM, loaded in a Web Worker.
//   Compatible with browsers and Capacitor WebView.
//   Activation: uncomment wasmBridge branch below; install llama-wasm package.
//
// Path 2 — Capacitor Native Plugin
//   llama.cpp running natively on iOS/Android via a Capacitor plugin.
//   Lower latency, access to CoreML/NNAPI acceleration.
//   Activation: uncomment nativeBridge branch below; register Capacitor plugin.
//
// Current status: neither path is active. getBridgeStatus() returns env:"none"
// so LocalProvider can gracefully fall back to the stub provider.

import type { InferenceRequest, InferenceResult } from "../../runtime/types";
import type { ModelManifest } from "./modelMetadata";

export type BridgeEnvironment = "wasm" | "native" | "none";

export type BridgeStatus =
  | { env: "none"; reason: string }
  | { env: "wasm"; version: string; ready: boolean }
  | { env: "native"; pluginVersion: string; ready: boolean };

export type LlamaBridgeHandle = {
  generate(request: InferenceRequest): Promise<InferenceResult>;
  loadModel(manifest: ModelManifest, modelData: ArrayBuffer): Promise<void>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
};

// ── Environment detection ─────────────────────────────────────────────────────

export function detectBridgeEnvironment(): BridgeEnvironment {
  // TODO: check for registered Capacitor plugin (window.Capacitor?.Plugins?.LlamaCpp)
  // TODO: check for llama-wasm module availability (dynamic import probe)
  return "none";
}

export function getBridgeStatus(): BridgeStatus {
  const env = detectBridgeEnvironment();
  if (env === "none") {
    return {
      env: "none",
      reason:
        "No llama.cpp runtime detected. Register the WASM bundle or Capacitor plugin.",
    };
  }
  return { env: "none", reason: "Bridge environment detected but not yet configured" };
}

// ── Bridge factory ────────────────────────────────────────────────────────────

export async function createLlamaBridge(): Promise<LlamaBridgeHandle | null> {
  const env = detectBridgeEnvironment();

  if (env === "none") return null;

  // WASM path — activate when llama.cpp WASM bundle is available:
  // if (env === "wasm") {
  //   const { createWasmBridge } = await import("./bridges/wasmBridge");
  //   return createWasmBridge();
  // }

  // Native path — activate when Capacitor plugin is registered:
  // if (env === "native") {
  //   const { createNativeBridge } = await import("./bridges/nativeBridge");
  //   return createNativeBridge();
  // }

  return null;
}
