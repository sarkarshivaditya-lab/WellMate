// Deployment convergence — feature gates, deployment channels, build compatibility,
// rollout architecture, and runtime patch orchestration.
//
// Feature gates are evaluated locally against device capability + release channel.
// No remote feature flag service is required — the gate logic is deterministic.
// Future: a remote manifest can overlay gate values.
//
// Deployment channels: dev → alpha → beta → stable → enterprise
// Runtime patch versioning: monotonic integer, persisted to localStorage.
// Rollout percentage: 0-100, assigned per device fingerprint for consistency.

import { getDeviceFingerprint, getDeploymentCohort } from "../telemetry/fleetDiagnostics";
import { getThreadingCapability } from "../runtime/threadingCapability";

const FEATURE_GATE_OVERRIDES_KEY = "ai_feature_gates_v1";
const RUNTIME_PATCH_KEY = "ai_runtime_patch_v1";
const COMPATIBILITY_MANIFEST_KEY = "ai_compat_manifest_v1";

export type DeploymentChannel = "dev" | "alpha" | "beta" | "stable" | "enterprise";

export type FeatureGateId =
  | "threaded_inference"    // Requires multi_thread_eligible mode
  | "native_filesystem"     // Requires Capacitor Filesystem plugin
  | "background_execution"  // Requires WorkManager / BGTaskScheduler
  | "secure_model_store"    // Requires WebCrypto + OPFS
  | "fleet_telemetry"       // Cloud telemetry upload (when upload is implemented)
  | "advanced_retrieval"    // >tier_3 capability required
  | "deep_reflection"       // >tier_2 required
  | "resumable_delivery"    // OPFS required
  | "streaming_optimizer"   // Always available
  | "crash_analytics";      // Always available

export type FeatureGateState = {
  gateId: FeatureGateId;
  enabled: boolean;
  reason: string;
  overriddenBy: "manifest" | "capability" | "channel" | "manual" | null;
};

export type RuntimePatch = {
  patchVersion: number;
  appliedAt: number;
  description: string;
  channel: DeploymentChannel;
};

export type CompatibilityManifest = {
  minRuntimeVersion: number;
  requiredCapabilities: string[];
  incompatibleBrowsers: string[];
  generatedAt: number;
  channel: DeploymentChannel;
};

export type RolloutAssignment = {
  deviceId: string;
  rolloutPct: number;
  channel: DeploymentChannel;
  assignedAt: number;
};

// ── Rollout percentage ─────────────────────────────────────────────────────────

