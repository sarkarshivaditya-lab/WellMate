// Model update service — evaluates whether the device should install, upgrade,
// or stay with the current model. Considers: device compatibility, rollout %,
// release channel, deprecation state, and server-side kill switches.
//
// This is the single decision point for "should an update happen?"
// The migration engine handles HOW the update happens.

import type { ModelManifest, DeviceTier } from "@/ai/providers/local/modelMetadata";
import {
  getAllManifests,
  getEntryById,
  compareVersions,
  getRecommendedEntry,
} from "./modelRegistry";
import {
  getPlatformConfig,
  isEligibleForRollout,
  getReleaseChannel,
} from "./remoteManifest";
import { isModelStored } from "@/ai/providers/local/modelLoader";
import { getDeviceProfile, isModelCompatible } from "@/ai/platform/deviceProfile";

export type UpdateDecision =
  | "no_update"         // current model is installed, healthy, up to date
  | "update_available"  // a newer optional version exists
  | "update_required"   // installed model is deprecated — must upgrade
  | "install_available" // no model installed; one compatible model exists
  | "incompatible"      // no compatible model for this device
  | "emergency_disabled"// server kill switch is active
  | "rollout_paused"    // server paused all rollouts
  | "not_in_rollout";   // device seed not yet eligible for this update

export type UpdateEvaluation = {
  decision: UpdateDecision;
  installedManifest: ModelManifest | null; // currently stored model (if any)
  targetManifest: ModelManifest | null;    // model to install/upgrade to (if any)
  reason: string;
};

export async function evaluateModelUpdate(): Promise<UpdateEvaluation> {
  const platform = getPlatformConfig();

  // Server emergency kill switch — show no install UI
  if (platform?.emergencyDisable) {
    return {
      decision: "emergency_disabled",
      installedManifest: null,
      targetManifest: null,
      reason: platform.emergencyReason ?? "AI offline support temporarily unavailable.",
    };
  }

  const deviceProfile = await getDeviceProfile();
  const channel = getReleaseChannel();
  const recommended = getRecommendedEntry();

  // Find currently installed model (any registered model on disk)
  const installedManifest = await findInstalledManifest();
  const installedEntry = installedManifest
    ? getEntryById(installedManifest.id)
    : null;

  // Candidates: non-deprecated, device-compatible, channel-eligible, rollout-eligible
  const candidates = getAllManifests().filter((m) => {
    if (m.deprecated) return false;
    if (m.minRamMB && !isModelCompatible(deviceProfile, m.minRamMB)) return false;
    if (m.targetDeviceTiers && !m.targetDeviceTiers.includes(deviceProfile.tier)) return false;
    if (m.releaseChannel && channelRank(m.releaseChannel) > channelRank(channel)) return false;
    return true;
  });

  if (!candidates.length) {
    return {
      decision: "incompatible",
      installedManifest,
      targetManifest: null,
      reason: "No compatible model for this device.",
    };
  }

  // Best candidate: highest version among eligibles
  const target = candidates
    .filter((m) => isEligibleForRollout(m.rolloutPct ?? 100))
    .sort((a, b) => {
      const ea = getEntryById(a.id);
      const eb = getEntryById(b.id);
      if (!ea || !eb) return 0;
      return compareVersions(eb.version, ea.version);
    })[0] ?? null;

  // No model installed
  if (!installedManifest) {
    if (!target) {
      return {
        decision: "not_in_rollout",
        installedManifest: null,
        targetManifest: recommended.manifest,
        reason: "Device not yet eligible for this release.",
      };
    }

    if (platform?.rolloutPaused) {
      return {
        decision: "rollout_paused",
        installedManifest: null,
        targetManifest: target,
        reason: platform.rolloutPausedReason ?? "Updates are temporarily paused.",
      };
    }

    return {
      decision: "install_available",
      installedManifest: null,
      targetManifest: target,
      reason: "Offline support available to download.",
    };
  }

  // Installed model is deprecated → must upgrade
  if (installedManifest.deprecated) {
    return {
      decision: "update_required",
      installedManifest,
      targetManifest: target,
      reason: "Your offline model has been retired. An update is required.",
    };
  }

  // Compare installed vs best target
  if (!target || !installedEntry) {
    return {
      decision: "no_update",
      installedManifest,
      targetManifest: null,
      reason: "Model is current.",
    };
  }

  const targetEntry = getEntryById(target.id);
  if (!targetEntry) {
    return {
      decision: "no_update",
      installedManifest,
      targetManifest: null,
      reason: "Model is current.",
    };
  }

  const diff = compareVersions(targetEntry.version, installedEntry.version);

  if (diff <= 0) {
    return {
      decision: "no_update",
      installedManifest,
      targetManifest: null,
      reason: "Model is current.",
    };
  }

  if (platform?.rolloutPaused) {
    return {
      decision: "rollout_paused",
      installedManifest,
      targetManifest: target,
      reason: platform.rolloutPausedReason ?? "Updates are temporarily paused.",
    };
  }

  return {
    decision: "update_available",
    installedManifest,
    targetManifest: target,
    reason: "A newer version is available.",
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function findInstalledManifest(): Promise<ModelManifest | null> {
  const { getAllRegisteredIds, getEntryById: byId } = await import("./modelRegistry");
  const ids = getAllRegisteredIds();

  for (const id of ids) {
    const entry = byId(id);
    if (!entry) continue;
    const stored = await isModelStored(entry.manifest).catch(() => false);
    if (stored) return entry.manifest;
  }

  return null;
}

type ReleaseChannelRank = 0 | 1 | 2 | 3;

function channelRank(ch: string): ReleaseChannelRank {
  switch (ch) {
    case "stable": return 0;
    case "beta": return 1;
    case "experimental": return 2;
    case "internal": return 3;
    default: return 0;
  }
}

// Convenience: map UpdateDecision to a device-tier-aware recommended manifest
// when no model is installed yet.
export async function getInstallTarget(): Promise<ModelManifest | null> {
  const evaluation = await evaluateModelUpdate();
  return evaluation.targetManifest;
}
