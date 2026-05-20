// Deployment diagnostics — compatibility audit, safe mode, build fingerprint.
//
// runCompatibilityAudit() checks all platform capabilities required for full
// AI feature operation and returns per-feature pass/fail results.
//
// Safe mode disables non-essential AI features when critical capabilities are absent
// (OPFS unavailable, Web Crypto missing, RAM too low for model inference).
//
// Build fingerprint is derived from import.meta.env values set by Vite at build time.

const SAFE_MODE_KEY = "ai_safe_mode_v1";

export type CompatibilityLevel = "required" | "recommended" | "optional";

export type CompatibilityCheck = {
  feature: string;
  level: CompatibilityLevel;
  passed: boolean;
  detail: string;
};

export type DeploymentDiagnosticsReport = {
  buildFingerprint: BuildFingerprint;
  compatibilityChecks: CompatibilityCheck[];
  criticalFailures: number;
  recommendedFailures: number;
  safeModeActive: boolean;
  safeModeReason: string | null;
  generatedAt: number;
};

export type BuildFingerprint = {
  mode: string;
  buildTime: string | null;
  version: string | null;
  commitHash: string | null;
};

// ── Build fingerprint ──────────────────────────────────────────────────────────

export function getBuildFingerprint(): BuildFingerprint {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    mode: env["MODE"] ?? "unknown",
    buildTime: env["VITE_BUILD_TIME"] ?? null,
    version: env["VITE_APP_VERSION"] ?? null,
    commitHash: env["VITE_COMMIT_HASH"] ?? null,
  };
}

// ── Compatibility audit ────────────────────────────────────────────────────────

async function checkOpfs(): Promise<CompatibilityCheck> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.getDirectoryHandle("_probe", { create: true });
    await root.removeEntry("_probe");
    return { feature: "OPFS (Origin Private File System)", level: "required", passed: true, detail: "Available and writable" };
  } catch (err) {
    return { feature: "OPFS (Origin Private File System)", level: "required", passed: false, detail: String(err) };
  }
}

async function checkWebCrypto(): Promise<CompatibilityCheck> {
  try {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, false, ["encrypt"]);
    return { feature: "Web Crypto API", level: "required", passed: !!key, detail: "AES-GCM key generation succeeded" };
  } catch (err) {
    return { feature: "Web Crypto API", level: "required", passed: false, detail: String(err) };
  }
}

async function checkWorkers(): Promise<CompatibilityCheck> {
  const passed = typeof Worker !== "undefined";
  return {
    feature: "Web Workers",
    level: "recommended",
    passed,
    detail: passed ? "Worker constructor available" : "Web Workers not supported — compute falls back to main thread",
  };
}

async function checkStorageEstimate(): Promise<CompatibilityCheck> {
  try {
    const est = await navigator.storage.estimate();
    const quota = est.quota ?? 0;
    const passed = quota > 2 * 1024 * 1024 * 1024; // >2 GB
    return {
      feature: "Storage Quota (>2 GB)",
      level: "required",
      passed,
      detail: `Quota: ${Math.round(quota / (1024 ** 3) * 10) / 10} GB`,
    };
  } catch (err) {
    return { feature: "Storage Quota (>2 GB)", level: "required", passed: false, detail: String(err) };
  }
}

async function checkIndexedDb(): Promise<CompatibilityCheck> {
  const passed = typeof indexedDB !== "undefined";
  return {
    feature: "IndexedDB",
    level: "optional",
    passed,
    detail: passed ? "Available" : "Not available",
  };
}

async function checkPersistentStorage(): Promise<CompatibilityCheck> {
  try {
    const persisted = await navigator.storage.persisted();
    return {
      feature: "Persistent Storage",
      level: "recommended",
      passed: persisted,
      detail: persisted ? "Granted" : "Not granted — model files may be evicted by browser",
    };
  } catch {
    return { feature: "Persistent Storage", level: "recommended", passed: false, detail: "API not available" };
  }
}

async function checkRamEstimate(): Promise<CompatibilityCheck> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const gb = nav.deviceMemory ?? null;
  const passed = gb === null || gb >= 4;
  return {
    feature: "Device RAM (≥4 GB)",
    level: "recommended",
    passed,
    detail: gb !== null ? `${gb} GB reported` : "deviceMemory API not available",
  };
}

export async function runCompatibilityAudit(): Promise<CompatibilityCheck[]> {
  const checks = await Promise.all([
    checkOpfs(),
    checkWebCrypto(),
    checkWorkers(),
    checkStorageEstimate(),
    checkIndexedDb(),
    checkPersistentStorage(),
    checkRamEstimate(),
  ]);
  return checks;
}

// ── Safe mode ──────────────────────────────────────────────────────────────────

export function isSafeModeActive(): boolean {
  try {
    const raw = localStorage.getItem(SAFE_MODE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { active: boolean };
    return parsed.active ?? false;
  } catch { return false; }
}

export function getSafeModeReason(): string | null {
  try {
    const raw = localStorage.getItem(SAFE_MODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reason?: string };
    return parsed.reason ?? null;
  } catch { return null; }
}

export function activateSafeMode(reason: string): void {
  try {
    localStorage.setItem(SAFE_MODE_KEY, JSON.stringify({ active: true, reason, activatedAt: Date.now() }));
  } catch { /* */ }
}

export function deactivateSafeMode(): void {
  try { localStorage.removeItem(SAFE_MODE_KEY); } catch { /* */ }
}

// ── Full diagnostics report ────────────────────────────────────────────────────

export async function getDeploymentDiagnostics(): Promise<DeploymentDiagnosticsReport> {
  const [buildFingerprint, compatibilityChecks] = await Promise.all([
    Promise.resolve(getBuildFingerprint()),
    runCompatibilityAudit(),
  ]);

  const criticalFailures = compatibilityChecks.filter((c) => c.level === "required" && !c.passed).length;
  const recommendedFailures = compatibilityChecks.filter((c) => c.level === "recommended" && !c.passed).length;

  return {
    buildFingerprint,
    compatibilityChecks,
    criticalFailures,
    recommendedFailures,
    safeModeActive: isSafeModeActive(),
    safeModeReason: getSafeModeReason(),
    generatedAt: Date.now(),
  };
}
