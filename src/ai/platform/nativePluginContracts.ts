// Native plugin integration contracts — typed interfaces for all Capacitor plugins
// that WellMate AI will require when migrating to native mobile.
//
// Each contract defines:
//   - The typed plugin interface (mirrors Capacitor plugin API)
//   - A web stub implementation (used when Capacitor plugin is absent)
//   - A resolution helper that returns native or stub
//
// When Capacitor plugins are installed:
//   1. Register them via capacitorBridge.registerCapacitorPlugin(name, impl)
//   2. The resolution helper automatically returns the native implementation
//
// Plugin contracts defined here:
//   - FilesystemPlugin    — file I/O, atomic writes, directory management
//   - WorkManagerPlugin   — Android background job scheduling
//   - BackgroundTaskPlugin — iOS background task scheduling
//   - BatteryPlugin       — battery level, charging state
//   - ThermalPlugin       — iOS ThermalState API (iOS 16+)
//   - CrashPlugin         — native crash capture + symbolication
//   - NotificationsPlugin — local notification scheduling
//   - BiometricPlugin     — encrypted keystore access (future model encryption)

import { resolvePlugin } from "./capacitorBridge";

// ── Filesystem Plugin ─────────────────────────────────────────────────────────

export interface FilesystemPlugin {
  readFile(opts: { path: string; directory: string; encoding?: string }): Promise<{ data: string }>;
  writeFile(opts: { path: string; directory: string; data: string; encoding?: string; recursive?: boolean }): Promise<void>;
  deleteFile(opts: { path: string; directory: string }): Promise<void>;
  mkdir(opts: { path: string; directory: string; recursive?: boolean }): Promise<void>;
  stat(opts: { path: string; directory: string }): Promise<{ size: number; mtime: number; type: string }>;
  copy(opts: { from: string; to: string; toDirectory: string; directory: string }): Promise<void>;
}

const filesystemStub: FilesystemPlugin = {
  async readFile() { throw new Error("Filesystem plugin not installed"); },
  async writeFile() { throw new Error("Filesystem plugin not installed"); },
  async deleteFile() { /* no-op */ },
  async mkdir() { /* no-op */ },
  async stat() { throw new Error("Filesystem plugin not installed"); },
  async copy() { throw new Error("Filesystem plugin not installed"); },
};

export function getFilesystemPlugin(): FilesystemPlugin {
  return resolvePlugin<FilesystemPlugin>("Filesystem") ?? filesystemStub;
}

// ── WorkManager Plugin (Android) ───────────────────────────────────────────────

export interface WorkManagerPlugin {
  enqueue(job: {
    tag: string;
    type: string;
    payload: string;
    requiresNetwork?: boolean;
    requiresCharging?: boolean;
    requiresDeviceIdle?: boolean;
    delayMs?: number;
    periodicIntervalMs?: number;
  }): Promise<{ jobId: string }>;
  cancel(opts: { tag: string }): Promise<void>;
  getStatus(opts: { tag: string }): Promise<{ status: "pending" | "running" | "succeeded" | "failed" | "cancelled" }>;
}

const workManagerStub: WorkManagerPlugin = {
  async enqueue() { return { jobId: `stub-${Date.now()}` }; },
  async cancel() { /* no-op */ },
  async getStatus() { return { status: "pending" }; },
};

export function getWorkManagerPlugin(): WorkManagerPlugin {
  return resolvePlugin<WorkManagerPlugin>("WorkManager") ?? workManagerStub;
}

// ── Background Task Plugin (iOS) ───────────────────────────────────────────────

export interface BackgroundTaskPlugin {
  scheduleProcessingTask(opts: {
    taskId: string;
    earliestBeginDate?: number;
    requiresExternalPower?: boolean;
    requiresNetworkConnectivity?: boolean;
  }): Promise<void>;
  scheduleAppRefreshTask(opts: {
    taskId: string;
    earliestBeginDate?: number;
  }): Promise<void>;
  cancel(opts: { taskId: string }): Promise<void>;
}

const backgroundTaskStub: BackgroundTaskPlugin = {
  async scheduleProcessingTask() { /* no-op */ },
  async scheduleAppRefreshTask() { /* no-op */ },
  async cancel() { /* no-op */ },
};

