// Memory Safety Governor — prevents pathological cognition behavior.
//
// Guards against:
//   1. Memory bloat — tiers approaching capacity, unchecked growth
//   2. Recursive reflection loops — reflections referencing reflections
//   3. Stale context dominance — old memories crowding out fresh signals
//   4. Emotional overfitting — EMA locked into extreme valence
//   5. Identity lock-in — user model dimensions frozen at extremes with false confidence
//   6. Contradiction accumulation — too many contradictory signals un-resolved
//
// When a violation is detected:
//   - Emit safety_violation event
//   - Apply targeted remediation (eviction, reset, decay)
//   - Log for observability
//   - Never silently allow continued degraded state

import { getMemoryHierarchyReport, evictStaleMem, compressTier } from "../memory/memoryHierarchy";
import {
  getCognitiveStateReport,
  getEmotionalState,
  getUnresolvedTopics,
  resetCognitiveState,
} from "./cognitiveStateEngine";
import { getContradictoryDimensions, applyUserModelDecay, resetUserModel } from "./userModel";
import { getActiveReflections } from "./reflectionEngine";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SafetyViolationKind =
  | "memory_bloat"
  | "reflection_loop"
  | "stale_dominance"
  | "emotional_overfitting"
  | "identity_lock_in"
  | "contradiction_accumulation";

export type SafetyViolation = {
  kind: SafetyViolationKind;
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
  remediationApplied: string;
  detectedAt: number;
};

export type SafetyAuditResult = {
  passed: boolean;
  violations: SafetyViolation[];
  remediationsApplied: number;
  auditedAt: number;
  durationMs: number;
};

export type SafetyGovernorReport = {
  lastAuditAt: number | null;
  lastAuditPassed: boolean | null;
  violationHistory: SafetyViolation[];
  totalViolations: number;
  totalRemediations: number;
};

// ── State ──────────────────────────────────────────────────────────────────────

const SAFETY_LOG_KEY = "ai_safety_violations_v1";
const MAX_VIOLATIONS_LOGGED = 50;
const AUDIT_COOLDOWN_MS = 10 * 60 * 1000; // audit at most every 10 minutes

let _lastAuditAt: number | null = null;
let _lastAuditPassed: boolean | null = null;
let _totalViolations = 0;
let _totalRemediations = 0;

// ── Persistence ────────────────────────────────────────────────────────────────

function loadViolationLog(): SafetyViolation[] {
  try { return JSON.parse(localStorage.getItem(SAFETY_LOG_KEY) ?? "[]") as SafetyViolation[]; }
  catch { return []; }
}

function appendViolation(v: SafetyViolation): void {
  try {
    const log = loadViolationLog();
    log.push(v);
    if (log.length > MAX_VIOLATIONS_LOGGED) log.shift();
    localStorage.setItem(SAFETY_LOG_KEY, JSON.stringify(log));
  } catch { /* */ }
}

function recordViolation(v: SafetyViolation): void {
  appendViolation(v);
  _totalViolations++;
  emitCognitionEvent("safety_violation", { kind: v.kind, severity: v.severity });
}

// ── Guard: Memory bloat ────────────────────────────────────────────────────────

function checkMemoryBloat(): SafetyViolation | null {
  const report = getMemoryHierarchyReport();
  const overloadedTiers = report.tiers.filter((t) => t.fillPct >= 85);
  if (overloadedTiers.length === 0) return null;

  const critical = overloadedTiers.some((t) => t.fillPct >= 95);

  // Remediate: evict stale + compress overloaded tiers
  evictStaleMem();
  for (const t of overloadedTiers) {
    if (t.tier !== 1) compressTier(t.tier);
  }
  _totalRemediations++;

  return {
    kind: "memory_bloat",
    severity: critical ? "high" : "moderate",
    description: `Tiers at high fill: ${overloadedTiers.map((t) => `T${t.tier}(${t.fillPct}%)`).join(", ")}`,
    remediationApplied: "evict_stale + compress",
    detectedAt: Date.now(),
  };
}

// ── Guard: Reflection loop ─────────────────────────────────────────────────────

function checkReflectionLoop(): SafetyViolation | null {
  const reflections = getActiveReflections();
  if (reflections.length < 8) return null;

  // If more than 8 active reflections, the engine is cycling without resolution
  return {
    kind: "reflection_loop",
    severity: "moderate",
    description: `${reflections.length} active reflections — may indicate unresolved contradictions driving re-reflection`,
    remediationApplied: "log_only — reflection TTL will self-clear",
    detectedAt: Date.now(),
  };
}

// ── Guard: Stale dominance ─────────────────────────────────────────────────────

