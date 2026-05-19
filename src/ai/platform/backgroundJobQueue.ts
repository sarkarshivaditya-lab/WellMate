// Persistent background job queue — survives page refresh via localStorage.
// Provides production-grade orchestration interfaces for future native migration.
//
// On Capacitor: swap drainJobQueue() callers with WorkManager (Android) or
// BGTaskScheduler (iOS). The job schema and executor registry stay identical.
//
// Job lifecycle: pending → running → completed | failed | deferred | cancelled
// Deferred: constraints not met (wifi/battery). Retried on next drain.
// Failed: max attempts exhausted. Must be re-enqueued to retry.

import type { BackgroundTaskType } from "./nativePlatformAdapter";

export type JobPriority = "critical" | "high" | "normal" | "low";
export type JobStatus = "pending" | "running" | "completed" | "failed" | "deferred" | "cancelled";

export type BackgroundJob = {
  jobId: string;
  type: BackgroundTaskType;
  priority: JobPriority;
  payload?: Record<string, unknown>;
  createdAt: number;
  scheduledAt?: number;       // earliest execution timestamp; undefined = immediate
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: number;
  status: JobStatus;
  requiresWifi?: boolean;
  requiresCharging?: boolean;
  minBatteryPct?: number;
  error?: string;
};

type JobExecutor = (job: BackgroundJob, signal: AbortSignal) => Promise<void>;

const QUEUE_KEY = "ai_bg_job_queue_v1";
const MAX_JOBS = 50;
const LOW_BATTERY_THRESHOLD = 20;

const PRIORITY_RANK: Record<JobPriority, number> = {
  critical: 0, high: 1, normal: 2, low: 3,
};

const _executors = new Map<BackgroundTaskType, JobExecutor>();
let _running = false;
let _drainController: AbortController | null = null;

// ── Storage ────────────────────────────────────────────────────────────────────

function readQueue(): BackgroundJob[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as BackgroundJob[]) : [];
  } catch { return []; }
}

function writeQueue(jobs: BackgroundJob[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(jobs.slice(-MAX_JOBS)));
  } catch { /* quota exceeded — non-fatal */ }
}

// ── Constraint evaluation ──────────────────────────────────────────────────────

async function isJobEligible(job: BackgroundJob): Promise<boolean> {
  if (job.scheduledAt && Date.now() < job.scheduledAt) return false;

  try {
    const { getDeviceProfile } = await import("./deviceProfile");
    const profile = await getDeviceProfile();

    if (job.requiresCharging && !profile.batteryCharging) return false;
    if (job.requiresWifi && profile.isOnWifi === false) return false;

    const pct = profile.batteryPct ?? 100;
    if (job.minBatteryPct && pct < job.minBatteryPct) return false;

    // Non-critical jobs defer on low battery + not charging
    if (job.priority !== "critical" && !profile.batteryCharging && pct < LOW_BATTERY_THRESHOLD) {
      return false;
    }
  } catch { /* non-fatal — allow job if profile unavailable */ }

  return true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function registerExecutor(type: BackgroundTaskType, fn: JobExecutor): void {
  _executors.set(type, fn);
}

export function enqueueJob(
  job: Omit<BackgroundJob, "jobId" | "createdAt" | "attempts" | "status">,
): string {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const full: BackgroundJob = { ...job, jobId, createdAt: Date.now(), attempts: 0, status: "pending" };
  const queue = readQueue();
  queue.push(full);
  queue.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  writeQueue(queue);
  return jobId;
}

export function cancelJob(jobId: string): boolean {
  const queue = readQueue();
  const job = queue.find((j) => j.jobId === jobId);
  if (!job || job.status === "completed") return false;
  job.status = "cancelled";
  writeQueue(queue);
  return true;
}

export function getJobQueue(): BackgroundJob[] {
  return readQueue();
}

export function getPendingJobCount(): number {
  return readQueue().filter((j) => j.status === "pending" || j.status === "deferred").length;
}

export async function drainJobQueue(signal?: AbortSignal): Promise<{ ran: number; deferred: number; failed: number }> {
  if (_running) return { ran: 0, deferred: 0, failed: 0 };
  _running = true;
  _drainController = new AbortController();

  const merged = signal ?? _drainController.signal;
  let ran = 0;
  let deferred = 0;
  let failed = 0;

  try {
    const queue = readQueue();

    for (const job of queue) {
      if (merged.aborted) break;
      if (job.status !== "pending" && job.status !== "deferred") continue;

      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        job.error = "Max attempts reached";
        failed++;
        continue;
      }

      const eligible = await isJobEligible(job);
      if (!eligible) {
        job.status = "deferred";
        deferred++;
        continue;
      }

      const executor = _executors.get(job.type);
      if (!executor) {
        job.status = "deferred"; // no executor registered yet
        deferred++;
        continue;
      }

      job.status = "running";
      job.attempts++;
      job.lastAttemptAt = Date.now();
      writeQueue(queue);

      try {
        const ctrl = new AbortController();
        merged.addEventListener("abort", () => ctrl.abort(), { once: true });
        await executor(job, ctrl.signal);
        job.status = "completed";
        ran++;
      } catch {
        job.status = job.attempts >= job.maxAttempts ? "failed" : "pending";
        job.error = "Execution failed";
        if (job.status === "failed") failed++;
      }
    }

    writeQueue(queue);
  } finally {
    _running = false;
    _drainController = null;
  }

  return { ran, deferred, failed };
}

export function stopJobQueue(): void {
  _drainController?.abort();
}

// Prune completed/cancelled jobs older than olderThanMs. Returns count removed.
export function pruneCompletedJobs(olderThanMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - olderThanMs;
  const queue = readQueue();
  const before = queue.length;
  const filtered = queue.filter(
    (j) => (j.status !== "completed" && j.status !== "cancelled") || j.createdAt > cutoff,
  );
  writeQueue(filtered);
  return before - filtered.length;
}

export function clearAllJobs(): void {
  localStorage.removeItem(QUEUE_KEY);
}
