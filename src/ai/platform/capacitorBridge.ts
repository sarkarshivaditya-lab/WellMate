// Capacitor bridge — typed interface layer for native plugin resolution.
//
// Detects whether the app is running inside Capacitor (native iOS/Android)
// and provides safe plugin resolution with fallback stubs for web.
//
// All plugin access goes through resolvePlugin() so web/native paths stay
// cleanly separated. Never import Capacitor packages directly in AI modules.

export type RuntimeEnvironment = "web" | "capacitor_ios" | "capacitor_android" | "capacitor_unknown";

export type RuntimeFingerprint = {
  environment: RuntimeEnvironment;
  isNative: boolean;
  capacitorVersion: string | null;
  platform: string;
  userAgent: string;
};

type CapacitorGlobal = {
  isNativePlatform(): boolean;
  getPlatform(): string;
  version?: { major: number };
  Plugins?: Record<string, unknown>;
};

const _pluginRegistry = new Map<string, unknown>();

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export function isCapacitorAvailable(): boolean {
  return getCapacitor() !== null;
}

export function isNativePlatform(): boolean {
  return getCapacitor()?.isNativePlatform() ?? false;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const cap = getCapacitor();
  if (!cap) return "web";
  if (!cap.isNativePlatform()) return "web";
  const platform = cap.getPlatform().toLowerCase();
  if (platform === "ios") return "capacitor_ios";
  if (platform === "android") return "capacitor_android";
  return "capacitor_unknown";
}

export function getRuntimeFingerprint(): RuntimeFingerprint {
  const cap = getCapacitor();
  return {
    environment: getRuntimeEnvironment(),
    isNative: isNativePlatform(),
    capacitorVersion: cap?.version ? String(cap.version.major) : null,
    platform: cap?.getPlatform() ?? "web",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };
}

// Resolve a named Capacitor plugin. Returns null if not available.
// Falls back to registry stubs registered via registerCapacitorPlugin().
export function resolvePlugin<T>(name: string): T | null {
  // Check local registry first (allows stubs in tests / web)
  if (_pluginRegistry.has(name)) {
    return _pluginRegistry.get(name) as T;
  }

  const cap = getCapacitor();
  if (!cap?.Plugins) return null;

  const plugin = cap.Plugins[name];
  return plugin ? (plugin as T) : null;
}

// Alias with explicit generic — identical to resolvePlugin
export function getCapacitorPlugin<T>(name: string): T | null {
  return resolvePlugin<T>(name);
}

// Register a stub or web implementation for a named plugin.
// Takes precedence over native Capacitor.Plugins[name] resolution.
export function registerCapacitorPlugin(name: string, impl: unknown): void {
  _pluginRegistry.set(name, impl);
}

// ── Typed stubs for common plugins (web fallbacks) ────────────────────────────

export type DeviceInfo = {
  platform: string;
  model: string;
  operatingSystem: string;
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  memUsed?: number;
  diskFree?: number;
  diskTotal?: number;
  realDiskFree?: number;
  realDiskTotal?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  webViewVersion: string;
};

export async function getDeviceInfo(): Promise<Partial<DeviceInfo>> {
  const plugin = resolvePlugin<{ getInfo(): Promise<DeviceInfo> }>("Device");
  if (plugin) {
    try { return await plugin.getInfo(); } catch { /* fallthrough */ }
  }
  // Web fallback
  return {
    platform: "web",
    operatingSystem: "unknown",
    osVersion: "unknown",
    isVirtual: false,
    webViewVersion: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };
}
