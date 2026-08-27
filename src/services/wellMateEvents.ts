// Lightweight event bus for opening the WellMate chat from anywhere in the UI.
// No React dependency and no AI runtime dependency.
export type WellMateOpenEvent = {
  prompt?: string;
  grounding?: string;
};

type Listener = (event: WellMateOpenEvent) => void;
const listeners = new Set<Listener>();

export function subscribeToWellMateOpen(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openWellMate(opts: WellMateOpenEvent = {}): void {
  listeners.forEach((fn) => {
    try {
      fn(opts);
    } catch {
      // UI event listeners must never crash the caller.
    }
  });
}