export function getBackgroundTaskPlugin(): BackgroundTaskPlugin {
  return resolvePlugin<BackgroundTaskPlugin>("BackgroundTask") ?? backgroundTaskStub;
}

// ── Battery Plugin ─────────────────────────────────────────────────────────────

export interface BatteryPlugin {
  getBatteryInfo(): Promise<{
    batteryLevel: number;  // 0-100
    isCharging: boolean;
    batteryState: "charging" | "unplugged" | "full" | "unknown";
  }>;
}

const batteryStub: BatteryPlugin = {
  async getBatteryInfo() {
    // Attempt web Battery API as fallback
    const nav = navigator as Navigator & { getBattery?(): Promise<{ level: number; charging: boolean }> };
    if (nav.getBattery) {
      try {
        const bat = await nav.getBattery();
        return {
          batteryLevel: Math.round(bat.level * 100),
          isCharging: bat.charging,
          batteryState: bat.charging ? "charging" : "unplugged",
        };
      } catch { /* */ }
    }
    return { batteryLevel: 100, isCharging: true, batteryState: "unknown" };
  },
};

export function getBatteryPlugin(): BatteryPlugin {
  return resolvePlugin<BatteryPlugin>("Battery") ?? batteryStub;
}

// ── Thermal Plugin (iOS 16+) ───────────────────────────────────────────────────

export interface ThermalPlugin {
  getThermalState(): Promise<{
    state: "nominal" | "fair" | "serious" | "critical";
  }>;
  addListener(event: "thermalStateChange", handler: (data: { state: string }) => void): { remove(): void };
}

const thermalStub: ThermalPlugin = {
  async getThermalState() { return { state: "nominal" }; },
  addListener(_event, _handler) { return { remove() { /* no-op */ } }; },
};

export function getThermalPlugin(): ThermalPlugin {
  return resolvePlugin<ThermalPlugin>("Thermal") ?? thermalStub;
}

// ── Crash Plugin ───────────────────────────────────────────────────────────────

export interface CrashPlugin {
  recordException(opts: { message: string; stackTrace?: string; context?: Record<string, string> }): Promise<void>;
  setCustomKey(opts: { key: string; value: string }): Promise<void>;
  crash(): Promise<void>; // force crash for testing
}

const crashStub: CrashPlugin = {
  async recordException() { /* no-op — telemetry handles this locally */ },
  async setCustomKey() { /* no-op */ },
  async crash() { throw new Error("Simulated crash"); },
};

export function getCrashPlugin(): CrashPlugin {
  return resolvePlugin<CrashPlugin>("Crash") ?? crashStub;
}

// ── Notifications Plugin ───────────────────────────────────────────────────────

export interface NotificationsPlugin {
  schedule(opts: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule?: { at: Date };
    }>;
  }): Promise<void>;
  cancel(opts: { notifications: Array<{ id: number }> }): Promise<void>;
  requestPermissions(): Promise<{ display: "granted" | "denied" | "prompt" }>;
}

const notificationsStub: NotificationsPlugin = {
  async schedule() { /* no-op */ },
  async cancel() { /* no-op */ },
  async requestPermissions() { return { display: "denied" }; },
};

export function getNotificationsPlugin(): NotificationsPlugin {
  return resolvePlugin<NotificationsPlugin>("LocalNotifications") ?? notificationsStub;
}

// ── Plugin availability map ────────────────────────────────────────────────────

export type PluginAvailabilityMap = {
  filesystem: boolean;
  workManager: boolean;
  backgroundTask: boolean;
  battery: boolean;
  thermal: boolean;
  crash: boolean;
  notifications: boolean;
};

export function getPluginAvailability(): PluginAvailabilityMap {
  return {
    filesystem: resolvePlugin("Filesystem") !== null,
    workManager: resolvePlugin("WorkManager") !== null,
    backgroundTask: resolvePlugin("BackgroundTask") !== null,
    battery: resolvePlugin("Battery") !== null,
    thermal: resolvePlugin("Thermal") !== null,
    crash: resolvePlugin("Crash") !== null,
    notifications: resolvePlugin("LocalNotifications") !== null,
  };
}
