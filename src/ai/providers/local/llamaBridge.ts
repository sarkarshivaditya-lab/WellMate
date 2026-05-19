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
  // Native Capacitor plugin — highest priority when registered
  if (
    typeof window !== "undefined" &&
    // @ts-expect-error — Capacitor is injected at runtime, not typed here
    window.Capacitor?.Plugins?.LlamaCpp
  ) {
    return "native";
  }

  // WASM via wllama — works in modern browser WebViews and desktop browsers
  if (typeof WebAssembly !== "undefined") {
    return "wasm";
  }

  return "none";
}

export function getBridgeStatus(): BridgeStatus {
  const env = detectBridgeEnvironment();
  if (env === "wasm") {
    return { env: "wasm", version: "wllama", ready: true };
  }
  if (env === "native") {
    return { env: "native", pluginVersion: "unknown", ready: true };
  }
  return { env: "none", reason: "WebAssembly not supported in this environment" };
}

// ── Bridge factory ────────────────────────────────────────────────────────────

export async function createLlamaBridge(): Promise<LlamaBridgeHandle | null> {
  const env = detectBridgeEnvironment();

  if (env === "wasm") {
    const { createWasmBridge } = await import("./bridges/wasmBridge");
    return createWasmBridge();
  }

  if (env === "native") {
    // Native Capacitor plugin path — activate when plugin is registered
    // const { createNativeBridge } = await import("./bridges/nativeBridge");
    // return createNativeBridge();
  }

  return null;
}
