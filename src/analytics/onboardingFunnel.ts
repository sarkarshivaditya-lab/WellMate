// src/analytics/onboardingFunnel.ts

import { getAggregates, patchAggregates } from "./aggregateStore";

export type OnboardingPhase = "not_started" | "in_progress" | "completed";

export type OnboardingState = {
  phase: OnboardingPhase;
  hasDraft: boolean;
  firstSeenDate: string | null;
  completionDate: string | null;
};

export function getOnboardingState(): OnboardingState {
  const agg = getAggregates();
  const isComplete = localStorage.getItem("onboarded") === "true";
  const hasDraft = localStorage.getItem("onboarding_draft") !== null;

  const phase: OnboardingPhase = isComplete
    ? "completed"
    : hasDraft
      ? "in_progress"
      : "not_started";

  return {
    phase,
    hasDraft,
    firstSeenDate: agg.onboardingFirstSeenDate,
    completionDate: agg.onboardingCompletionDate,
  };
}

export function recordOnboardingFirstSeen(): void {
  const agg = getAggregates();
  if (agg.onboardingFirstSeenDate) return;
  patchAggregates({ onboardingFirstSeenDate: new Date().toISOString().slice(0, 10) });
}

export function recordOnboardingCompletion(): void {
  patchAggregates({
    onboardingCompleted: true,
    onboardingCompletionDate: new Date().toISOString().slice(0, 10),
  });
}
