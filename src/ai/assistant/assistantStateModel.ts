// Assistant State Model — persistent assistant-wide behavioral state.
//
// Tracks the assistant's current understanding of the user's situation across
// all surfaces and conversations. This is NOT user profile data — it's the
// assistant's working model of how it should behave RIGHT NOW.
//
// Dimensions:
//   activeCoachingFrame    — which coaching lens is currently active
//   dominantConcern        — the wellness domain most salient this session
//   emotionalTrajectory    — recent emotional direction (short-term EMA)
//   burnoutSensitivity     — how carefully to avoid pressure language
//   interventionCooldown   — whether the assistant is in a quiet period
//   motivationalState      — user's current motivational tone
//   engagementState        — how actively the user is engaging
//   longitudinalFocusAreas — domains that have persisted as concerns over weeks
//
// Updated after every inference and after every proactive cognition loop run.
// Persisted in localStorage — survives app restart.

import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";
import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { getCurrentCoachingStyle } from "@/ai/coaching/adaptiveCoachingEngine";
import type { WellnessDomain } from "@/ai/wellness/wellnessTrajectoryEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CoachingFrame =
  | "encouragement"
  | "accountability"
  | "reflection"
  | "recovery"
  | "celebration"
  | "validation"
  | "neutral";

export type MotivationalState =
  | "high"
  | "moderate"
  | "low"
  | "rebuilding"
  | "unknown";

export type EngagementState =
  | "active"
  | "passive"
  | "drifting"
  | "returning"
  | "unknown";

export type AssistantState = {
  activeCoachingFrame: CoachingFrame;
  dominantConcern: WellnessDomain | null;
  emotionalTrajectory: "rising" | "stable" | "falling" | "unknown";
  burnoutSensitivity: number;          // 0-1; high = extra careful
  interventionCooldown: boolean;       // true = don't proactively intervene
  motivationalState: MotivationalState;
  engagementState: EngagementState;
  longitudinalFocusAreas: WellnessDomain[];
  lastUpdatedAt: number;
  sessionStartedAt: number;
};

export type AssistantStateReport = {
  state: AssistantState;
  staleness: "fresh" | "recent" | "stale";
  coachingHint: string;
};

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_assistant_state_v1";
const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const RECENT_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const DEFAULT_STATE: AssistantState = {
  activeCoachingFrame: "neutral",
  dominantConcern: null,
  emotionalTrajectory: "unknown",
  burnoutSensitivity: 0.3,
  interventionCooldown: false,
  motivationalState: "unknown",
  engagementState: "unknown",
  longitudinalFocusAreas: [],
  lastUpdatedAt: 0,
  sessionStartedAt: Date.now(),
};

let _state: AssistantState = DEFAULT_STATE;
let _initialized = false;

function load(): void {
  if (_initialized) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AssistantState;
      _state = { ...DEFAULT_STATE, ...parsed, sessionStartedAt: Date.now() };
    }
  } catch { /* ok */ }
  _initialized = true;
}

function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch { /* ok */ }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export function syncAssistantState(): void {
  load();

  const emotional = getEmotionalProfile();
  const trajectory = getWellnessTrajectory();
  const coaching = getCurrentCoachingStyle();

  // Emotional trajectory direction
  const motivDim = emotional.dimensions.motivation;
  const burnoutDim = emotional.dimensions.burnout;
  const stressDim = emotional.dimensions.stress;

  const emotionalTrajectory: AssistantState["emotionalTrajectory"] =
    motivDim.trend === "rising" && stressDim.trend === "falling" ? "rising" :
    burnoutDim.trend === "rising" || stressDim.trend === "rising" ? "falling" :
    "stable";

  // Burnout sensitivity
  const burnoutSensitivity = Math.min(1, burnoutDim.value * 1.4 + stressDim.value * 0.6);

  // Motivational state
  const motivVal = motivDim.value;
  const motivationalState: MotivationalState =
    motivVal > 0.7 ? "high" :
    motivVal > 0.45 ? "moderate" :
    motivDim.trend === "rising" ? "rebuilding" :
    "low";

  // Dominant concern from trajectory
  const dominantConcern = trajectory?.dominantConcern ?? _state.dominantConcern;

  // Longitudinal focus areas (union of trajectory negative signals with memory)
  const newNegativeSignals: WellnessDomain[] = trajectory?.negativeSignals ?? [];
  const existingFocusAreas = _state.longitudinalFocusAreas;
  const focusAreas = Array.from(new Set([...existingFocusAreas, ...newNegativeSignals])).slice(0, 5);

  // Coaching frame from adaptive engine
  const activeCoachingFrame: CoachingFrame = coaching
    ? (coaching.frame as CoachingFrame)
    : "neutral";

  // Intervention cooldown: if burnout sensitivity > 0.75, always in cooldown
  const interventionCooldown = burnoutSensitivity > 0.75;

  _state = {
    ..._state,
    activeCoachingFrame,
    dominantConcern: dominantConcern ?? null,
    emotionalTrajectory,
    burnoutSensitivity,
    interventionCooldown,
    motivationalState,
    longitudinalFocusAreas: focusAreas,
    lastUpdatedAt: Date.now(),
  };

  save();
}

export function setEngagementState(state: EngagementState): void {
  load();
  _state = { ..._state, engagementState: state, lastUpdatedAt: Date.now() };
  save();
}

export function markInterventionDelivered(): void {
  load();
  _state = { ..._state, interventionCooldown: true, lastUpdatedAt: Date.now() };
  save();
  // Auto-release cooldown after 4h
  setTimeout(() => {
    _state = { ..._state, interventionCooldown: false };
    save();
  }, 4 * 60 * 60 * 1000);
}

// ── Read ───────────────────────────────────────────────────────────────────────

export function getAssistantState(): AssistantState {
  load();
  return _state;
}

export function getAssistantStateReport(): AssistantStateReport {
  load();

  const ageMs = Date.now() - _state.lastUpdatedAt;
  const staleness: AssistantStateReport["staleness"] =
    ageMs < RECENT_THRESHOLD_MS ? "fresh" :
    ageMs < STALE_THRESHOLD_MS ? "recent" : "stale";

  const coaching = getCurrentCoachingStyle();
  const coachingHint = coaching
    ? `Frame: ${_state.activeCoachingFrame}. Tone: ${coaching.tone}. Intensity: ${coaching.intensity}.`
    : `Frame: ${_state.activeCoachingFrame}.`;

  return { state: _state, staleness, coachingHint };
}

export function resetAssistantState(): void {
  _state = { ...DEFAULT_STATE, sessionStartedAt: Date.now() };
  save();
}
