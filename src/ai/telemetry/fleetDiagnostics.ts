// Fleet diagnostics — device capability fingerprints, runtime environment,
// cohort assignment, health scoring, and benchmark classification.
//
// Designed for future fleet-level visibility: when many devices run WellMate,
// these fingerprints allow grouping by capability class, tracking P50/P90
// performance across cohorts, and identifying device clusters with issues.
//
// All data is local — no upload path implemented. The schemas are cloud-ready.

import { getCapabilitiesSync, type RuntimeCapabilities } from "../platform/capabilityClassifier";
import { getThreadingCapability, type ThreadingCapability } from "../runtime/threadingCapability";
import { getBuildFingerprint } from "../platform/deploymentDiagnostics";

const FINGERPRINT_KEY = "ai_device_fingerprint_v1";
const COHORT_KEY = "ai_deployment_cohort_v1";
const HEALTH_HISTORY_KEY = "ai_health_history_v1";
const MAX_HEALTH_HISTORY = 30;

export type CapabilityTier = "tier_1" | "tier_2" | "tier_3" | "tier_4";
// tier_1: flagship (≥8GB RAM, multi-thread eligible)
// tier_2: mid-high (4-8GB, single thread but capable)
// tier_3: mid-range (2-4GB, limited context)
// tier_4: constrained (<2GB or degraded threading)

export type DeviceFingerprint = {
  fingerprintId: string;
  generatedAt: number;
  platform: string;
  userAgent: string;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  capabilityTier: CapabilityTier;
  threadingMode: string;
  browserCompatibility: string;
};

export type RuntimeEnvironmentFingerprint = {
  buildMode: string;
  buildVersion: string | null;
  commitHash: string | null;
  opfsAvailable: boolean;
  sabAvailable: boolean;
  crossOriginIsolated: boolean;
  workerAvailable: boolean;
  webCryptoAvailable: boolean;
  capturedAt: number;
};

export type DeploymentCohort = {
  cohortId: string;
  capabilityTier: CapabilityTier;
  releaseChannel: string;
  assignedAt: number;
};

export type RuntimeHealthSnapshot = {
  score: number; // 0-100
  capabilityTier: CapabilityTier;
  threadingMode: string;
  opfsHealthy: boolean;
  capturedAt: number;
};

export type FleetDiagnosticsReport = {
  deviceFingerprint: DeviceFingerprint;
  runtimeEnvironment: RuntimeEnvironmentFingerprint;
  cohort: DeploymentCohort;
  currentHealthScore: number;
  healthHistory: RuntimeHealthSnapshot[];
};

// ── Capability tier derivation ─────────────────────────────────────────────────

function deriveCapabilityTier(
  cap: RuntimeCapabilities | null,
  threading: ThreadingCapability,
): CapabilityTier {
  const memGb = cap?.estimatedRamGb ?? 0;
  const multiThread = threading.mode === "multi_thread_eligible";

  if (memGb >= 8 && multiThread) return "tier_1";
  if (memGb >= 4) return "tier_2";
  if (memGb >= 2) return "tier_3";
  return "tier_4";
}

// ── Fingerprint generation ─────────────────────────────────────────────────────

