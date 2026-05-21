// UI Cognition Integration Layer — maps UI surfaces to live cognition state.
//
// Every UI surface can request a cognition signal — a lightweight snapshot
// of what the AI knows about the current domain. This allows UI components
// to render contextually without knowing about the AI layer internals.
//
// Surfaces mapped:
//   overview    — composite wellness + trajectory direction + intervention availability
//   sleep       — sleep domain trajectory + recovery readiness
//   exercise    — activity domain + burnout risk + energy state
//   nutrition   — nutrition domain trend (non-judgmental signal only)
//   habits      — habit consistency + resilience + stall detection
//   journal     — emotional trajectory + open goal threads
//   mental      — psychological safety score + emotional state
//   ai_chat     — full coaching context + all active signals
//
// These signals are UI-read-only. They never write to cognition state.
// Safe to call on every render cycle (all reads, no side effects).

import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { getEmotionalContinuityReport } from "@/ai/cognition/emotionalContinuityEngine";
import { getActiveGoalThreads } from "@/ai/cognition/goalThreadTracker";
import { getAssistantState } from "./assistantStateModel";
import { isSurfaceProactiveAllowed } from "./contextualBehaviorEngine";
import type { AssistantSurface } from "./contextualBehaviorEngine";
import { getPsychologicalSafetyScore } from "./psychologicalSafetyRuntime";
import { getRecoveryOpportunityReport } from "@/ai/wellness/recoveryOpportunityDetector";
import { getDisengagementPrediction } from "@/ai/wellness/disengagementPredictor";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CognitionSignalStrength = "strong" | "moderate" | "weak" | "unavailable";

export type SurfaceCognitionSignal = {
  surface: AssistantSurface;
  primaryInsight: string | null;          // 1 sentence, or null
  signalStrength: CognitionSignalStrength;
  domainTrend: "improving" | "stable" | "declining" | "volatile" | "unknown";
  proactiveAvailable: boolean;
  safetyScore: number;                    // 0-100
  actionableHint: string | null;          // optional coaching micro-hint
  freshAt: number;
};

// ── Signal builders ────────────────────────────────────────────────────────────

function overviewSignal(): SurfaceCognitionSignal {
  const trajectory = getWellnessTrajectory();
  const state = getAssistantState();
  const disengage = getDisengagementPrediction();

  const primaryInsight = trajectory
    ? trajectory.compositeDirection !== "unknown"
      ? `Your overall wellness is ${trajectory.compositeDirection}${trajectory.dominantConcern ? `, with ${trajectory.dominantConcern} as the main focus area` : ""}.`
      : null
    : null;

  const hint = disengage && disengage.riskScore > 0.6
    ? "Engagement is lower than usual — small steps count."
    : state.motivationalState === "low" ? "Momentum takes time to rebuild."
    : null;

  return {
    surface: "overview",
    primaryInsight,
    signalStrength: trajectory ? "strong" : "weak",
    domainTrend: trajectory?.compositeDirection ?? "unknown",
    proactiveAvailable: isSurfaceProactiveAllowed("overview"),
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: hint,
    freshAt: Date.now(),
  };
}

function sleepSignal(): SurfaceCognitionSignal {
  const trajectory = getWellnessTrajectory();
  const recovery = getRecoveryOpportunityReport();
  const sleepDomain = trajectory?.domains.find((d) => d.domain === "sleep");
  const hasRecovery = recovery?.opportunities.some((o) => o.category === "sleep_improvement") ?? false;

  const primaryInsight = sleepDomain
    ? `Sleep is ${sleepDomain.direction} over the past ${sleepDomain.trend4wk.length} weeks.`
    : null;

  return {
    surface: "sleep",
    primaryInsight,
    signalStrength: sleepDomain ? "moderate" : "unavailable",
    domainTrend: (sleepDomain?.direction as SurfaceCognitionSignal["domainTrend"]) ?? "unknown",
    proactiveAvailable: false,
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: hasRecovery ? "Recovery conditions look favorable right now." : null,
    freshAt: Date.now(),
  };
}

function exerciseSignal(): SurfaceCognitionSignal {
  const trajectory = getWellnessTrajectory();
  const recovery = getRecoveryOpportunityReport();
  const activityDomain = trajectory?.domains.find((d) => d.domain === "activity");
  const state = getAssistantState();
  const burnoutHigh = state.burnoutSensitivity > 0.6;

  return {
    surface: "exercise",
    primaryInsight: activityDomain
      ? `Activity trend is ${activityDomain.direction}.${burnoutHigh ? " Rest is recovery." : ""}`
      : null,
    signalStrength: activityDomain ? "moderate" : "unavailable",
    domainTrend: (activityDomain?.direction as SurfaceCognitionSignal["domainTrend"]) ?? "unknown",
    proactiveAvailable: isSurfaceProactiveAllowed("exercise"),
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: recovery?.opportunities.some((o) => o.category === "physical_recovery")
      ? "Your body may be ready for gentle activity."
      : null,
    freshAt: Date.now(),
  };
}

