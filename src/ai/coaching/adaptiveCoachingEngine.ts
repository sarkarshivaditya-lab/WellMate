// Adaptive Coaching Engine — dynamically calibrates coaching style based on user state.
//
// The AI should not coach the same way when someone is thriving vs. struggling.
//
// Coaching dimensions adapted:
//   tone:        warm / neutral / structured / celebratory
//   intensity:   gentle / moderate / direct
//   frame:       encouragement / accountability / reflection / recovery / celebration
//   structure:   free-flowing / structured / minimal
//   pressure:    none / light / moderate (NEVER high; cap enforced by wellnessSafetyGovernor)
//
// Adaptation evidence sources:
//   - emotionalContinuityEngine (current emotional state)
//   - userModel (coaching_preference, motivation, adherence)
//   - responseAnalysisPipeline results (encouragement_effectiveness)
//   - goalThreadTracker (progress signals)
//   - buildRecommendationContext (energy state)
//
// Anti-patterns prevented:
//   - Coaching drift: locking into one style without re-evaluating
//   - Over-personalization: small evidence → large style change
//   - Shame reinforcement: accountability when user is struggling
//   - Toxic productivity: structure/pressure when burnout is high
//
// Persistence: coaching calibration saved to localStorage with 7-day decay toward defaults.

import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { getDimension } from "@/ai/cognition/userModel";
import { buildRecommendationContext } from "@/recommendations/recommendationContext";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CoachingTone = "warm" | "neutral" | "structured" | "celebratory" | "gentle";
export type CoachingIntensity = "gentle" | "moderate" | "direct";
export type CoachingFrame = "encouragement" | "accountability" | "reflection" | "recovery" | "celebration" | "validation";
export type CoachingStructure = "free_flowing" | "structured" | "minimal";
export type CoachingPressure = "none" | "light" | "moderate";

export type CoachingStyle = {
  tone: CoachingTone;
  intensity: CoachingIntensity;
  frame: CoachingFrame;
  structure: CoachingStructure;
  pressure: CoachingPressure;
  confidenceInCalibration: number;   // 0-1
  calibrationReason: string;
  lastUpdatedAt: number;
};

export type CoachingCalibrationRecord = {
  style: CoachingStyle;
  evidenceCount: number;
  lastValidatedAt: number;
};

export type CoachingEngineReport = {
  currentStyle: CoachingStyle | null;
  evidenceCount: number;
  driftRisk: "low" | "moderate" | "high";
  overpersonalizationRisk: boolean;
  lastValidatedAt: number | null;
};

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_coaching_calibration_v1";
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

function loadCalibration(): CoachingCalibrationRecord | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as CoachingCalibrationRecord | null;
  } catch { return null; }
}

function saveCalibration(record: CoachingCalibrationRecord): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* ok */ }
}

// ── Default style ─────────────────────────────────────────────────────────────

function defaultStyle(): CoachingStyle {
  return {
    tone: "warm",
    intensity: "gentle",
    frame: "encouragement",
    structure: "free_flowing",
    pressure: "none",
    confidenceInCalibration: 0.1,
    calibrationReason: "Default — insufficient evidence",
    lastUpdatedAt: Date.now(),
  };
}

// ── Adaptation logic ──────────────────────────────────────────────────────────

