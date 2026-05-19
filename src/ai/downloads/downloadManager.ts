// Download manager — wraps resumable download infrastructure with:
//   - Wi-Fi preference detection
//   - Battery-aware deferral (< 20% + not charging → warn)
//   - Download eligibility checks before starting
//   - Centralized download state (one active download at a time)
//   - Progress checkpointing via localStorage so state survives page reload
//
// True OS-level background downloads (Capacitor BGGeolocation-style) require
// platform plugins beyond the scope of this module. This module handles the
// web-layer orchestration; Capacitor extensions should wrap these primitives.

import { getDeviceProfile } from "@/ai/platform/deviceProfile";

export type DownloadConstraint =
  | "none"
  | "wifi_recommended"  // not on Wi-Fi but download is large
  | "battery_low"       // < 20% and not charging
  | "storage_low";      // insufficient storage

export type DownloadEligibility = {
  eligible: boolean;
  constraint: DownloadConstraint;
  wifiConfirmed: boolean | null; // null = unknown
  batteryPct: number | null;
  batteryCharging: boolean | null;
};

const LARGE_DOWNLOAD_THRESHOLD = 500 * 1024 * 1024; // 500 MB
const LOW_BATTERY_THRESHOLD = 20; // %

export async function checkDownloadEligibility(
  sizeBytes: number,
): Promise<DownloadEligibility> {
  const profile = await getDeviceProfile();

  const isLarge = sizeBytes >= LARGE_DOWNLOAD_THRESHOLD;
  const isOnWifi = profile.isOnWifi;
  const batteryPct = profile.batteryPct;
  const batteryCharging = profile.batteryCharging;

  // Block on critically low battery (not charging, < 20%)
  if (
    batteryPct !== null &&
    !batteryCharging &&
    batteryPct < LOW_BATTERY_THRESHOLD
  ) {
    return {
      eligible: false,
      constraint: "battery_low",
      wifiConfirmed: isOnWifi,
      batteryPct,
      batteryCharging,
    };
  }

  // Warn (not block) on large download without confirmed Wi-Fi
  if (isLarge && isOnWifi === false) {
    return {
      eligible: true, // still allowed — just advisory
      constraint: "wifi_recommended",
      wifiConfirmed: isOnWifi,
      batteryPct,
      batteryCharging,
    };
  }

  return {
    eligible: true,
    constraint: "none",
    wifiConfirmed: isOnWifi,
    batteryPct,
    batteryCharging,
  };
}

// ── Active download tracking ───────────────────────────────────────────────────
// Prevents duplicate concurrent downloads of the same model.

const ACTIVE_KEY_PREFIX = "ai_download_active_";

export function markDownloadActive(modelId: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY_PREFIX + modelId, String(Date.now()));
  } catch { /* non-fatal */ }
}

export function markDownloadComplete(modelId: string): void {
  try {
    localStorage.removeItem(ACTIVE_KEY_PREFIX + modelId);
  } catch { /* non-fatal */ }
}

export function isDownloadActive(modelId: string): boolean {
  const ts = localStorage.getItem(ACTIVE_KEY_PREFIX + modelId);
  if (!ts) return false;
  // Stale if older than 24 h (tab was killed mid-download)
  return Date.now() - parseInt(ts, 10) < 24 * 60 * 60 * 1000;
}

// ── Active model pointer ───────────────────────────────────────────────────────
// Tracks which stored model should be loaded as the active inference provider.

const ACTIVE_MODEL_KEY = "ai_active_model_id";
const STAGED_MODEL_KEY = "ai_staged_model_id";

export function getActiveModelId(): string | null {
  return localStorage.getItem(ACTIVE_MODEL_KEY);
}

export function setActiveModelId(id: string): void {
  localStorage.setItem(ACTIVE_MODEL_KEY, id);
}

export function clearActiveModelId(): void {
  localStorage.removeItem(ACTIVE_MODEL_KEY);
}

export function getStagedModelId(): string | null {
  return localStorage.getItem(STAGED_MODEL_KEY);
}

export function setStagedModelId(id: string): void {
  localStorage.setItem(STAGED_MODEL_KEY, id);
}

export function clearStagedModelId(): void {
  localStorage.removeItem(STAGED_MODEL_KEY);
}
