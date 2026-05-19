// Observable AI runtime state store.
// Same pub/sub pattern as profileEditor and wellMateEvents — no React dependency.

import type { AIRuntimeState } from "./types";

const INITIAL: AIRuntimeState = {
  status: "idle",
  provider: "stub",
  modelId: null,
  modelLoad: "not_loaded",
  queueDepth: 0,
  lastError: null,
  thermal: "nominal",
  offlineCapable: false,
  totalInferences: 0,
};

let _state: AIRuntimeState = { ...INITIAL };
const _subs = new Set<(s: AIRuntimeState) => void>();

export function getRuntimeState(): AIRuntimeState {
  return _state;
}

export function patchRuntimeState(patch: Partial<AIRuntimeState>): void {
  _state = { ..._state, ...patch };
  _subs.forEach((fn) => {
    try {
      fn(_state);
    } catch {
      /* never crash a subscriber */
    }
  });
}

export function subscribeToRuntimeState(
  fn: (s: AIRuntimeState) => void,
): () => void {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function resetRuntimeState(): void {
  _state = { ...INITIAL };
  _subs.forEach((fn) => {
    try {
      fn(_state);
    } catch {
      /* never crash */
    }
  });
}