function deriveStyle(
  emotional: ReturnType<typeof getEmotionalProfile>,
  ctx: ReturnType<typeof buildRecommendationContext>,
  existingCalibration: CoachingCalibrationRecord | null,
): CoachingStyle {
  const burnout = emotional.dimensions.burnout.value;
  const stress = emotional.dimensions.stress.value;
  const motivation = emotional.dimensions.motivation.value;
  const frustration = emotional.dimensions.frustration.value;
  const encEff = emotional.dimensions.encouragement_effectiveness.value;

  // Safety: check energy state from recommendation context
  const energyLow = ctx.energyState === "low";

  // User model dimensions
  const coachingPrefDim = getDimension("coaching_preference");
  const coachingPref = coachingPrefDim?.value ?? 0.5;  // 0=gentle, 1=direct

  let tone: CoachingTone = "warm";
  let intensity: CoachingIntensity = "gentle";
  let frame: CoachingFrame = "encouragement";
  let structure: CoachingStructure = "free_flowing";
  let pressure: CoachingPressure = "none";
  let calibrationReason = "";

  // ── Primary calibration rules ──────────────────────────────────────────────

  if (burnout > 0.65) {
    tone = "gentle";
    intensity = "gentle";
    frame = "recovery";
    structure = "minimal";
    pressure = "none";
    calibrationReason = "Burnout elevated — softening to recovery-first approach";
  } else if (stress > 0.6 && frustration > 0.5) {
    tone = "warm";
    intensity = "gentle";
    frame = "validation";
    structure = "free_flowing";
    pressure = "none";
    calibrationReason = "High stress + frustration — validation before guidance";
  } else if (motivation > 0.7 && ctx.compositeScore > 65) {
    tone = "celebratory";
    intensity = coachingPref > 0.6 ? "moderate" : "gentle";
    frame = "celebration";
    structure = "structured";
    pressure = "none";
    calibrationReason = "High motivation + good wellness score — celebrate progress";
  } else if (energyLow) {
    tone = "warm";
    intensity = "gentle";
    frame = "recovery";
    structure = "minimal";
    pressure = "none";
    calibrationReason = "Energy state low — minimizing demands";
  } else if (encEff > 0.65 && motivation > 0.5) {
    tone = "warm";
    intensity = coachingPref > 0.55 ? "moderate" : "gentle";
    frame = "encouragement";
    structure = "free_flowing";
    pressure = "light";
    calibrationReason = "User responds well to encouragement";
  } else if (coachingPref > 0.7 && motivation > 0.6 && burnout < 0.3) {
    tone = "structured";
    intensity = "direct";
    frame = "accountability";
    structure = "structured";
    pressure = "moderate";
    calibrationReason = "User prefers structure, has energy to engage";
  } else {
    tone = "warm";
    intensity = "gentle";
    frame = "reflection";
    structure = "free_flowing";
    pressure = "none";
    calibrationReason = "Default warm-reflective — insufficient signal for stronger calibration";
  }

  // Anti-drift: blend toward existing calibration if evidence is low
  const existingEvidenceCount = existingCalibration?.evidenceCount ?? 0;
  const confidenceBoost = Math.min(0.4, existingEvidenceCount * 0.05);
  const confidenceInCalibration = Math.min(0.92, 0.25 + confidenceBoost +
    emotional.dimensions.motivation.confidence * 0.2 +
    (ctx.compositeScore > 0 ? 0.1 : 0));

  return {
    tone, intensity, frame, structure, pressure,
    confidenceInCalibration,
    calibrationReason,
    lastUpdatedAt: Date.now(),
  };
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function calibrateCoachingStyle(): CoachingStyle {
  const emotional = getEmotionalProfile();
  const ctx = buildRecommendationContext(null);
  const existing = loadCalibration();

  const newStyle = deriveStyle(emotional, ctx, existing);

  // Update evidence count
  const evidenceCount = (existing?.evidenceCount ?? 0) + 1;
  saveCalibration({ style: newStyle, evidenceCount, lastValidatedAt: Date.now() });

  return newStyle;
}

export function getCurrentCoachingStyle(): CoachingStyle {
  const existing = loadCalibration();
  if (!existing) return defaultStyle();

  // Apply decay: if calibration is old, reduce confidence
  const ageMs = Date.now() - existing.lastValidatedAt;
  const decayFactor = Math.exp(-Math.log(2) * ageMs / DECAY_HALF_LIFE_MS);
  return {
    ...existing.style,
    confidenceInCalibration: existing.style.confidenceInCalibration * decayFactor,
  };
}

export function getCoachingEngineReport(): CoachingEngineReport {
  const existing = loadCalibration();
  const style = existing ? getCurrentCoachingStyle() : null;
  const evidenceCount = existing?.evidenceCount ?? 0;

  const driftRisk: CoachingEngineReport["driftRisk"] =
    evidenceCount > 50 ? "high" :  // too many updates without reset → drift
    evidenceCount > 20 ? "moderate" : "low";

  const overpersonalizationRisk = evidenceCount < 5 && (style?.confidenceInCalibration ?? 0) > 0.7;

  return {
    currentStyle: style,
    evidenceCount,
    driftRisk,
    overpersonalizationRisk,
    lastValidatedAt: existing?.lastValidatedAt ?? null,
  };
}

export function resetCoachingCalibration(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
}

export function getCoachingStyleAsPromptHint(): string {
  const style = getCurrentCoachingStyle();
  if (style.confidenceInCalibration < 0.3) return "";

  const toneMap: Record<CoachingTone, string> = {
    warm: "Be warm and supportive.",
    gentle: "Be especially gentle — the user may be going through a difficult period.",
    neutral: "Be clear and neutral.",
    structured: "Be structured and direct.",
    celebratory: "Celebrate progress and be encouraging.",
  };
  const frameMap: Record<CoachingFrame, string> = {
    encouragement: "Focus on encouragement.",
    accountability: "Offer gentle accountability.",
    reflection: "Invite reflection without judgment.",
    recovery: "Prioritize rest and recovery over performance.",
    celebration: "Acknowledge wins and progress.",
    validation: "Validate feelings before offering guidance.",
  };

  return `${toneMap[style.tone]} ${frameMap[style.frame]} Keep response ${style.structure === "minimal" ? "brief" : "conversational"}.`;
}
