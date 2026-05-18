// src/ai/wellMateEvents.ts
// Lightweight event bus for opening the WellMate chat from anywhere in the UI.
// Follows the same subscriber pattern as reliability infrastructure.
// No React dependency — safe to import from non-component code.

export type WellMateOpenEvent = {
  prompt?: string;            // pre-populate the input field
  grounding?: string;         // context hint shown as a chip (not sent)
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
      /* never crash the caller */
    }
  });
}
