// Threading capability — detects SharedArrayBuffer + COOP/COEP and classifies
// the runtime into one of three execution modes.
//
// Modes:
//   single_thread        — default; no SAB; inference runs on main thread
//   multi_thread_eligible — SAB + crossOriginIsolated; ready for threaded WASM
//   degraded             — non-secure context or browser restriction detected
//
// This module is the gate for thread-aware runtime decisions. Nothing else
// should read `crossOriginIsolated` or test `SharedArrayBuffer` directly.

const CACHE_KEY = "ai_threading_cap_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — capability doesn't change mid-session

export type ThreadingMode = "single_thread" | "multi_thread_eligible" | "degraded";

export type BrowserCompatibility =
  | "full"       // Chrome/Edge 92+, Firefox 79+ with COOP/COEP
  | "partial"    // Safari — SAB restored but COOP/COEP limited
  | "restricted" // Older browser or privacy-mode restriction
  | "unknown";

export type ThreadingCapability = {
  mode: ThreadingMode;
  sharedArrayBufferAvailable: boolean;
  crossOriginIsolated: boolean;
  secureContext: boolean;
  hardwareConcurrency: number;
  recommendedThreadCount: number;
  browserCompatibility: BrowserCompatibility;
  degradationReason: string | null;
  assessedAt: number;
};

// ── Detection helpers ──────────────────────────────────────────────────────────

function detectSharedArrayBuffer(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined" && !!new SharedArrayBuffer(1);
  } catch {
    return false;
  }
}

function detectCrossOriginIsolated(): boolean {
  // `crossOriginIsolated` is only true when both COOP and COEP are set correctly
  return typeof self !== "undefined" && (self as typeof globalThis & { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

function detectSecureContext(): boolean {
  return typeof isSecureContext !== "undefined" ? isSecureContext : location?.protocol === "https:" || location?.hostname === "localhost";
}

function classifyBrowser(): BrowserCompatibility {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  // Chrome / Edge
  if (/Chrome\/(\d+)/.test(ua)) {
    const ver = parseInt(RegExp.$1, 10);
    return ver >= 92 ? "full" : "restricted";
  }
  // Firefox
  if (/Firefox\/(\d+)/.test(ua)) {
    const ver = parseInt(RegExp.$1, 10);
    return ver >= 79 ? "full" : "restricted";
  }
  // Safari — SAB available since 15.2 but COOP/COEP handling varies
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    return "partial";
  }
  return "unknown";
}

function recommendedThreads(concurrency: number, mode: ThreadingMode): number {
  if (mode !== "multi_thread_eligible") return 1;
  // Leave 1 core for the main thread; cap at 4 for mobile thermal safety
  return Math.min(Math.max(1, concurrency - 1), 4);
}

// ── Core assessment ────────────────────────────────────────────────────────────

export function assessThreadingCapability(): ThreadingCapability {
  const sabAvailable = detectSharedArrayBuffer();
  const crossOriginIsolated = detectCrossOriginIsolated();
  const secureContext = detectSecureContext();
  const hardwareConcurrency = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 2) : 2;
  const browserCompatibility = classifyBrowser();

  let mode: ThreadingMode;
  let degradationReason: string | null = null;

  if (!secureContext) {
    mode = "degraded";
    degradationReason = "Non-secure context — SharedArrayBuffer unavailable";
  } else if (!sabAvailable) {
    if (!crossOriginIsolated) {
      mode = "single_thread";
      degradationReason = "COOP/COEP headers not set — SharedArrayBuffer blocked by browser policy";
    } else {
      mode = "single_thread";
      degradationReason = "SharedArrayBuffer constructor unavailable";
    }
  } else if (!crossOriginIsolated) {
    mode = "single_thread";
    degradationReason = "crossOriginIsolated=false — WASM threading disabled by browser policy";
  } else if (browserCompatibility === "restricted") {
    mode = "degraded";
    degradationReason = "Browser version predates reliable SAB support";
  } else {
    mode = "multi_thread_eligible";
  }

  return {
    mode,
    sharedArrayBufferAvailable: sabAvailable,
    crossOriginIsolated,
    secureContext,
    hardwareConcurrency,
    recommendedThreadCount: recommendedThreads(hardwareConcurrency, mode),
    browserCompatibility,
    degradationReason,
    assessedAt: Date.now(),
  };
}

// Cached accessor — avoids repeated DOM queries during inference
let _cached: ThreadingCapability | null = null;

export function getThreadingCapability(): ThreadingCapability {
  if (_cached && Date.now() - _cached.assessedAt < CACHE_TTL_MS) return _cached;

  // Try restoring from localStorage for persistence across navigations
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as ThreadingCapability;
      if (Date.now() - stored.assessedAt < CACHE_TTL_MS) {
        _cached = stored;
        return _cached;
      }
    }
  } catch { /* */ }

  _cached = assessThreadingCapability();
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(_cached)); } catch { /* */ }
  return _cached;
}

// Invalidate cache (call after COOP/COEP headers change, e.g. reload)
export function invalidateThreadingCache(): void {
  _cached = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}

export function isMultiThreadEligible(): boolean {
  return getThreadingCapability().mode === "multi_thread_eligible";
}
