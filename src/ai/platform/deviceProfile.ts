// Best-effort device profile for model compatibility and download decisions.
// Uses standard browser APIs where available; conservatively estimates when not.
//
// navigator.deviceMemory — Chrome/Edge only (HTTPS required). Returns: 0.25, 0.5, 1, 2, 4, 8 GB.
// navigator.connection   — Chrome/Edge only. Type: "wifi" | "cellular" | "none" | "other".
// navigator.getBattery() — Chrome only. Deprecated in most browsers; best-effort.
// navigator.storage.estimate() — widely supported (iOS 16+, Android Chrome 86+).

import type { DeviceTier } from "@/ai/providers/local/modelMetadata";

export type PlatformType = "ios" | "android" | "web" | "desktop";

export type DeviceProfile = {
  tier: DeviceTier;
  estimatedRamGB: number | null; // null when deviceMemory API unavailable
  platform: PlatformType;
  isOnWifi: boolean | null;      // null when connection API unavailable
  batteryPct: number | null;     // 0–100; null when Battery API unavailable
  batteryCharging: boolean | null;
  availableStorageMB: number | null;
};

// Non-standard navigator extensions — declared to avoid any-casting
declare global {
  interface Navigator {
    deviceMemory?: number;
    connection?: {
      type?: string;
      effectiveType?: string;
      downlink?: number;
      saveData?: boolean;
    };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  }
}

function detectPlatform(): PlatformType {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !/Chrome/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (!/Mobile|Tablet/.test(ua)) return "desktop";
  return "web";
}

function getEstimatedRamGB(): number | null {
  return navigator.deviceMemory ?? null;
}

function classifyTier(ramGB: number | null): DeviceTier {
  if (ramGB === null) return "mid"; // conservative assumption
  if (ramGB <= 2) return "low";
  if (ramGB <= 4) return "mid";
  if (ramGB <= 6) return "high";
  return "flagship";
}

function detectWifi(): boolean | null {
  const conn = navigator.connection;
  if (!conn) return null;
  if (conn.type === "wifi") return true;
  if (conn.type && conn.type !== "wifi" && conn.type !== "other" && conn.type !== "none") {
    return false; // cellular or similar
  }
  // effectiveType alone isn't reliable enough to distinguish wifi from fast LTE
  return null;
}

async function detectBattery(): Promise<{ pct: number | null; charging: boolean | null }> {
  if (!navigator.getBattery) return { pct: null, charging: null };
  try {
    const b = await navigator.getBattery();
    return { pct: Math.round(b.level * 100), charging: b.charging };
  } catch {
    return { pct: null, charging: null };
  }
}

async function detectAvailableStorageMB(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (!quota) return null;
    return Math.round((quota - (usage ?? 0)) / 1_000_000);
  } catch {
    return null;
  }
}

let _cached: DeviceProfile | null = null;

export async function getDeviceProfile(opts?: { refresh?: boolean }): Promise<DeviceProfile> {
  if (_cached && !opts?.refresh) return _cached;

  const ramGB = getEstimatedRamGB();
  const [battery, availableStorageMB] = await Promise.all([
    detectBattery(),
    detectAvailableStorageMB(),
  ]);

  _cached = {
    tier: classifyTier(ramGB),
    estimatedRamGB: ramGB,
    platform: detectPlatform(),
    isOnWifi: detectWifi(),
    batteryPct: battery.pct,
    batteryCharging: battery.charging,
    availableStorageMB,
  };

  return _cached;
}

// Synchronous read of cached profile — null until first async call completes.
export function getDeviceProfileSync(): DeviceProfile | null {
  return _cached;
}

export function isModelCompatible(
  profile: DeviceProfile,
  minRamMB: number,
): boolean {
  if (profile.estimatedRamGB === null) return true; // can't tell — allow
  return profile.estimatedRamGB * 1024 >= minRamMB;
}