function generateFingerprintId(): string {
  // Deterministic-ish fingerprint from stable device properties
  const parts = [
    typeof navigator !== "undefined" ? navigator.userAgent : "",
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "",
    typeof navigator !== "undefined" ? String(navigator.hardwareConcurrency ?? 0) : "",
  ];
  const combined = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return `fp-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

export function getDeviceFingerprint(): DeviceFingerprint {
  try {
    const cached = localStorage.getItem(FINGERPRINT_KEY);
    if (cached) return JSON.parse(cached) as DeviceFingerprint;
  } catch { /* */ }

  const cap = getCapabilitiesSync();
  const threading = getThreadingCapability();
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const scr = typeof screen !== "undefined" ? screen : null;

  const tier = deriveCapabilityTier(cap, threading);
  const fp: DeviceFingerprint = {
    fingerprintId: generateFingerprintId(),
    generatedAt: Date.now(),
    platform: nav?.platform ?? "unknown",
    userAgent: (nav?.userAgent ?? "unknown").slice(0, 200),
    hardwareConcurrency: nav?.hardwareConcurrency ?? 0,
    deviceMemoryGb: cap?.estimatedRamGb ?? null,
    screenWidth: scr?.width ?? 0,
    screenHeight: scr?.height ?? 0,
    pixelRatio: typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1,
    capabilityTier: tier,
    threadingMode: threading.mode,
    browserCompatibility: threading.browserCompatibility,
  };

  try { localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(fp)); } catch { /* */ }
  return fp;
}

export function getRuntimeEnvironmentFingerprint(): RuntimeEnvironmentFingerprint {
  const build = getBuildFingerprint();
  const threading = getThreadingCapability();
  return {
    buildMode: build.mode,
    buildVersion: build.version,
    commitHash: build.commitHash,
    opfsAvailable: "storage" in (typeof navigator !== "undefined" ? navigator : {}),
    sabAvailable: threading.sharedArrayBufferAvailable,
    crossOriginIsolated: threading.crossOriginIsolated,
    workerAvailable: typeof Worker !== "undefined",
    webCryptoAvailable: typeof crypto?.subtle !== "undefined",
    capturedAt: Date.now(),
  };
}

// ── Cohort assignment ──────────────────────────────────────────────────────────

export function getDeploymentCohort(releaseChannel = "stable"): DeploymentCohort {
  try {
    const cached = localStorage.getItem(COHORT_KEY);
    if (cached) return JSON.parse(cached) as DeploymentCohort;
  } catch { /* */ }

  const fp = getDeviceFingerprint();
  const cohort: DeploymentCohort = {
    cohortId: `cohort-${fp.capabilityTier}-${fp.fingerprintId.slice(3, 7)}`,
    capabilityTier: fp.capabilityTier,
    releaseChannel,
    assignedAt: Date.now(),
  };
  try { localStorage.setItem(COHORT_KEY, JSON.stringify(cohort)); } catch { /* */ }
  return cohort;
}

// ── Health scoring ─────────────────────────────────────────────────────────────

export function computeRuntimeHealthScore(): RuntimeHealthSnapshot {
  const fp = getDeviceFingerprint();
  const threading = getThreadingCapability();

  let score = 100;
  if (fp.capabilityTier === "tier_4") score -= 30;
  else if (fp.capabilityTier === "tier_3") score -= 15;
  if (threading.mode === "degraded") score -= 20;
  if (threading.mode === "single_thread") score -= 5;

  const opfsHealthy = "storage" in (typeof navigator !== "undefined" ? navigator : {});
  if (!opfsHealthy) score -= 25;

  const snapshot: RuntimeHealthSnapshot = {
    score: Math.max(0, score),
    capabilityTier: fp.capabilityTier,
    threadingMode: threading.mode,
    opfsHealthy,
    capturedAt: Date.now(),
  };

  try {
    const history: RuntimeHealthSnapshot[] = JSON.parse(localStorage.getItem(HEALTH_HISTORY_KEY) ?? "[]");
    history.push(snapshot);
    localStorage.setItem(HEALTH_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HEALTH_HISTORY)));
  } catch { /* */ }

  return snapshot;
}

export function getHealthHistory(): RuntimeHealthSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(HEALTH_HISTORY_KEY) ?? "[]") as RuntimeHealthSnapshot[];
  } catch { return []; }
}

// ── Full report ────────────────────────────────────────────────────────────────

export async function getFleetDiagnosticsReport(): Promise<FleetDiagnosticsReport> {
  const [deviceFingerprint, runtimeEnvironment, cohort, health] = await Promise.all([
    Promise.resolve(getDeviceFingerprint()),
    Promise.resolve(getRuntimeEnvironmentFingerprint()),
    Promise.resolve(getDeploymentCohort()),
    Promise.resolve(computeRuntimeHealthScore()),
  ]);

  return {
    deviceFingerprint,
    runtimeEnvironment,
    cohort,
    currentHealthScore: health.score,
    healthHistory: getHealthHistory(),
  };
}