function nutritionSignal(): SurfaceCognitionSignal {
  const trajectory = getWellnessTrajectory();
  const nutDomain = trajectory?.domains.find((d) => d.domain === "nutrition");

  return {
    surface: "nutrition",
    primaryInsight: nutDomain
      ? `Nutrition patterns are ${nutDomain.direction} recently.`
      : null,
    signalStrength: nutDomain ? "weak" : "unavailable",
    domainTrend: (nutDomain?.direction as SurfaceCognitionSignal["domainTrend"]) ?? "unknown",
    proactiveAvailable: false,
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: null,
    freshAt: Date.now(),
  };
}

function habitsSignal(): SurfaceCognitionSignal {
  const trajectory = getWellnessTrajectory();
  const habitDomain = trajectory?.domains.find((d) => d.domain === "habits");
  const recovery = getRecoveryOpportunityReport();
  const hasRestart = recovery?.opportunities.some((o) => o.category === "habit_restart") ?? false;

  return {
    surface: "habits",
    primaryInsight: habitDomain
      ? `Habit consistency is ${habitDomain.direction}.`
      : null,
    signalStrength: habitDomain ? "moderate" : "unavailable",
    domainTrend: (habitDomain?.direction as SurfaceCognitionSignal["domainTrend"]) ?? "unknown",
    proactiveAvailable: isSurfaceProactiveAllowed("habits"),
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: hasRestart ? "This looks like a good moment to rebuild." : null,
    freshAt: Date.now(),
  };
}

function journalSignal(): SurfaceCognitionSignal {
  const emotional = getEmotionalContinuityReport();
  const goals = getActiveGoalThreads().filter((g) => g.status === "active").slice(0, 2);
  const openGoals = goals.map((g) => g.name).join(", ");

  return {
    surface: "journal",
    primaryInsight: emotional.profile.dominantDimension
      ? `Recent entries suggest ${emotional.profile.dominantDimension.replace(/_/g, " ")} is prominent.`
      : null,
    signalStrength: "moderate",
    domainTrend: emotional.profile.dimensions.motivation.trend === "rising" ? "improving" :
                 emotional.profile.dimensions.stress.trend === "rising" ? "declining" : "stable",
    proactiveAvailable: false,
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: openGoals ? `Active areas: ${openGoals}.` : null,
    freshAt: Date.now(),
  };
}

function mentalSignal(): SurfaceCognitionSignal {
  const emotional = getEmotionalContinuityReport();
  const safetyScore = getPsychologicalSafetyScore();
  const burnout = emotional.profile.dimensions.burnout.value;

  return {
    surface: "mental",
    primaryInsight: burnout > 0.65
      ? "Burnout signals are elevated. Rest and reduced demands are appropriate."
      : null,
    signalStrength: safetyScore > 65 ? "moderate" : "weak",
    domainTrend: emotional.profile.dimensions.stress.trend === "falling" ? "improving" :
                 emotional.profile.dimensions.stress.trend === "rising" ? "declining" : "stable",
    proactiveAvailable: false,
    safetyScore,
    actionableHint: null,
    freshAt: Date.now(),
  };
}

function aiChatSignal(): SurfaceCognitionSignal {
  const state = getAssistantState();
  const emotional = getEmotionalContinuityReport();

  return {
    surface: "ai_chat",
    primaryInsight: state.dominantConcern
      ? `Current focus area: ${state.dominantConcern}.`
      : null,
    signalStrength: "strong",
    domainTrend: state.emotionalTrajectory === "rising" ? "improving" :
                 state.emotionalTrajectory === "falling" ? "declining" : "stable",
    proactiveAvailable: isSurfaceProactiveAllowed("ai_chat"),
    safetyScore: getPsychologicalSafetyScore(),
    actionableHint: null,
    freshAt: Date.now(),
  };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function getSurfaceCognitionSignal(surface: AssistantSurface): SurfaceCognitionSignal {
  switch (surface) {
    case "overview":   return overviewSignal();
    case "sleep":      return sleepSignal();
    case "exercise":   return exerciseSignal();
    case "nutrition":  return nutritionSignal();
    case "habits":     return habitsSignal();
    case "journal":    return journalSignal();
    case "mental":     return mentalSignal();
    case "ai_chat":    return aiChatSignal();
  }
}

export function getAllSurfaceSignals(): SurfaceCognitionSignal[] {
  const surfaces: AssistantSurface[] = ["overview", "sleep", "exercise", "nutrition", "habits", "journal", "mental", "ai_chat"];
  return surfaces.map((s) => getSurfaceCognitionSignal(s));
}
