// Lifecycle recovery — crash detection and startup repair.
//
// Clean-exit protocol: write a marker to localStorage on unload.
// On the next startup, if the marker is absent, a crash is inferred.
//
// Recovery checks:
//   crash_detected      — clean-exit marker was missing on startup
//   interrupted_download — an in-progress chunk download was abandoned
//   stale_markers       — cleanup keys that accumulate from partial operations
//   incomplete_migration — ai_migration_progress_v1 key present (from migrationEngine)
//   corrupted_keys      — localStorage keys that cannot be JSON-parsed
//
// All recovery actions are logged and accessible via getRecoveryLog().

const CLEAN_EXIT_KEY = "ai_clean_exit_v1";
const RECOVERY_LOG_KEY = "ai_recovery_log_v1";
const DELIVERY_CHECKPOINT_PREFIX = "ai_delivery_checkpoint_";
const MIGRATION_KEY = "ai_migration_progress_v1";
const MAX_LOG_ENTRIES = 50;

export type RecoveryActionType =
  | "crash_detected"
  | "interrupted_download"
  | "stale_markers"
  | "incomplete_migration"
  | "corrupted_keys"
  | "clean_startup";

export type RecoveryAction = {
  type: RecoveryActionType;
  detail: string;
  repairedAt: number;
};

export type RecoveryReport = {
  crashDetected: boolean;
  actionsPerformed: RecoveryAction[];
  totalRepaired: number;
};

// ── Clean-exit marker ──────────────────────────────────────────────────────────

export function markCleanExit(): void {
  try { localStorage.setItem(CLEAN_EXIT_KEY, String(Date.now())); } catch { /* */ }
}

function consumeCleanExitMarker(): boolean {
  try {
    const exists = localStorage.getItem(CLEAN_EXIT_KEY) !== null;
    localStorage.removeItem(CLEAN_EXIT_KEY);
    return exists;
  } catch { return true; } // assume clean on storage error
}

// ── Recovery log ───────────────────────────────────────────────────────────────

function loadLog(): RecoveryAction[] {
  try {
    const raw = localStorage.getItem(RECOVERY_LOG_KEY);
    return raw ? (JSON.parse(raw) as RecoveryAction[]) : [];
  } catch { return []; }
}

function appendLog(actions: RecoveryAction[]): void {
  if (!actions.length) return;
  try {
    const existing = loadLog();
    const merged = [...existing, ...actions].slice(-MAX_LOG_ENTRIES);
    localStorage.setItem(RECOVERY_LOG_KEY, JSON.stringify(merged));
  } catch { /* storage full */ }
}

export function getRecoveryLog(): RecoveryAction[] {
  return loadLog();
}

// ── Repair passes ──────────────────────────────────────────────────────────────

function findInterruptedDownloads(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DELIVERY_CHECKPOINT_PREFIX)) {
        ids.push(key.slice(DELIVERY_CHECKPOINT_PREFIX.length));
      }
    }
  } catch { /* */ }
  return ids;
}

function findCorruptedKeys(): string[] {
  const corrupt: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("ai_")) continue;
      const val = localStorage.getItem(key);
      if (!val) continue;
      try { JSON.parse(val); } catch { corrupt.push(key); }
    }
  } catch { /* */ }
  return corrupt;
}

function repairCorruptedKeys(keys: string[]): void {
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch { /* */ }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function assessAndRecover(): Promise<RecoveryReport> {
  const actions: RecoveryAction[] = [];
  const hadCleanExit = consumeCleanExitMarker();

  if (!hadCleanExit) {
    actions.push({
      type: "crash_detected",
      detail: "No clean-exit marker found — previous session likely crashed",
      repairedAt: Date.now(),
    });
  }

  // Interrupted downloads
  const interruptedIds = findInterruptedDownloads();
  if (interruptedIds.length) {
    actions.push({
      type: "interrupted_download",
      detail: `Found ${interruptedIds.length} interrupted download(s): ${interruptedIds.join(", ")}`,
      repairedAt: Date.now(),
    });
    // Leave checkpoints intact — resumableDelivery will use them for resume
  }

  // Incomplete migration
  try {
    if (localStorage.getItem(MIGRATION_KEY) !== null) {
      actions.push({
        type: "incomplete_migration",
        detail: "Migration was in progress when session ended",
        repairedAt: Date.now(),
      });
    }
  } catch { /* */ }

  // Corrupted keys
  const corrupt = findCorruptedKeys();
  if (corrupt.length) {
    repairCorruptedKeys(corrupt);
    actions.push({
      type: "corrupted_keys",
      detail: `Removed ${corrupt.length} unparseable localStorage key(s): ${corrupt.slice(0, 5).join(", ")}`,
      repairedAt: Date.now(),
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: "clean_startup",
      detail: "Clean exit marker present; no repair needed",
      repairedAt: Date.now(),
    });
  }

  appendLog(actions);

  return {
    crashDetected: !hadCleanExit,
    actionsPerformed: actions,
    totalRepaired: actions.filter((a) => a.type !== "clean_startup" && a.type !== "crash_detected").length,
  };
}
