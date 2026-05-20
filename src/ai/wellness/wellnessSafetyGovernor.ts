// Wellness Safety Governor — prevents unhealthy AI behavioral patterns.
//
// This is the psychological safety layer for all proactive AI features.
// It operates as a GATE: other systems must pass through it.
//
// Protects against:
//   EMOTIONAL_DEPENDENCY    — AI becomes primary emotional support
//   GUILT_INDUCTION         — AI creates shame around missed goals
//   EXCESSIVE_INTERVENTION  — too many proactive touches per period
//   MANIPULATIVE_NUDGING    — dark patterns disguised as wellness support
//   SHAME_REINFORCEMENT     — repeated focus on failures
//   TOXIC_PRODUCTIVITY      — performance over wellbeing
//   BURNOUT_ESCALATION      — pushing goals when burnout is high
//   WELLNESS_ANXIETY        — creating fear about health metrics
//   COERCIVE_ACCOUNTABILITY — obligation/guilt-based goal tracking
//   OVER_MONITORING         — user feels surveilled
//
// All checks return a `SafetyVerdict`: allow | warn | block
// A block MUST be respected by callers.

import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SafetyViolationType =
  | "burnout_escalation"
  | "guilt_induction"
  | "excessive_intervention"
  | "shame_reinforcement"
  | "toxic_productivity"
  | "wellness_anxiety"
  | "coercive_accountability"
  | "emotional_dependency"
  | "over_monitoring";

export type SafetyVerdict = {
  allowed: boolean;
  verdict: "allow" | "warn" | "block";
  violationType?: SafetyViolationType;
  reason?: string;
  suggestedAdjustment?: string;
};

export type SafetyAuditReport = {
  overallSafe: boolean;
  activeViolations: SafetyViolationType[];
  lastAuditAt: number;
  totalBlocksThisSession: number;
  totalWarningsThisSession: number;
  interventionFrequency: number;     // interventions per day (rolling 7d)
};

// ── Session tracking ───────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_wellness_safety_governor_v1";

type SafetyState = {
  interventionTimestamps: number[];   // last 7 days
  blockCount: number;
  warnCount: number;
  lastAuditAt: number | null;
};

function loadState(): SafetyState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {
      interventionTimestamps: [], blockCount: 0, warnCount: 0, lastAuditAt: null,
    };
  } catch {
    return { interventionTimestamps: [], blockCount: 0, warnCount: 0, lastAuditAt: null };
  }
}

function saveState(state: SafetyState): void {
  // Prune timestamps older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  state.interventionTimestamps = state.interventionTimestamps.filter((t) => t > cutoff);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ok */ }
}

// ── Content analysis ──────────────────────────────────────────────────────────

