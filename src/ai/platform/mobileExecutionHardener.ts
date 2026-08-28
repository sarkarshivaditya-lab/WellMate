// Mobile Execution Hardener — runtime protections for mobile browser environments.
//
// Handles:
//   Safari pagehide/pageshow lifecycle   — graceful worker suspend/resume
//   Android low-memory detection         — memory pressure via performance.memory API
//   Worker crash recovery policy         — tiered exponential backoff
//   Thermal-aware inference scheduling   — defer non-urgent inference when hot
//   iOS background throttling            — detect 30s JS timer suppression
//   document.hidden inference suppression — don't run inference in background tab
//
// All handlers are non-destructive: they emit events and throttle, never kill state.
// Bound once via initMobileHardener() at app startup.

import { getThermalState } from "@/ai/runtime/thermalGuard";
import { emitCognitionEvent } from "@/ai/cognition/cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MobilePlatform = "ios_safari" | "android_chrome" | "android_firefox" | "desktop" | "unknown";

export type MemoryPressureLevel = "normal" | "moderate" | "high" | "critical";

export type MobileExecutionState = {
  platform: MobilePlatform;
  isVisible: boolean;
  isPageHidden: boolean;
  memoryPressure: MemoryPressureLevel;
  thermalState: string;
  inferenceDeferred: boolean;
  workerCrashCount: number;
  lastWorkerCrashAt: number | null;
  backoffMs: number;
  initTime: number;
};

export type MobileHardenerReport = {
  state: MobileExecutionState;
  deferredInferenceCount: number;
  safariLifecycleEvents: number;
  memoryWarnings: number;
  isHardened: boolean;
};

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)) return "ios_safari";
  if (/Android/.test(ua) && /Firefox/.test(ua)) return "android_firefox";
  if (/Android/.test(ua)) return "android_chrome";
  if (!/Mobi|Android/.test(ua)) return "desktop";
  return "unknown";
}

// ── Memory pressure detection ─────────────────────────────────────────────────

function sampleMemoryPressure(): MemoryPressureLevel {
  const mem = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem) return "normal";

  const ratio = mem.usedJSHeapSize / Math.max(1, mem.jsHeapSizeLimit);
  if (ratio > 0.9) return "critical";
  if (ratio > 0.75) return "high";
  if (ratio > 0.55) return "moderate";
  return "normal";
}

// ── State ──────────────────────────────────────────────────────────────────────

let _state: MobileExecutionState = {
  platform: "unknown",
  isVisible: true,
  isPageHidden: false,
  memoryPressure: "normal",
  thermalState: "nominal",
  inferenceDeferred: false,
  workerCrashCount: 0,
  lastWorkerCrashAt: null,
  backoffMs: 0,
  initTime: Date.now(),
};

let _deferredCount = 0;
let _safariEvents = 0;
let _memWarnings = 0;
let _initialized = false;

// ── Inference gate ────────────────────────────────────────────────────────────

export function canExecuteInferenceNow(urgency: "high" | "normal" | "low" = "normal"): boolean {
  _state.memoryPressure = sampleMemoryPressure();
  _state.thermalState = getThermalState();

  // Background tab — never execute
  if (typeof document !== "undefined" && document.hidden) return false;

  // Critical memory pressure — only allow high urgency
  if (_state.memoryPressure === "critical" && urgency !== "high") {
    _deferredCount++;
    _state.inferenceDeferred = true;
    emitCognitionEvent("safety_violation", { kind: "memory_pressure_critical", urgency });
    return false;
  }

  // High memory pressure — only normal or high
  if (_state.memoryPressure === "high" && urgency === "low") {
    _deferredCount++;
    return false;
  }

  // Thermal emergency — block all
  if (_state.thermalState === "emergency") {
    _deferredCount++;
    _state.inferenceDeferred = true;
    return false;
  }

  // Thermal critical — only high urgency
  if (_state.thermalState === "critical" && urgency !== "high") {
    _deferredCount++;
    return false;
  }

  // Page hidden (not just visibility, but actual pagehide)
  if (_state.isPageHidden) {
    _deferredCount++;
    return false;
  }

  _state.inferenceDeferred = false;
  return true;
}

export function recordWorkerCrash(): void {
  _state.workerCrashCount++;
  _state.lastWorkerCrashAt = Date.now();
  // Exponential backoff: 500ms × 2^crashCount, cap at 30s
  _state.backoffMs = Math.min(30_000, 500 * Math.pow(2, _state.workerCrashCount - 1));
  emitCognitionEvent("safety_violation", {
    kind: "worker_crash",
    crashCount: _state.workerCrashCount,
    backoffMs: _state.backoffMs,
  });
}

export function getWorkerBackoffMs(): number {
  if (_state.lastWorkerCrashAt === null) return 0;
  const elapsed = Date.now() - _state.lastWorkerCrashAt;
  const remaining = _state.backoffMs - elapsed;
  return Math.max(0, remaining);
}

// ── Lifecycle binding ─────────────────────────────────────────────────────────

export function initMobileHardener(): void {
  if (_initialized || typeof document === "undefined") return;
  _initialized = true;

  _state.platform = detectPlatform();

  // Visibility change
  document.addEventListener("visibilitychange", () => {
    _state.isVisible = !document.hidden;
    if (document.hidden) {
      emitCognitionEvent("cognition_checkpoint_created", { source: "tab_hidden" });
    }
  });

  // Safari pagehide — aggressive background suspension
  window.addEventListener("pagehide", (e) => {
    _state.isPageHidden = true;
    _safariEvents++;
    // Persisted: page going into bfcache (can come back)
    emitCognitionEvent("cognition_checkpoint_created", {
      source: "pagehide",
      persisted: (e as PageTransitionEvent).persisted,
    });
  });

  window.addEventListener("pageshow", (e) => {
    _state.isPageHidden = false;
    _safariEvents++;
    // Reset backoff on pageshow — fresh start
    if (_state.workerCrashCount > 0) {
      _state.backoffMs = Math.max(0, _state.backoffMs / 2);
    }
    emitCognitionEvent("cognition_checkpoint_created", {
      source: "pageshow",
      persisted: (e as PageTransitionEvent).persisted,
    });
  });

  // Memory pressure via periodic sampling (every 30s)
  setInterval(() => {
    const prev = _state.memoryPressure;
    _state.memoryPressure = sampleMemoryPressure();
    if (prev !== "high" && prev !== "critical" && (_state.memoryPressure === "high" || _state.memoryPressure === "critical")) {
      _memWarnings++;
      emitCognitionEvent("safety_violation", { kind: "memory_pressure_elevated", level: _state.memoryPressure });
    }
  }, 30_000);
}

// ── Observable ────────────────────────────────────────────────────────────────

export function getMobileHardenerReport(): MobileHardenerReport {
  return {
    state: { ..._state },
    deferredInferenceCount: _deferredCount,
    safariLifecycleEvents: _safariEvents,
    memoryWarnings: _memWarnings,
    isHardened: _initialized,
  };
}

export function getMobileExecutionState(): MobileExecutionState {
  _state.memoryPressure = sampleMemoryPressure();
  _state.thermalState = getThermalState();
  return { ..._state };
}
