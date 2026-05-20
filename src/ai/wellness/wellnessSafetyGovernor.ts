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

const MIN_INTERVENTION_COOLDOWN_MS = 90 * 60 * 1000;  // 90 minutes between any two deliveries
const DAILY_INTERVENTION_CAP = 2;                       // max per calendar day (previously 3)
const ESCALATION_BURNOUT_DELTA = 0.15;                  // block if burnout rose by this much after last delivery
const DEPENDENCY_WINDOW_DAYS = 7;
const DEPENDENCY_THRESHOLD_DAYS = 5;                    // 5+ days with delivery in 7 days = dependency risk
const RECOVERY_MODE_BURNOUT_THRESHOLD = 0.60;           // recovery mode above this burnout level

type SafetyState = {
  interventionTimestamps: number[];   // last 7 days
  blockCount: number;
  warnCount: number;
  lastAuditAt: number | null;
  lastInterventionAt: number | null;           // for minimum cooldown
  burnoutAtLastIntervention: number | null;    // for escalation guard
};

function loadState(): SafetyState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {
      interventionTimestamps: [], blockCount: 0, warnCount: 0, lastAuditAt: null,
      lastInterventionAt: null, burnoutAtLastIntervention: null,
    };
  } catch {
    return {
      interventionTimestamps: [], blockCount: 0, warnCount: 0, lastAuditAt: null,
      lastInterventionAt: null, burnoutAtLastIntervention: null,
    };
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

function checkMinimumCooldown(state: SafetyState): SafetyVerdict | null {
  if (!state.lastInterventionAt) return null;
  const elapsed = Date.now() - state.lastInterventionAt;
  if (elapsed < MIN_INTERVENTION_COOLDOWN_MS) {
    const remainingMin = Math.ceil((MIN_INTERVENTION_COOLDOWN_MS - elapsed) / 60000);
    return {
      allowed: false,
      verdict: "block",
      violationType: "excessive_intervention",
      reason: `90-minute delivery cooldown active — ${remainingMin}m remaining`,
      suggestedAdjustment: "Wait for cooldown before next proactive delivery",
    };
  }
  return null;
}

function checkExcessiveIntervention(state: SafetyState): SafetyVerdict | null {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const todayCount = state.interventionTimestamps.filter((t) => t > dayStart.getTime()).length;
  if (todayCount >= DAILY_INTERVENTION_CAP) {
    return {
      allowed: false,
      verdict: "block",
      violationType: "excessive_intervention",
      reason: `Daily delivery cap reached (${todayCount}/${DAILY_INTERVENTION_CAP})`,
      suggestedAdjustment: "Defer all proactive content until tomorrow",
    };
  }
  return null;
}

function checkEmotionalEscalation(
  emotional: ReturnType<typeof getEmotionalProfile>,
  state: SafetyState,
): SafetyVerdict | null {
  if (state.burnoutAtLastIntervention === null) return null;
  const currentBurnout = emotional.dimensions.burnout.value;
  if (currentBurnout > state.burnoutAtLastIntervention + ESCALATION_BURNOUT_DELTA) {
    return {
      allowed: false,
      verdict: "block",
      violationType: "burnout_escalation",
      reason: "Burnout increased since last intervention — proactive delivery may be counterproductive",
      suggestedAdjustment: "Suppress all proactive content until burnout stabilizes below last-delivery level",
    };
  }
  return null;
}

function checkDependencyRisk(state: SafetyState): SafetyVerdict | null {
  const windowStart = Date.now() - DEPENDENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentTimestamps = state.interventionTimestamps.filter((t) => t > windowStart);
  const uniqueDays = new Set(recentTimestamps.map((t) => new Date(t).toDateString())).size;
  if (uniqueDays >= DEPENDENCY_THRESHOLD_DAYS) {
    return {
      allowed: true,
      verdict: "warn",
      violationType: "emotional_dependency",
      reason: `AI delivered interventions on ${uniqueDays}/${DEPENDENCY_WINDOW_DAYS} days — watch for dependency patterns`,
      suggestedAdjustment: "Consider spacing deliveries more; avoid AI becoming primary emotional support",
    };
  }
  return null;
}

function checkRecoveryModeEnforcement(
  emotional: ReturnType<typeof getEmotionalProfile>,
  context: { isGoalPressure?: boolean },
): SafetyVerdict | null {
  const burnout = emotional.dimensions.burnout.value;
  if (burnout > RECOVERY_MODE_BURNOUT_THRESHOLD && context.isGoalPressure) {
    return {
      allowed: false,
      verdict: "block",
      violationType: "burnout_escalation",
      reason: "Recovery mode active — goal or performance pressure is blocked above burnout threshold",
      suggestedAdjustment: "Use acknowledgment or rest-first framing only",
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
  contentType?: string;   // caller-supplied label ("insight", "post_checkin", "conversational")
  urgency?: string;       // caller-supplied urgency hint
}): SafetyVerdict {
  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);
  const state = loadState();

  // 1. Minimum cooldown between deliveries
  const cooldownVerdict = checkMinimumCooldown(state);
  if (cooldownVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return cooldownVerdict;
  }

  // 2. Daily cap
  const excessVerdict = checkExcessiveIntervention(state);
  if (excessVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return excessVerdict;
  }

  // 3. Burnout escalation (hardest block)
  const burnoutVerdict = checkBurnoutEscalation(emotional);
  if (burnoutVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return burnoutVerdict;
  }

  // 4. Escalation guard — did burnout worsen after last intervention?
  const escalationVerdict = checkEmotionalEscalation(emotional, state);
  if (escalationVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return escalationVerdict;
  }

  // 5. Recovery mode enforcement — block goal pressure when in burnout zone
  const recoveryVerdict = checkRecoveryModeEnforcement(emotional, context);
  if (recoveryVerdict?.verdict === "block") {
    state.blockCount++;
    saveState(state);
    return recoveryVerdict;
  }

  const toxicVerdict = checkToxicProductivity(ctx);

  // 6. Text content scan
  if (context.textContent) {
    const textViolation = scanTextForViolations(context.textContent);
    if (textViolation) {
      state.blockCount++;
      saveState(state);
      return { allowed: false, verdict: "block", violationType: textViolation, reason: `Text content triggers ${textViolation} pattern` };
    }
  }

  // 7. Accountability frame with elevated burnout
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

  // 8. Dependency risk warning (non-blocking)
  const dependencyVerdict = checkDependencyRisk(state);
  if (dependencyVerdict) { state.warnCount++; saveState(state); return dependencyVerdict; }

  if (burnoutVerdict) { state.warnCount++; saveState(state); return burnoutVerdict; }
  if (toxicVerdict) { state.warnCount++; saveState(state); return toxicVerdict; }

  return { allowed: true, verdict: "allow" };
}

export function recordInterventionDelivered(): void {
  const emotional = getEmotionalProfile();
  const state = loadState();
  const now = Date.now();
  state.interventionTimestamps.push(now);
  state.lastInterventionAt = now;
  state.burnoutAtLastIntervention = emotional.dimensions.burnout.value;
  saveState(state);
}

export function getInterventionCalibrationStatus(): {
  cooldownActiveMs: number;
  deliveriesToday: number;
  deliveriesThisWeek: number;
  uniqueDaysThisWeek: number;
  dependencyRisk: boolean;
  recoveryModeActive: boolean;
  escalationGuardActive: boolean;
} {
  const emotional = getEmotionalProfile();
  const state = loadState();
  const now = Date.now();

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const weekStart = now - DEPENDENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const deliveriesToday = state.interventionTimestamps.filter((t) => t > dayStart.getTime()).length;
  const weekTimestamps = state.interventionTimestamps.filter((t) => t > weekStart);
  const uniqueDaysThisWeek = new Set(weekTimestamps.map((t) => new Date(t).toDateString())).size;
  const cooldownActiveMs = state.lastInterventionAt
    ? Math.max(0, MIN_INTERVENTION_COOLDOWN_MS - (now - state.lastInterventionAt))
    : 0;

  const currentBurnout = emotional.dimensions.burnout.value;
  const escalationGuardActive = state.burnoutAtLastIntervention !== null &&
    currentBurnout > state.burnoutAtLastIntervention + ESCALATION_BURNOUT_DELTA;

  return {
    cooldownActiveMs,
    deliveriesToday,
    deliveriesThisWeek: weekTimestamps.length,
    uniqueDaysThisWeek,
    dependencyRisk: uniqueDaysThisWeek >= DEPENDENCY_THRESHOLD_DAYS,
    recoveryModeActive: currentBurnout > RECOVERY_MODE_BURNOUT_THRESHOLD,
    escalationGuardActive,
  };
}

export function runWellnessSafetyAudit(): SafetyAuditReport {
  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);
  const state = loadState();

  const violations: SafetyViolationType[] = [];
  if (emotional.dimensions.burnout.value > 0.7) violations.push("burnout_escalation");
  if (ctx.energyState === "low") violations.push("toxic_productivity");
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  if (state.interventionTimestamps.filter((t) => t > dayStart.getTime()).length >= DAILY_INTERVENTION_CAP) {
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
