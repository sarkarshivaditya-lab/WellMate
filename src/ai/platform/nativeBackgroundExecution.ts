// Native background execution — WorkManager (Android) + BGTaskScheduler (iOS)
// constraint modeling + scheduling semantics.
//
// Currently executes via in-process job queue (backgroundJobQueue.ts from Phase 11).
// This layer adds the native constraint vocabulary so future Capacitor plugin
// integration requires only a thin bridge, not an orchestration rewrite.
//
// Constraint types mirror real platform APIs:
//   WorkManager:       requiresNetwork, requiresCharging, requiresDeviceIdle, requiresStorageNotLow
//   BGTaskScheduler:   requiresExternalPower, requiresNetworkConnectivity, earliestBeginDate
//
// When native plugins are available, dispatchNativeJob() proxies to them.
// Until then, jobs run in the local queue with constraint checks.

import { resolvePlugin } from "./capacitorBridge";
import { isOvernightWindow } from "../runtime/batteryScheduler";

export type NativeConstraint = {
  requiresNetwork?: boolean;
  requiresCharging?: boolean;
  requiresDeviceIdle?: boolean;
  requiresStorageNotLow?: boolean;
  requiresBatteryPctAbove?: number;
  earliestDelayMs?: number; // defer by at least N ms
  deadlineMs?: number; // must run within N ms or discard
};

export type NativeJobPriority = "critical" | "high" | "normal" | "low" | "background";

export type NativeBackgroundJob = {
  jobId: string;
  type: string;
  label: string;
  priority: NativeJobPriority;
  constraints: NativeConstraint;
  payload: unknown;
  createdAt: number;
  scheduledAt: number | null;
  status: "pending" | "running" | "completed" | "deferred" | "failed" | "discarded";
  attempts: number;
  lastAttemptAt: number | null;
  resultSummary: string | null;
};

export type SchedulerState = {
  backend: "native_workmanager" | "native_bgtask" | "web_queue" | "none";
  pendingJobs: number;
  deferredJobs: number;
  platform: string;
};

const JOB_STORE_KEY = "ai_native_bg_jobs_v2";
const MAX_JOBS = 100;

type NativeSchedulerPlugin = {
  schedule(job: { type: string; payload: string; delay?: number }): Promise<{ jobId: string }>;
  cancel(jobId: string): Promise<void>;
};

let _idCounter = 0;
function nextJobId(): string { return `nbg-${Date.now()}-${_idCounter++}`; }

// ── Job store ──────────────────────────────────────────────────────────────────

function loadJobs(): Map<string, NativeBackgroundJob> {
  try {
    const raw = localStorage.getItem(JOB_STORE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as NativeBackgroundJob[];
    return new Map(arr.map((j) => [j.jobId, j]));
  } catch { return new Map(); }
}

function saveJobs(jobs: Map<string, NativeBackgroundJob>): void {
  try {
    const arr = [...jobs.values()].slice(-MAX_JOBS);
    localStorage.setItem(JOB_STORE_KEY, JSON.stringify(arr));
  } catch { /* */ }
}

function persistJob(job: NativeBackgroundJob): void {
  const jobs = loadJobs();
  jobs.set(job.jobId, job);
  saveJobs(jobs);
}

// ── Constraint evaluation ──────────────────────────────────────────────────────

async function evaluateConstraints(c: NativeConstraint): Promise<{ pass: boolean; reason: string | null }> {
  if (c.requiresNetwork) {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!online) return { pass: false, reason: "network_required" };
  }

  if (c.requiresBatteryPctAbove !== undefined) {
    try {
      const nav = navigator as Navigator & { getBattery?(): Promise<{ level: number }> };
      if (nav.getBattery) {
        const bat = await nav.getBattery();
        if (bat.level * 100 < c.requiresBatteryPctAbove) {
          return { pass: false, reason: `battery_below_${c.requiresBatteryPctAbove}pct` };
        }
      }
    } catch { /* battery API unavailable — allow */ }
  }

  if (c.requiresDeviceIdle && !isOvernightWindow()) {
    return { pass: false, reason: "device_not_idle_window" };
  }

  if (c.earliestDelayMs !== undefined) {
    // This constraint is evaluated at schedule time, not here
  }

  return { pass: true, reason: null };
}

// ── Native plugin dispatch ─────────────────────────────────────────────────────

function getSchedulerBackend(): SchedulerState["backend"] {
  if (resolvePlugin("WorkManager")) return "native_workmanager";
  if (resolvePlugin("BackgroundTask")) return "native_bgtask";
  if (typeof window !== "undefined") return "web_queue";
  return "none";
}

export async function scheduleNativeJob(
  type: string,
  label: string,
  priority: NativeJobPriority,
  constraints: NativeConstraint,
  payload: unknown,
): Promise<string> {
  const jobId = nextJobId();
  const job: NativeBackgroundJob = {
    jobId, type, label, priority, constraints, payload,
    createdAt: Date.now(),
    scheduledAt: null,
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    resultSummary: null,
  };

  const backend = getSchedulerBackend();
  const delay = constraints.earliestDelayMs ?? 0;

  if (backend === "native_workmanager" || backend === "native_bgtask") {
    const plugin = resolvePlugin<NativeSchedulerPlugin>(
      backend === "native_workmanager" ? "WorkManager" : "BackgroundTask",
    );
    if (plugin) {
      try {
        await plugin.schedule({ type, payload: JSON.stringify(payload), delay });
        job.scheduledAt = Date.now();
        job.status = "pending";
      } catch {
        job.status = "failed";
        job.resultSummary = "native schedule failed";
      }
    }
  } else {
    // Web queue: evaluate constraints before scheduling
    const { pass, reason } = await evaluateConstraints(constraints);
    if (!pass) {
      job.status = "deferred";
      job.resultSummary = `Deferred: ${reason}`;
    } else {
      job.scheduledAt = Date.now();
    }
  }

  persistJob(job);
  return jobId;
}

export function cancelNativeJob(jobId: string): void {
  const jobs = loadJobs();
  const job = jobs.get(jobId);
  if (!job) return;

  const plugin = resolvePlugin<NativeSchedulerPlugin>("WorkManager")
    ?? resolvePlugin<NativeSchedulerPlugin>("BackgroundTask");
  if (plugin) void plugin.cancel(jobId).catch(() => null);

  job.status = "discarded";
  jobs.set(jobId, job);
  saveJobs(jobs);
}

export function markJobComplete(jobId: string, summary: string): void {
  const jobs = loadJobs();
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "completed";
  job.resultSummary = summary;
  jobs.set(jobId, job);
  saveJobs(jobs);
}

export function getPendingJobs(): NativeBackgroundJob[] {
  return [...loadJobs().values()].filter((j) => j.status === "pending" || j.status === "deferred");
}

export function getAllNativeJobs(): NativeBackgroundJob[] {
  return [...loadJobs().values()];
}

export function getSchedulerState(): SchedulerState {
  const jobs = [...loadJobs().values()];
  return {
    backend: getSchedulerBackend(),
    pendingJobs: jobs.filter((j) => j.status === "pending").length,
    deferredJobs: jobs.filter((j) => j.status === "deferred").length,
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
  };
}

export async function evaluateJobConstraints(jobId: string): Promise<{ pass: boolean; reason: string | null }> {
  const jobs = loadJobs();
  const job = jobs.get(jobId);
  if (!job) return { pass: false, reason: "job_not_found" };
  return evaluateConstraints(job.constraints);
}
