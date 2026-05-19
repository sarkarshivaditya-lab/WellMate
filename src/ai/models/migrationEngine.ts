// Enterprise-grade model migration — replaces the old single-step upgrade
// with a fully staged, rollback-safe flow.
//
// Staged upgrade flow:
//   1. download-new   — download target model; existing model untouched
//   2. validate       — GGUF integrity check on downloaded file
//   3. checkpoint     — save rollback state to localStorage
//   4. switch         — update active model pointer
//   5. commit         — delete old model (point of no return)
//   6. complete
//
// If any stage fails: automatic rollback restores active pointer and emits error.
// Old model is only deleted AFTER the new one is validated and activated.

import type { ModelManifest } from "@/ai/providers/local/modelMetadata";
import {
  downloadAndStoreModel,
  validateModelIntegrity,
  isModelStored,
  deleteStoredModel,
} from "@/ai/providers/local/modelLoader";
import {
  setActiveModelId,
  setStagedModelId,
  clearStagedModelId,
  getActiveModelId,
  markDownloadActive,
  markDownloadComplete,
} from "@/ai/downloads/downloadManager";

export type MigrationStage =
  | "idle"
  | "downloading"
  | "validating"
  | "checkpointing"
  | "switching"
  | "committing"
  | "rolling_back"
  | "complete"
  | "failed";

export type MigrationState = {
  stage: MigrationStage;
  progressPct: number;
  sourceModelId: string | null;
  targetModelId: string;
  error?: string;
};

type MigrationCheckpoint = {
  previousActiveId: string | null;
  targetModelId: string;
  savedAt: number;
};

const CHECKPOINT_KEY = "ai_migration_checkpoint";
const MIGRATION_HISTORY_KEY = "ai_migration_history_v1";

// ── Pub/sub ────────────────────────────────────────────────────────────────────

type MigrationListener = (state: MigrationState) => void;
const _listeners = new Set<MigrationListener>();
let _state: MigrationState | null = null;

function emitMigration(state: MigrationState): void {
  _state = state;
  _listeners.forEach((fn) => { try { fn(state); } catch { /* never crash */ } });
}

export function subscribeToMigration(fn: MigrationListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getMigrationState(): MigrationState | null {
  return _state;
}

// ── Checkpoint helpers ─────────────────────────────────────────────────────────

function saveCheckpoint(checkpoint: MigrationCheckpoint): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch { /* non-fatal */ }
}

function loadCheckpoint(): MigrationCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    return raw ? (JSON.parse(raw) as MigrationCheckpoint) : null;
  } catch {
    return null;
  }
}

function clearCheckpoint(): void {
  localStorage.removeItem(CHECKPOINT_KEY);
}

// ── Migration history ──────────────────────────────────────────────────────────

type MigrationRecord = {
  from: string | null;
  to: string;
  completedAt: number;
  success: boolean;
  error?: string;
};

function appendHistory(record: MigrationRecord): void {
  try {
    const raw = localStorage.getItem(MIGRATION_HISTORY_KEY);
    const history: MigrationRecord[] = raw ? JSON.parse(raw) : [];
    history.push(record);
    // Keep last 20 records
    if (history.length > 20) history.splice(0, history.length - 20);
    localStorage.setItem(MIGRATION_HISTORY_KEY, JSON.stringify(history));
  } catch { /* non-fatal */ }
}

export function getMigrationHistory(): MigrationRecord[] {
  try {
    const raw = localStorage.getItem(MIGRATION_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as MigrationRecord[]) : [];
  } catch {
    return [];
  }
}

// ── Main migration flow ────────────────────────────────────────────────────────

