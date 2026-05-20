// COOP/COEP Deployment Verifier — runtime awareness of cross-origin isolation.
//
// SharedArrayBuffer (required for true multi-thread inference) is gated behind:
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp  (or credentialless)
//
// These headers cannot be read from JavaScript — we infer their presence from
// self.crossOriginIsolated (standard) and window.crossOriginIsolated (main thread).
//
// Degradation behavior:
//   isolated=true  → SAB + Atomics fully available → threaded inference eligible
//   isolated=false → SAB attempts throw SecurityError → single-thread postMessage fallback
//
// Local-dev handling: localhost is treated as secure context but not cross-origin
// isolated by default (unless headers are set in vite.config server.headers).

export type IsolationMode =
  | "fully_isolated"    // crossOriginIsolated=true, SAB confirmed available
  | "secure_context"    // isSecureContext=true but not cross-origin isolated
  | "degraded"          // neither — old browser or http://
  | "unknown";

export type SabDeploymentGate =
  | "open"              // SAB available and isolation confirmed
  | "degraded_no_sab"   // SAB allocation fails at runtime
  | "degraded_no_isolation" // headers missing, SAB blocked by browser policy
  | "pending_headers";  // likely production but headers not yet deployed

export type CoopCoepStatus = {
  isolationMode: IsolationMode;
  crossOriginIsolated: boolean;
  isSecureContext: boolean;
  sabDeploymentGate: SabDeploymentGate;
  sabConfirmedAvailable: boolean;
  isLocalDev: boolean;
  deploymentGuidance: string;
  verifiedAt: number;
};

const CACHE_KEY = "ai_coopcoep_status_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Detection helpers ─────────────────────────────────────────────────────────

function detectCrossOriginIsolated(): boolean {
  // self.crossOriginIsolated works in both main thread and workers
  try { return Boolean(self.crossOriginIsolated); } catch { return false; }
}

function detectSecureContext(): boolean {
  try { return Boolean(isSecureContext); } catch { return false; }
}

function detectLocalDev(): boolean {
  try {
    const host = location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch { return false; }
}

function probeSabAvailability(): boolean {
  try {
    new SharedArrayBuffer(4);
    return true;
  } catch {
    return false;
  }
}

function deriveIsolationMode(crossOriginIsolated: boolean, isSecureContext: boolean): IsolationMode {
  if (crossOriginIsolated) return "fully_isolated";
  if (isSecureContext) return "secure_context";
  if (typeof self !== "undefined") return "degraded";
  return "unknown";
}

function deriveSabGate(
  crossOriginIsolated: boolean,
  sabAvailable: boolean,
  isLocalDev: boolean,
): SabDeploymentGate {
  if (crossOriginIsolated && sabAvailable) return "open";
  if (crossOriginIsolated && !sabAvailable) return "degraded_no_sab";
  if (!crossOriginIsolated && !sabAvailable && !isLocalDev) return "pending_headers";
  return "degraded_no_isolation";
}

function buildGuidance(gate: SabDeploymentGate, isLocalDev: boolean): string {
  switch (gate) {
    case "open":
      return "Fully isolated. SAB + threaded inference available.";
    case "degraded_no_sab":
      return "Headers present but SAB allocation failing. Check browser version (Chrome 92+, Safari 15.2+).";
    case "degraded_no_isolation":
      return isLocalDev
        ? "Local dev: add headers to vite.config → server.headers: { COOP: same-origin, COEP: require-corp }."
        : "COOP/COEP headers not detected. Add to server config or CDN edge rules.";
    case "pending_headers":
      return "Production deployment missing COOP/COEP. Inference falls back to single-thread postMessage.";
  }
}

// ── Verification ──────────────────────────────────────────────────────────────

export function verifyCoopCoep(): CoopCoepStatus {
  const crossOriginIsolated = detectCrossOriginIsolated();
  const isSecureContext = detectSecureContext();
  const isLocalDev = detectLocalDev();
  const sabConfirmedAvailable = probeSabAvailability();
  const isolationMode = deriveIsolationMode(crossOriginIsolated, isSecureContext);
  const sabDeploymentGate = deriveSabGate(crossOriginIsolated, sabConfirmedAvailable, isLocalDev);
  const deploymentGuidance = buildGuidance(sabDeploymentGate, isLocalDev);

  const status: CoopCoepStatus = {
    isolationMode, crossOriginIsolated, isSecureContext,
    sabDeploymentGate, sabConfirmedAvailable, isLocalDev,
    deploymentGuidance, verifiedAt: Date.now(),
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(status));
  } catch { /* storage unavailable */ }

  return status;
}

export function getCoopCoepStatus(): CoopCoepStatus {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as CoopCoepStatus;
      if (Date.now() - parsed.verifiedAt < CACHE_TTL_MS) return parsed;
    }
  } catch { /* */ }
  return verifyCoopCoep();
}

export function isIsolationSufficient(): boolean {
  return getCoopCoepStatus().sabDeploymentGate === "open";
}

export function getIsolationReadinessScore(): number {
  const status = getCoopCoepStatus();
  if (status.sabDeploymentGate === "open") return 100;
  if (status.sabDeploymentGate === "degraded_no_sab") return 60;
  if (status.sabDeploymentGate === "pending_headers") return 30;
  return 0; // degraded_no_isolation
}