function checkStaleDominance(): SafetyViolation | null {
  const report = getMemoryHierarchyReport();
  const now = Date.now();
  const STALE_DOMINANCE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Check if the top salient items are all very old
  const old = report.topSalientItems.filter(() => {
    // We can't directly read age from topSalientItems — use tier as proxy
    // Tier 5 (Reflective) is expected to be old; Tier 3 items older than 30d is concerning
    return false; // placeholder — real check would need age field on topSalientItems
  });

  // Instead check: if semantic tier is >70% full with very old content
  const semantic = report.tiers.find((t) => t.tier === 4);
  if (!semantic || semantic.itemCount === 0) return null;
  if (semantic.oldestItemAgeMs === null) return null;
  if (semantic.oldestItemAgeMs < STALE_DOMINANCE_AGE_MS || semantic.fillPct < 70) return null;

  evictStaleMem();
  _totalRemediations++;

  return {
    kind: "stale_dominance",
    severity: "low",
    description: `Semantic tier ${Math.round(semantic.fillPct)}% full with oldest item ${Math.round(semantic.oldestItemAgeMs / (24 * 3600 * 1000))}d old`,
    remediationApplied: "evict_stale",
    detectedAt: Date.now(),
  };

  void old; // satisfy linter — variable is intentionally unused above
}

// ── Guard: Emotional overfitting ───────────────────────────────────────────────

function checkEmotionalOverfitting(): SafetyViolation | null {
  const emo = getEmotionalState();
  const EXTREME_THRESHOLD = 0.85;

  // Valence stuck at extremes with no shift for a long time
  const isExtreme = Math.abs(emo.valence) > EXTREME_THRESHOLD;
  const isLocked = emo.trend === "stable" && emo.shiftCount < 2;

  if (!isExtreme || !isLocked) return null;

  // Remediation: nudge valence toward neutral (decay toward 0)
  // We can't directly write to emo state — report only and let natural EMA correct it
  return {
    kind: "emotional_overfitting",
    severity: "moderate",
    description: `Emotional valence locked at ${emo.valence.toFixed(2)} (${emo.dominantEmotion}) with ${emo.shiftCount} total shifts`,
    remediationApplied: "log_only — EMA will correct on next signal",
    detectedAt: Date.now(),
  };
}

// ── Guard: Identity lock-in ────────────────────────────────────────────────────

function checkIdentityLockIn(): SafetyViolation | null {
  const contradictory = getContradictoryDimensions();

  // Apply decay to prevent dimensions from staying frozen
  applyUserModelDecay();
  _totalRemediations++;

  if (contradictory.length < 3) return null;

  // If 3+ dimensions are contradictory and confidence is still high, model is unreliable
  const highConfContradictions = contradictory.filter((d) => d.confidence > 0.7 && d.contradictions >= 3);
  if (highConfContradictions.length === 0) return null;

  const dims = highConfContradictions.map((d) => d.dimension).join(", ");

  return {
    kind: "identity_lock_in",
    severity: "high",
    description: `User model dimensions locked with contradictory high-confidence signals: ${dims}`,
    remediationApplied: "stale_decay_applied — consider resetUserModel if persists",
    detectedAt: Date.now(),
  };
}

// ── Guard: Contradiction accumulation ─────────────────────────────────────────

function checkContradictionAccumulation(): SafetyViolation | null {
  const unresolved = getUnresolvedTopics();
  const contradictory = getContradictoryDimensions();

  const score = unresolved.length * 0.5 + contradictory.length * 1.0;
  if (score < 4) return null;

  const severity = score >= 8 ? "high" : "moderate";

  return {
    kind: "contradiction_accumulation",
    severity,
    description: `${unresolved.length} unresolved topics + ${contradictory.length} contradictory model dimensions (score: ${score.toFixed(1)})`,
    remediationApplied: "log_only — requires conversation resolution or manual reset",
    detectedAt: Date.now(),
  };
}

// ── Emergency reset ────────────────────────────────────────────────────────────

export function emergencyCognitionReset(reason: string): void {
  resetCognitiveState();
  evictStaleMem();
  emitCognitionEvent("safety_violation", {
    kind: "emergency_reset",
    reason,
    severity: "critical",
  });
  _totalRemediations++;
}

// ── Main audit ─────────────────────────────────────────────────────────────────

export function runSafetyAudit(force = false): SafetyAuditResult {
  const now = Date.now();

  if (!force && _lastAuditAt && now - _lastAuditAt < AUDIT_COOLDOWN_MS) {
    return {
      passed: _lastAuditPassed ?? true,
      violations: [],
      remediationsApplied: 0,
      auditedAt: now,
      durationMs: 0,
    };
  }

  const startMs = now;
  _lastAuditAt = now;

  const checks = [
    checkMemoryBloat,
    checkReflectionLoop,
    checkStaleDominance,
    checkEmotionalOverfitting,
    checkIdentityLockIn,
    checkContradictionAccumulation,
  ];

  const violations: SafetyViolation[] = [];
  for (const check of checks) {
    try {
      const v = check();
      if (v) {
        violations.push(v);
        recordViolation(v);
      }
    } catch { /* isolate individual check failures */ }
  }

  const passed = violations.filter((v) => v.severity === "high" || v.severity === "critical").length === 0;
  _lastAuditPassed = passed;

  return {
    passed,
    violations,
    remediationsApplied: violations.filter((v) => !v.remediationApplied.startsWith("log_only")).length,
    auditedAt: now,
    durationMs: Date.now() - startMs,
  };
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getSafetyGovernorReport(): SafetyGovernorReport {
  return {
    lastAuditAt: _lastAuditAt,
    lastAuditPassed: _lastAuditPassed,
    violationHistory: loadViolationLog(),
    totalViolations: _totalViolations,
    totalRemediations: _totalRemediations,
  };
}
