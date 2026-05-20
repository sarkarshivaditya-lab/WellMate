// Contextual Behavior Engine — adapts assistant behavior per UI surface.
//
// Different surfaces warrant different assistant postures:
//
//   overview       — big-picture check-in, trajectory-aware, gentle
//   sleep          — clinical-adjacent; doesn't pep-talk about sleep debt
//   exercise       — energy and recovery aware; no toxic productivity
//   nutrition      — non-judgmental; never moralize food choices
//   habits         — consistency over perfection; resilience framing
//   journal        — reflective, non-directive, emotionally present
//   mental         — highest safety standards; psychological safety mandatory
//   ai_chat        — full personalization; no surface constraints
//
// Each surface returns a SurfaceBehaviorProfile that the orchestrator injects
// as additional system-prompt guidance.

import { getAssistantState } from "./assistantStateModel";
import { getCoachingStyleAsPromptHint } from "@/ai/coaching/adaptiveCoachingEngine";
import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AssistantSurface =
  | "overview"
  | "sleep"
  | "exercise"
  | "nutrition"
  | "habits"
  | "journal"
  | "mental"
  | "ai_chat";

export type SurfaceBehaviorProfile = {
  surface: AssistantSurface;
  systemHint: string;              // injected into system prompt
  proactiveAllowed: boolean;       // can the assistant initiate proactive content?
  safetyLevel: "standard" | "elevated" | "maximum";
  maxResponseTokens: number;
  allowGoalReinforcement: boolean;
  allowChallengeFraming: boolean;
  toneOverride: string | null;     // null = use coaching engine default
};

// ── Surface profiles ───────────────────────────────────────────────────────────

function buildOverviewProfile(): SurfaceBehaviorProfile {
  const state = getAssistantState();
  const trajectory = getWellnessTrajectory();
  const compositeDir = trajectory?.compositeDirection ?? "unknown";

  const toneOverride =
    state.burnoutSensitivity > 0.6 ? "Be gentle and supportive. Acknowledge the user's effort without adding pressure." :
    compositeDir === "improving" ? "Acknowledge positive momentum lightly; don't over-praise." :
    compositeDir === "declining" ? "Be honest but compassionate about trends. Never alarm." :
    null;

  return {
    surface: "overview",
    systemHint: `You are on the Overview surface. Provide a holistic but brief wellness perspective. ${toneOverride ?? ""}`.trim(),
    proactiveAllowed: !state.interventionCooldown,
    safetyLevel: "standard",
    maxResponseTokens: 200,
    allowGoalReinforcement: state.motivationalState !== "low",
    allowChallengeFraming: state.burnoutSensitivity < 0.4,
    toneOverride,
  };
}

function buildSleepProfile(): SurfaceBehaviorProfile {
  return {
    surface: "sleep",
    systemHint: "You are on the Sleep surface. Be informational and calm. Never moralize about sleep duration or make the user feel guilty. Focus on patterns and what might support better rest. Avoid medical advice.",
    proactiveAllowed: true,
    safetyLevel: "standard",
    maxResponseTokens: 180,
    allowGoalReinforcement: false,
    allowChallengeFraming: false,
    toneOverride: "calm and informational",
  };
}

function buildExerciseProfile(): SurfaceBehaviorProfile {
  const state = getAssistantState();
  const trajectory = getWellnessTrajectory();
  const burnoutDomain = trajectory?.domains.find((d) => d.domain === "burnout");
  const highBurnout = (burnoutDomain?.currentScore ?? 0) > 60;

  return {
    surface: "exercise",
    systemHint: `You are on the Exercise surface. Prioritize recovery awareness. ${highBurnout ? "The user may be experiencing elevated burnout — avoid intensity language and celebrate rest." : "Acknowledge effort without toxic productivity framing."}`,
    proactiveAllowed: !state.interventionCooldown,
    safetyLevel: "standard",
    maxResponseTokens: 200,
    allowGoalReinforcement: !highBurnout,
    allowChallengeFraming: !highBurnout && state.burnoutSensitivity < 0.35,
    toneOverride: highBurnout ? "warm and recovery-focused" : null,
  };
}