export async function performMigration(
  targetManifest: ModelManifest,
  opts?: {
    signal?: AbortSignal;
    onProgress?: (state: MigrationState) => void;
  },
): Promise<void> {
  const sourceId = getActiveModelId();
  const targetId = targetManifest.id;

  function emit(stage: MigrationStage, progressPct = 0, error?: string) {
    const s: MigrationState = { stage, progressPct, sourceModelId: sourceId, targetModelId: targetId, error };
    emitMigration(s);
    opts?.onProgress?.(s);
  }

  emit("downloading", 0);
  markDownloadActive(targetId);

  try {
    // ── Stage 1: Download new model ──────────────────────────────────────────
    setStagedModelId(targetId);

    const alreadyStored = await isModelStored(targetManifest).catch(() => false);
    if (!alreadyStored) {
      await downloadAndStoreModel(targetManifest, opts?.signal);
    }

    if (opts?.signal?.aborted) {
      emit("failed", 0, "Migration cancelled.");
      clearStagedModelId();
      return;
    }

    // ── Stage 2: Validate integrity ──────────────────────────────────────────
    emit("validating", 95);

    const integrity = await validateModelIntegrity(targetId);
    if (!integrity.valid) {
      await deleteStoredModel(targetManifest).catch(() => null);
      clearStagedModelId();
      const reason = `Integrity check failed: ${integrity.reason ?? "invalid file"}`;
      appendHistory({ from: sourceId, to: targetId, completedAt: Date.now(), success: false, error: reason });
      emit("failed", 0, reason);
      throw new Error(reason);
    }

    // ── Stage 3: Save rollback checkpoint ────────────────────────────────────
    emit("checkpointing", 97);
    saveCheckpoint({ previousActiveId: sourceId, targetModelId: targetId, savedAt: Date.now() });

    // ── Stage 4: Switch active pointer ───────────────────────────────────────
    emit("switching", 98);
    setActiveModelId(targetId);
    clearStagedModelId();

    // ── Stage 5: Delete old model ─────────────────────────────────────────────
    emit("committing", 99);
    if (sourceId && sourceId !== targetId) {
      const { getEntryById } = await import("./modelRegistry");
      const sourceEntry = getEntryById(sourceId);
      if (sourceEntry) {
        await deleteStoredModel(sourceEntry.manifest).catch(() => null);
      }
    }

    clearCheckpoint();
    appendHistory({ from: sourceId, to: targetId, completedAt: Date.now(), success: true });
    emit("complete", 100);

  } catch (err) {
    markDownloadComplete(targetId);

    // ── Rollback ──────────────────────────────────────────────────────────────
    if (_state?.stage !== "failed") {
      emit("rolling_back");
      const checkpoint = loadCheckpoint();
      if (checkpoint?.previousActiveId) {
        setActiveModelId(checkpoint.previousActiveId);
      } else {
        // No previous model — clear pointer so user can retry fresh
        localStorage.removeItem("ai_active_model_id");
      }
      clearStagedModelId();
      clearCheckpoint();

      const reason = err instanceof Error ? err.message : "Unknown migration error";
      appendHistory({ from: sourceId, to: targetId, completedAt: Date.now(), success: false, error: reason });
      emit("failed", 0, reason);
    }

    throw err;
  } finally {
    markDownloadComplete(targetId);
  }
}

// Attempt rollback recovery on startup if a checkpoint exists from a prior interrupted migration.
// Call during app init — safe to call even if no migration was in progress.
export async function recoverInterruptedMigration(): Promise<void> {
  const checkpoint = loadCheckpoint();
  if (!checkpoint) return;

  // If checkpoint is > 12 hours old, assume it's stale and clear it
  if (Date.now() - checkpoint.savedAt > 12 * 60 * 60 * 1000) {
    clearCheckpoint();
    clearStagedModelId();
    return;
  }

  // Restore previous active model pointer
  if (checkpoint.previousActiveId) {
    setActiveModelId(checkpoint.previousActiveId);
  } else {
    localStorage.removeItem("ai_active_model_id");
  }

  clearCheckpoint();
  clearStagedModelId();

  appendHistory({
    from: checkpoint.targetModelId,
    to: checkpoint.previousActiveId ?? "none",
    completedAt: Date.now(),
    success: false,
    error: "Recovered from interrupted migration",
  });
}
