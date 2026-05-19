// Native platform abstraction layer — prepares architecture for future migration
// to Capacitor native execution (Android WorkManager, iOS BGTaskScheduler).
//
// Current implementation: WebPlatformAdapter (best-effort browser APIs).
// Future: CapacitorPlatformAdapter wrapping Capacitor plugins — drop-in replacement.
//
// Extension points:
//   - Background tasks: replace scheduleBackgroundTask with WorkManager/BGTaskScheduler
//   - Notifications: replace with Capacitor Local Notifications plugin
//   - Disk space: replace with Capacitor Filesystem plugin
//   - Low-power mode: replace with Capacitor Device plugin
//
// All Capacitor imports should be lazy (dynamic import) to preserve web build.

import { getDeviceProfile } from "./deviceProfile";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BackgroundTaskType =
  | "model_download"
  | "model_cleanup"
  | "background_index"
  | "manifest_refresh";

export type BackgroundTaskPriority = "low" | "normal" | "high";

export type BackgroundTask = {
  type: BackgroundTaskType;
  priority: BackgroundTaskPriority;
  payload?: Record<string, unknown>;
  delayMs?: number;         // minimum delay before starting
  requiresWifi?: boolean;
  requiresCharging?: boolean;
};

export type NotificationOpts = {
  title: string;
  body: string;
  badge?: number;
  scheduledAt?: Date;       // undefined = immediate
};

export type PermissionStatus = "granted" | "denied" | "unsupported";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface NativePlatformInterface {
  // Background task scheduling
  scheduleBackgroundTask(task: BackgroundTask): Promise<string>;    // taskId
  cancelBackgroundTask(taskId: string): Promise<void>;
  getPendingBackgroundTasks(): Promise<Array<{ id: string; type: BackgroundTaskType }>>;

  // System information
  getAvailableDiskSpaceBytes(): Promise<number | null>;
  isLowPowerMode(): Promise<boolean>;
  getBatteryLevel(): Promise<number | null>;                        // 0–100 or null

  // Notifications
  requestNotificationPermission(): Promise<PermissionStatus>;
  scheduleLocalNotification(opts: NotificationOpts): Promise<string>; // notificationId
  cancelNotification(id: string): Promise<void>;

  // Platform identification
  getPlatformName(): string;    // "web" | "ios" | "android" | "desktop"
  isNative(): boolean;          // false for web adapter
}

// ── Web adapter ────────────────────────────────────────────────────────────────
// Best-effort implementation using browser APIs.
// Background tasks: in-process setTimeout (not OS-level — does not survive tab close).
// Notifications: Web Notifications API (requires user permission).

class WebPlatformAdapter implements NativePlatformInterface {
  private _pendingTasks = new Map<string, ReturnType<typeof setTimeout>>();

  async scheduleBackgroundTask(task: BackgroundTask): Promise<string> {
    const taskId = `web-task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const delay = task.delayMs ?? 0;

    // Web: check constraints and defer with setTimeout
    if (task.requiresWifi) {
      const profile = await getDeviceProfile();
      if (profile.isOnWifi === false) {
        // Don't schedule — constraints not met
        return taskId;
      }
    }

    const timer = setTimeout(() => {
      this._pendingTasks.delete(taskId);
      // Task execution is caller's responsibility — this just signals readiness.
      // In a real Capacitor implementation, the OS would launch a background process.
    }, delay);

    this._pendingTasks.set(taskId, timer);
    return taskId;
  }

  async cancelBackgroundTask(taskId: string): Promise<void> {
    const timer = this._pendingTasks.get(taskId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._pendingTasks.delete(taskId);
    }
  }

  async getPendingBackgroundTasks(): Promise<Array<{ id: string; type: BackgroundTaskType }>> {
    return Array.from(this._pendingTasks.keys()).map((id) => ({
      id,
      type: "model_download" as BackgroundTaskType, // web doesn't track type
    }));
  }

  async getAvailableDiskSpaceBytes(): Promise<number | null> {
    if (!navigator.storage?.estimate) return null;
    try {
      const { quota, usage } = await navigator.storage.estimate();
      if (!quota) return null;
      return quota - (usage ?? 0);
    } catch {
      return null;
    }
  }

  async isLowPowerMode(): Promise<boolean> {
    const profile = await getDeviceProfile();
    // Infer low power from battery < 20% and not charging
    if (profile.batteryPct !== null && !profile.batteryCharging) {
      return profile.batteryPct < 20;
    }
    return false;
  }

  async getBatteryLevel(): Promise<number | null> {
    const profile = await getDeviceProfile({ refresh: true });
    return profile.batteryPct;
  }

  async requestNotificationPermission(): Promise<PermissionStatus> {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const result = await Notification.requestPermission();
      return result === "granted" ? "granted" : "denied";
    } catch {
      return "unsupported";
    }
  }

  async scheduleLocalNotification(opts: NotificationOpts): Promise<string> {
    const id = `notif-${Date.now()}`;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return id;
    }

    const show = () => {
      new Notification(opts.title, { body: opts.body, badge: opts.badge });
    };

    if (opts.scheduledAt && opts.scheduledAt > new Date()) {
      const delay = opts.scheduledAt.getTime() - Date.now();
      setTimeout(show, delay);
    } else {
      show();
    }

    return id;
  }

  async cancelNotification(_id: string): Promise<void> {
    // Web Notifications API doesn't support cancellation after dispatch.
    // No-op — notification already shown or timer pending (no handle stored).
  }

  getPlatformName(): string {
    return "web";
  }

  isNative(): boolean {
    return false;
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let _adapter: NativePlatformInterface | null = null;

export function getPlatformAdapter(): NativePlatformInterface {
  if (!_adapter) {
    // Future: detect Capacitor and return CapacitorPlatformAdapter
    // if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
    //   _adapter = new CapacitorPlatformAdapter();
    // } else {
    _adapter = new WebPlatformAdapter();
    // }
  }
  return _adapter;
}

// For testing only — reset adapter instance
export function _resetAdapterForTest(): void {
  _adapter = null;
}
