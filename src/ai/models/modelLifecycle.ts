// Model lifecycle manager — checks what is stored, whether it is healthy,
// and what the update evaluation says, then emits a single InstallState.
//
// State machine:
//   checking
//     → installed          healthy, current model, no update needed
//     → install_available  no model stored; one compatible model exists
//     → update_available   newer optional version exists
//     → update_required    installed model is deprecated — must upgrade
//     → corrupted          stored file failed integrity check
//     → incompatible       no compatible model for this device
//     → emergency_disabled server kill switch active
//     → none               no model, no install target (should not normally occur)
//
// This module is the card's primary state source — it integrates the update
// service and migration engine into a single coherent signal.

import type { ModelManifest } from "@/ai/providers/local/modelMetadata";
import { isModelStored, validateModelIntegrity } from "@/ai/providers/local/modelLoader";
import { getRecommendedManifest } from "./modelRegistry";
import { evaluateModelUpdate, type UpdateDecision } from "./modelUpdateService";

export type InstallState =
  | "checking"
  | "installed"
  | "install_available"
  | "update_available"
  | "update_required"
  | "corrupted"
  | "incompatible"
  | "emergency_disabled"
  | "none";                // no model, no compatible target

type LifecycleListener = (state: InstallState) => void;

const _listeners = new Set<LifecycleListener>();
let _currentState: InstallState = "checking";

function emit(state: InstallState): void {
  _currentState = state;
  _listeners.forEach((fn) => {
    try { fn(state); } catch { /* never crash */ }
  });
}

export function subscribeToLifecycle(fn: LifecycleListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getLifecycleState(): InstallState {
  return _currentState;
}

// Map update decision to install state.
// Handles the installed-but-corrupted check separately since update service
// doesn't inspect integrity (too expensive to run on every evaluation).
const DECISION_MAP: Record<UpdateDecision, InstallState> = {
  no_update: "installed",
  update_available: "update_available",
  update_required: "update_required",
  install_available: "install_available",
  incompatible: "incompatible",
  emergency_disabled: "emergency_disabled",
  rollout_paused: "install_available", // treat pause as "available but pending"
  not_in_rollout: "install_available", // same: show card, explain rollout timing
};

// Primary state check — run on card mount and after any install/delete/upgrade.
export async function checkLifecycleState(): Promise<InstallState> {
  // Fast path: check if recommended model is installed and healthy
  let recommended: ModelManifest;
  try {
    recommended = getRecommendedManifest();
  } catch {
    emit("none");
    return "none";
  }

  const stored = await isModelStored(recommended).catch(() => false);

  if (stored) {
    // Verify integrity before declaring installed
    const integrity = await validateModelIntegrity(recommended.id).catch(() => ({ valid: false }));
    if (!integrity.valid) {
      emit("corrupted");
      return "corrupted";
    }
    // Healthy — still check if an upgrade is available
    const evaluation = await evaluateModelUpdate();
    const state = DECISION_MAP[evaluation.decision] ?? "installed";
    emit(state);
    return state;
  }

  // Not stored — delegate entirely to update service
  const evaluation = await evaluateModelUpdate();
  const state = DECISION_MAP[evaluation.decision] ?? "none";
  emit(state);
  return state;
}

// Convenience: returns the manifest for the current update target (if any).
export async function getUpdateTarget(): Promise<ModelManifest | null> {
  const evaluation = await evaluateModelUpdate();
  return evaluation.targetManifest;
}

// Convenience for corrupted state recovery.
export async function deleteCorruptedModel(): Promise<void> {
  const { deleteStoredModel } = await import("@/ai/providers/local/modelLoader");
  const recommended = getRecommendedManifest();
  await deleteStoredModel(recommended).catch(() => null);
  emit("install_available");
}

// Convenience alias kept for callers that used the Phase 8 API.
// @deprecated Use checkLifecycleState() + subscribeToLifecycle()
export async function performModelUpgrade(signal?: AbortSignal): Promise<void> {
  const target = await getUpdateTarget();
  if (!target) throw new Error("No upgrade target available");
  const { performMigration } = await import("./migrationEngine");
  await performMigration(target, { signal });
}