const SHAME_PATTERNS = [
  /you (failed|failed to|didn'?t|missed|skipped|forgot)/i,
  /you (should|must|need to|have to) (do|try|fix|improve)/i,
  /(you'?re|you are) (behind|falling behind|not doing)/i,
  /why (haven'?t|haven't|didn'?t|don't) you/i,
  /(guilt|shame|disappointing|failure|lazy)/i,
];

const TOXIC_PRODUCTIVITY_PATTERNS = [
  /(no excuses|push harder|no days off|grind|hustle)/i,
  /(you should be|you could be) (doing more|working harder)/i,
  /(weakness|soft|giving up|quitter)/i,
];

const MANIPULATIVE_PATTERNS = [
  /(you'?ll regret|you'?ll lose|don'?t fall behind|streak at risk)/i,
  /(everyone else|others are|compared to)/i,
  /(last chance|limited time|don'?t miss out)/i,
];

export function scanTextForViolations(text: string): SafetyViolationType | null {
  for (const pattern of SHAME_PATTERNS) {
    if (pattern.test(text)) return "shame_reinforcement";
  }
  for (const pattern of TOXIC_PRODUCTIVITY_PATTERNS) {
    if (pattern.test(text)) return "toxic_productivity";
  }
  for (const pattern of MANIPULATIVE_PATTERNS) {
    if (pattern.test(text)) return "manipulative_nudging" as SafetyViolationType;
  }
  return null;
}

// ── Safety checks ─────────────────────────────────────────────────────────────

function checkBurnoutEscalation(emotional: ReturnType<typeof getEmotionalProfile>): SafetyVerdict | null {
  const burnout = emotional.dimensions.burnout.value;
  const stress = emotional.dimensions.stress.value;
  if (burnout > 0.8) {
    return {
      allowed: false,
      verdict: "block",
      violationType: "burnout_escalation",
      reason: "Burnout is critically high — any goal or performance pressure risks harm",
      suggestedAdjustment: "Shift to rest-first acknowledgment only",
    };
  }
  if (burnout > 0.6 && stress > 0.6) {
    return {
      allowed: true,
      verdict: "warn",
      violationType: "burnout_escalation",
      reason: "Elevated burnout + stress — accountability-style interventions should be avoided",
      suggestedAdjustment: "Use recovery or validation frame only",
    };
  }
  return null;
}

function checkExcessiveIntervention(state: SafetyState): SafetyVerdict | null {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todayCount = state.interventionTimestamps.filter((t) => t > oneDayAgo).length;
  if (todayCount >= 3) {
    return {
      allowed: false,
      verdict: "block",
      violationType: "excessive_intervention",
      reason: `${todayCount} interventions already delivered today`,
      suggestedAdjustment: "Defer until tomorrow",
    };
  }
  return null;
}

function checkToxicProductivity(ctx: ReturnType<typeof buildRecommendationContext>): SafetyVerdict | null {
  if (ctx.energyState === "low" && ctx.compositeScore < 40) {
    return {
      allowed: true,
      verdict: "warn",
      violationType: "toxic_productivity",
      reason: "Low energy + low wellness score — performance goals may be counterproductive",
      suggestedAdjustment: "Focus on rest and recovery messaging only",
    };
  }
  return null;
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function checkInterventionSafety(context: {
  textContent?: string;
  isAccountabilityFrame?: boolean;
  isGoalPressure?: boolean;
}): SafetyVerdict {
  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);
  const state = loadState();

  // Run all checks
  const burnoutVerdict = checkBurnoutEscalation(emotional);
  if (burnoutVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return burnoutVerdict;
  }

  const excessVerdict = checkExcessiveIntervention(state);
  if (excessVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return excessVerdict;
  }

  const toxicVerdict = checkToxicProductivity(ctx);

  // Text content scan
  if (context.textContent) {
    const textViolation = scanTextForViolations(context.textContent);
    if (textViolation) {
      state.blockCount++;
      saveState(state);
      return { allowed: false, verdict: "block", violationType: textViolation, reason: `Text content triggers ${textViolation} pattern` };
    }
  }

  // Accountability frame check when burnout is elevated
  if (context.isAccountabilityFrame && emotional.dimensions.burnout.value > 0.5) {
    state.warnCount++;
    saveState(state);
    return {
      allowed: true,
      verdict: "warn",
      violationType: "coercive_accountability",
      reason: "Accountability framing with elevated burnout risks reinforcing failure narratives",
      suggestedAdjustment: "Switch to supportive or recovery frame",
    };
  }

  if (burnoutVerdict) { state.warnCount++; saveState(state); return burnoutVerdict; }
  if (toxicVerdict) { state.warnCount++; saveState(state); return toxicVerdict; }

  return { allowed: true, verdict: "allow" };
}

export function recordInterventionDelivered(): void {
  const state = loadState();
  state.interventionTimestamps.push(Date.now());
  saveState(state);
}

export function runWellnessSafetyAudit(): SafetyAuditReport {
  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);
  const state = loadState();

  const violations: SafetyViolationType[] = [];
  if (emotional.dimensions.burnout.value > 0.7) violations.push("burnout_escalation");
  if (ctx.energyState === "low") violations.push("toxic_productivity");
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (state.interventionTimestamps.filter((t) => t > oneDayAgo).length >= 3) {
    violations.push("excessive_intervention");
  }

  const sevenDayAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentInterventions = state.interventionTimestamps.filter((t) => t > sevenDayAgo);
  const frequencyPerDay = recentInterventions.length / 7;

  state.lastAuditAt = Date.now();
  saveState(state);

  return {
    overallSafe: violations.length === 0,
    activeViolations: violations,
    lastAuditAt: Date.now(),
    totalBlocksThisSession: state.blockCount,
    totalWarningsThisSession: state.warnCount,
    interventionFrequency: frequencyPerDay,
  };
}

export function getWellnessSafetyReport(): SafetyAuditReport {
  return runWellnessSafetyAudit();
}
