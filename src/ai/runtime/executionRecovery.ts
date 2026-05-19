// Execution recovery — hardens the inference runtime against common failure modes.
//
// Failure modes handled:
//   1. Stuck streaming  — onToken not called for > 30s during active generation
//   2. Hung inference   — total inference time exceeds 120s (no completion/abort)
//   3. Transient errors — retried once with exponential backoff before surfacing
//   4. Stale markers    — download-active localStorage markers > 24h old
//
// Design: all primitives are thin wrappers; they don't replace existing error
// handling but add a safety net layer underneath it.

import { recordRecoveryEvent, recordFailureEvent } from "./performanceHistory";

// ── Stuck-stream detection ─────────────────────────────────────────────────────

const STUCK_STREAM_TIMEOUT_MS = 30_000;   // 30s with no new token
const HUNG_INFERENCE_TIMEOUT_MS = 120_000; // 2 min absolute ceiling

export type StuckStreamHandle = {
  wrappedOnToken: ((token: string) => void) | undefined;
  cancel: () => void; // call on normal completion to clear watchdog
};

export function withStuckStreamDetection(
  onToken: ((token: string) => void) | undefined,
  controller: AbortController,
  opts?: { timeoutMs?: number },
): StuckStreamHandle {
  const timeout = opts?.timeoutMs ?? STUCK_STREAM_TIMEOUT_MS;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let triggered = false;

  function resetWatchdog() {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (!controller.signal.aborted && !triggered) {
        triggered = true;
        controller.abort();
        recordRecoveryEvent({
          occurredAt: Date.now(),
          type: "stuck_stream",
          details: `No token received in ${timeout}ms — aborted`,
        });
      }
    }, timeout);
  }

  function cancel() {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  }

  if (!onToken) {
    return { wrappedOnToken: undefined, cancel };
  }

  const wrappedOnToken = (token: string) => {
    resetWatchdog();
    onToken(token);
  };

  return { wrappedOnToken, cancel };
}

// ── Hung-inference timeout ─────────────────────────────────────────────────────

// Wraps a promise with an absolute timeout. If the promise doesn't resolve
// in time, aborts the controller and rejects with a clear error.
export function withInferenceTimeout<T>(
  promise: Promise<T>,
  controller: AbortController,
  timeoutMs = HUNG_INFERENCE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeoutRace = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
        recordRecoveryEvent({
          occurredAt: Date.now(),
          type: "hung_inference",
          details: `Inference exceeded ${timeoutMs}ms limit — aborted`,
        });
      }
      reject(new Error(`Inference timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutRace]).finally(() => clearTimeout(timer));
}

// ── Retry with exponential backoff ─────────────────────────────────────────────

const RETRYABLE_PATTERNS = /network|fetch|timeout|temporarily/i;
const NON_RETRYABLE_PATTERNS = /aborted|cancelled|thermal emergency|oom|out of memory/i;

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (NON_RETRYABLE_PATTERNS.test(err.message)) return false;
  // Retry on transient or network-ish errors (or unknown errors)
  return RETRYABLE_PATTERNS.test(err.message) || true; // default retry once
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    context?: string;
  },
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const initialDelay = opts?.initialDelayMs ?? 1_000;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt === maxAttempts - 1;
      if (isLast || !isRetryable(err)) break;

      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ── Stale download marker cleanup ──────────────────────────────────────────────

const DOWNLOAD_ACTIVE_PREFIX = "ai_download_active_";
const STALE_MARKER_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export function cleanupStaleDownloadMarkers(): void {
  const staleKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DOWNLOAD_ACTIVE_PREFIX)) continue;

    const ts = parseInt(localStorage.getItem(key) ?? "0", 10);
    if (Date.now() - ts > STALE_MARKER_AGE_MS) {
      staleKeys.push(key);
    }
  }

  staleKeys.forEach((k) => localStorage.removeItem(k));

  if (staleKeys.length > 0) {
    recordRecoveryEvent({
      occurredAt: Date.now(),
      type: "manual_reset",
      details: `Cleared ${staleKeys.length} stale download markers`,
    });
  }
}

// ── Failure recording (convenience wrapper) ────────────────────────────────────

export function recordInferenceFailure(
  err: unknown,
  provider: string,
  wasRetried: boolean,
  recoveredSuccessfully: boolean,
): void {
  recordFailureEvent({
    occurredAt: Date.now(),
    reason: err instanceof Error ? err.message : String(err),
    provider,
    wasRetried,
    recoveredSuccessfully,
  });
}