function buildNutritionProfile(): SurfaceBehaviorProfile {
  return {
    surface: "nutrition",
    systemHint: "You are on the Nutrition surface. Be non-judgmental about all food choices. Use observational language only. Never describe foods as 'bad', 'unhealthy', or 'guilty'. Focus on patterns and energy, not moral evaluations. Avoid diet culture language.",
    proactiveAllowed: false,
    safetyLevel: "elevated",
    maxResponseTokens: 180,
    allowGoalReinforcement: false,
    allowChallengeFraming: false,
    toneOverride: "warm and non-judgmental",
  };
}

function buildHabitsProfile(): SurfaceBehaviorProfile {
  const state = getAssistantState();
  return {
    surface: "habits",
    systemHint: "You are on the Habits surface. Celebrate consistency over perfection. A missed day is normal, not a failure. Focus on resuming, not on streaks. Never shame gaps.",
    proactiveAllowed: !state.interventionCooldown,
    safetyLevel: "standard",
    maxResponseTokens: 180,
    allowGoalReinforcement: state.motivationalState !== "low",
    allowChallengeFraming: false,
    toneOverride: "resilience-focused",
  };
}

function buildJournalProfile(): SurfaceBehaviorProfile {
  return {
    surface: "journal",
    systemHint: "You are on the Journal surface. Be reflective and non-directive. Do not interpret or reframe the user's feelings without their invitation. Ask one open question maximum. Be emotionally present without projecting.",
    proactiveAllowed: false,
    safetyLevel: "elevated",
    maxResponseTokens: 150,
    allowGoalReinforcement: false,
    allowChallengeFraming: false,
    toneOverride: "reflective and quiet",
  };
}

function buildMentalProfile(): SurfaceBehaviorProfile {
  return {
    surface: "mental",
    systemHint: "You are on the Mental Health surface. Maximum psychological safety applies. Never give clinical advice. Always validate before anything else. If the user expresses distress, acknowledge it fully before any informational response. Do not offer silver linings or quick fixes. Refer to professional support when appropriate.",
    proactiveAllowed: false,
    safetyLevel: "maximum",
    maxResponseTokens: 200,
    allowGoalReinforcement: false,
    allowChallengeFraming: false,
    toneOverride: "warm, validating, non-clinical",
  };
}

function buildAIChatProfile(): SurfaceBehaviorProfile {
  const state = getAssistantState();
  const coachingHint = getCoachingStyleAsPromptHint();
  return {
    surface: "ai_chat",
    systemHint: `You are in the AI Chat surface. Full personalization applies. ${coachingHint}`,
    proactiveAllowed: !state.interventionCooldown,
    safetyLevel: "standard",
    maxResponseTokens: 300,
    allowGoalReinforcement: state.motivationalState !== "low",
    allowChallengeFraming: state.burnoutSensitivity < 0.4,
    toneOverride: null,
  };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function getSurfaceBehaviorProfile(surface: AssistantSurface): SurfaceBehaviorProfile {
  switch (surface) {
    case "overview":   return buildOverviewProfile();
    case "sleep":      return buildSleepProfile();
    case "exercise":   return buildExerciseProfile();
    case "nutrition":  return buildNutritionProfile();
    case "habits":     return buildHabitsProfile();
    case "journal":    return buildJournalProfile();
    case "mental":     return buildMentalProfile();
    case "ai_chat":    return buildAIChatProfile();
  }
}

export function getSurfaceSystemPromptAddition(surface: AssistantSurface): string {
  const profile = getSurfaceBehaviorProfile(surface);
  const parts: string[] = [profile.systemHint];

  if (!profile.allowChallengeFraming) {
    parts.push("Do not use challenge or accountability framing.");
  }
  if (!profile.allowGoalReinforcement) {
    parts.push("Do not reference goals or targets.");
  }
  if (profile.toneOverride) {
    parts.push(`Tone: ${profile.toneOverride}.`);
  }

  return parts.join(" ");
}

export function isSurfaceProactiveAllowed(surface: AssistantSurface): boolean {
  return getSurfaceBehaviorProfile(surface).proactiveAllowed;
}