function deviceRolloutPct(fingerprintId: string): number {
  // Deterministic 0-100 from fingerprint hash — same device always same bucket
  let hash = 0;
  for (let i = 0; i < fingerprintId.length; i++) {
    hash = (hash * 31 + fingerprintId.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 101;
}

// ── Feature gate evaluation ────────────────────────────────────────────────────

function evaluateGate(
  gateId: FeatureGateId,
  overrides: Record<string, boolean>,
  channel: DeploymentChannel,
): FeatureGateState {
  if (gateId in overrides) {
    return { gateId, enabled: overrides[gateId], reason: "manual override", overriddenBy: "manual" };
  }

  const threading = getThreadingCapability();
  const fp = getDeviceFingerprint();
  const tier = fp.capabilityTier;

  switch (gateId) {
    case "threaded_inference":
      return {
        gateId,
        enabled: threading.mode === "multi_thread_eligible" && channel !== "stable",
        reason: threading.mode === "multi_thread_eligible" ? `mode=multi_thread_eligible channel=${channel}` : `mode=${threading.mode}`,
        overriddenBy: "capability",
      };
    case "native_filesystem":
      return { gateId, enabled: false, reason: "Capacitor plugin not yet installed", overriddenBy: "capability" };
    case "background_execution":
      return { gateId, enabled: false, reason: "WorkManager/BGTaskScheduler not yet bound", overriddenBy: "capability" };
    case "secure_model_store":
      return { gateId, enabled: typeof crypto?.subtle !== "undefined", reason: "WebCrypto availability", overriddenBy: "capability" };
    case "fleet_telemetry":
      return { gateId, enabled: false, reason: "Upload endpoint not configured", overriddenBy: "channel" };
    case "advanced_retrieval":
      return { gateId, enabled: tier !== "tier_4", reason: `capability=${tier}`, overriddenBy: "capability" };
    case "deep_reflection":
      return { gateId, enabled: tier === "tier_1" || tier === "tier_2", reason: `capability=${tier}`, overriddenBy: "capability" };
    case "resumable_delivery":
      return { gateId, enabled: "storage" in (typeof navigator !== "undefined" ? navigator : {}), reason: "OPFS availability", overriddenBy: "capability" };
    case "streaming_optimizer":
      return { gateId, enabled: true, reason: "always enabled", overriddenBy: null };
    case "crash_analytics":
      return { gateId, enabled: true, reason: "always enabled", overriddenBy: null };
    default:
      return { gateId, enabled: false, reason: "unknown gate", overriddenBy: null };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

function loadOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FEATURE_GATE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch { return {}; }
}

export function isFeatureEnabled(gateId: FeatureGateId): boolean {
  const cohort = getDeploymentCohort();
  return evaluateGate(gateId, loadOverrides(), cohort.releaseChannel as DeploymentChannel).enabled;
}

export function getAllFeatureGates(): FeatureGateState[] {
  const cohort = getDeploymentCohort();
  const overrides = loadOverrides();
  const channel = cohort.releaseChannel as DeploymentChannel;
  const gateIds: FeatureGateId[] = [
    "threaded_inference", "native_filesystem", "background_execution", "secure_model_store",
    "fleet_telemetry", "advanced_retrieval", "deep_reflection", "resumable_delivery",
    "streaming_optimizer", "crash_analytics",
  ];
  return gateIds.map((id) => evaluateGate(id, overrides, channel));
}

export function overrideFeatureGate(gateId: FeatureGateId, enabled: boolean): void {
  const overrides = loadOverrides();
  overrides[gateId] = enabled;
  try { localStorage.setItem(FEATURE_GATE_OVERRIDES_KEY, JSON.stringify(overrides)); } catch { /* */ }
}

export function clearFeatureGateOverrides(): void {
  try { localStorage.removeItem(FEATURE_GATE_OVERRIDES_KEY); } catch { /* */ }
}

// ── Runtime patches ────────────────────────────────────────────────────────────

export function getCurrentPatchVersion(): number {
  try {
    const raw = localStorage.getItem(RUNTIME_PATCH_KEY);
    return raw ? (JSON.parse(raw) as { version: number }).version : 0;
  } catch { return 0; }
}

export function applyRuntimePatch(description: string, channel: DeploymentChannel = "stable"): RuntimePatch {
  const version = getCurrentPatchVersion() + 1;
  const patch: RuntimePatch = { patchVersion: version, appliedAt: Date.now(), description, channel };
  try { localStorage.setItem(RUNTIME_PATCH_KEY, JSON.stringify({ version, last: patch })); } catch { /* */ }
  return patch;
}

// ── Rollout assignment ─────────────────────────────────────────────────────────

export function getRolloutAssignment(): RolloutAssignment {
  const fp = getDeviceFingerprint();
  const cohort = getDeploymentCohort();
  return {
    deviceId: fp.fingerprintId,
    rolloutPct: deviceRolloutPct(fp.fingerprintId),
    channel: cohort.releaseChannel as DeploymentChannel,
    assignedAt: cohort.assignedAt,
  };
}

export function isInRollout(rolloutThresholdPct: number): boolean {
  return getRolloutAssignment().rolloutPct <= rolloutThresholdPct;
}

// ── Compatibility manifest ─────────────────────────────────────────────────────

export function getCompatibilityManifest(): CompatibilityManifest | null {
  try {
    const raw = localStorage.getItem(COMPATIBILITY_MANIFEST_KEY);
    return raw ? JSON.parse(raw) as CompatibilityManifest : null;
  } catch { return null; }
}

export function setCompatibilityManifest(manifest: CompatibilityManifest): void {
  try { localStorage.setItem(COMPATIBILITY_MANIFEST_KEY, JSON.stringify(manifest)); } catch { /* */ }
}

export function checkBuildCompatibility(): { compatible: boolean; reason: string | null } {
  const manifest = getCompatibilityManifest();
  if (!manifest) return { compatible: true, reason: null };

  const currentVersion = getCurrentPatchVersion();
  if (currentVersion < manifest.minRuntimeVersion) {
    return { compatible: false, reason: `Runtime v${currentVersion} < required v${manifest.minRuntimeVersion}` };
  }
  return { compatible: true, reason: null };
}
