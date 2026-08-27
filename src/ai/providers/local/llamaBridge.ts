// llama.cpp integration bridge.
//
// This is the architectural seam between WellMate and native inference.
// Two future integration paths are planned — only THIS file changes when
// either path is activated. No provider or orchestrator logic moves.

import type { InferenceRequest, InferenceResult } from "../../runtime/types";
import type { ModelManifest } from "./modelMetadata";

export type BridgeEnvironment = "wasm" | "native" | "none";

export type BridgeStatus =
  | { env: "none"; reason: string }
  | { env: "wasm"; version: string; ready: boolean }
  | { env: "native"; pluginVersion: string; ready: boolean };

export type LlamaBridgeHandle = {
  generate(request: InferenceRequest): Promise<InferenceResult>;
  loadModel(manifest: ModelManifest, blob: Blob): Promise<void>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
};

function getCapacitor(): { Plugins?: Record<string, unknown> } | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
}

export function detectBridgeEnvironment(): BridgeEnvironment {
  const capacitor = getCapacitor();
  if (capacitor?.Plugins && "LlamaCpp" in capacitor.Plugins) return "native";
  if (typeof WebAssembly !== "undefined") return "wasm";
  return "none";
}

export function getBridgeStatus(): BridgeStatus {
  const env = detectBridgeEnvironment();
  if (env === "wasm") return { env: "wasm", version: "wllama", ready: true };
  if (env === "native") return { env: "native", pluginVersion: "unknown", ready: true };
  return { env: "none", reason: "WebAssembly not supported in this environment" };
}

export async function createLlamaBridge(): Promise<LlamaBridgeHandle | null> {
  const env = detectBridgeEnvironment();
  if (env === "wasm") {
    const { createWasmBridge } = await import("./bridges/wasmBridge");
    return createWasmBridge();
  }
  return null;
}
