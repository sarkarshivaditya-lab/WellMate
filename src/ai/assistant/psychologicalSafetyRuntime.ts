// Psychological Safety Runtime — final composite safety gate.
//
// Aggregates three independent safety systems into one verdict:
//   1. wellnessSafetyGovernor  — content + behavioral pattern safety
//   2. memorySafetyGovernor    — memory pathology safety (obsession, trauma replay, etc.)
//   3. assistantConsistencyValidator — behavioral contradiction safety
//
// The runtime provides a SINGLE check point that callers can use:
//   assertPsychologicalSafety(context) — returns true if safe, false if blocked
//
// Safety score: weighted composite 0-100
//   wellnessSafety      40%
//   memorySafety        35%
//   behaviorConsistency 25%
//
// Score < 40 = BLOCK all proactive content.
// Score 40-65 = WARN; allow conversational only.
// Score >= 65 = ALLOW.
//
// This module is stateless per-call — all state lives in the underlying systems.

import { getWellnessSafetyReport, checkInterventionSafety } from "@/ai/wellness/wellnessSafetyGovernor";
import { getSafetyGovernorReport, runSafetyAudit } from "@/ai/cognition/memorySafetyGovernor";
import { getLastConsistencyReport, runConsistencyValidation } from "./assistantConsistencyValidator";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SafetyVerdict = "safe" | "degraded" | "blocked";

export type PsychologicalSafetyContext = {
  contentType?: "proactive" | "conversational" | "post_checkin";
  surface?: string;
  urgency?: "low" | "normal" | "high";
};

export type PsychologicalSafetyStatus = {
  verdict: SafetyVerdict;
  score: number;               // 0-100 weighted composite
  allSafe: boolean;
  wellnessSafetyScore: number;
  memorySafetyScore: number;
  consistencyScore: number;
  activeRisks: string[];
  blockedBy: string | null;
  checkedAt: number;
};

// ── Score computation ─────────────────────────────────────────────────────────

function wellnessSafetyScore(): number {
  const report = getWellnessSafetyReport();
  if (!report.overallSafe) return 20;
  const freq = report.interventionFrequency;
  if (freq > 3) return 30;
  if (freq > 2) return 65;
  if (report.totalBlocksThisSession > 5) return 70;
  return 100;
}

function memorySafetyScore(): number {
  const report = getSafetyGovernorReport();
  if (!report) return 80;  // no report yet = assume safe
  const violations = report.violationHistory?.length ?? 0;
  const critical = report.violationHistory?.filter((v: { severity: string }) => v.severity === "critical").length ?? 0;
  if (critical > 0) return 10;
  if (violations > 2) return 40;
  if (violations > 0) return 65;
  return 100;
}

function behaviorConsistencyScore(): number {
  const report = getLastConsistencyReport();
  if (!report) return 80;
  return report.score;
}

// ── Main API ───────────────────────────────────────────────────────────────────

export function assertPsychologicalSafety(context: PsychologicalSafetyContext = {}): boolean {
  const status = getPsychologicalSafetyStatus();

  if (status.verdict === "blocked") return false;

  // Proactive content has stricter requirements
  if (context.contentType === "proactive" && status.verdict === "degraded") return false;

  // Check wellness safety governor for specific content types
  if (context.contentType) {
    const safetyCheck = checkInterventionSafety({
      contentType: context.contentType === "post_checkin" ? "post_checkin" : "insight",
      urgency: context.urgency ?? "normal",
    });
    if (safetyCheck.verdict === "block") return false;
  }

  return true;
}

export function getPsychologicalSafetyStatus(): PsychologicalSafetyStatus {
  const wScore = wellnessSafetyScore();
  const mScore = memorySafetyScore();
  const cScore = behaviorConsistencyScore();

  const composite = Math.round(wScore * 0.4 + mScore * 0.35 + cScore * 0.25);

  const activeRisks: string[] = [];
  let blockedBy: string | null = null;

  const wellnessReport = getWellnessSafetyReport();
  const memReport = getSafetyGovernorReport();
  const consReport = getLastConsistencyReport();

  for (const v of wellnessReport.activeViolations) activeRisks.push(`wellness:${v}`);
  for (const v of (memReport?.violationHistory ?? [])) {
    activeRisks.push(`memory:${v.kind}`);
  }
  for (const v of (consReport?.criticalViolations ?? [])) {
    activeRisks.push(`behavior:${v.type}`);
  }

  if (!wellnessReport.overallSafe) blockedBy = "wellness_safety_governor";
  else if ((memReport?.violationHistory ?? []).some((v: { severity: string }) => v.severity === "critical")) blockedBy = "memory_safety_governor";
  else if ((consReport?.criticalViolations ?? []).length > 0 && composite < 40) blockedBy = "consistency_validator";

  const verdict: SafetyVerdict =
    blockedBy !== null || composite < 40 ? "blocked" :
    composite < 65 ? "degraded" : "safe";

  return {
    verdict,
    score: composite,
    allSafe: verdict === "safe",
    wellnessSafetyScore: wScore,
    memorySafetyScore: mScore,
    consistencyScore: cScore,
    activeRisks,
    blockedBy,
    checkedAt: Date.now(),
  };
}

export function runFullSafetyAudit(): PsychologicalSafetyStatus {
  // Refresh all underlying systems before computing
  try { runSafetyAudit(true); } catch { /* ok */ }
  try { runConsistencyValidation(); } catch { /* ok */ }
  return getPsychologicalSafetyStatus();
}

export function getPsychologicalSafetyScore(): number {
  return getPsychologicalSafetyStatus().score;
}
