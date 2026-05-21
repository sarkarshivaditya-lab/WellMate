// Unified Assistant Orchestrator — THE SINGLE ENTRYPOINT for all AI execution.
//
// All assistant surfaces (DailyReflectionCard, JournalReflectionCard, WellMateLauncher,
// contextual nudges) MUST route through assistantRequest().
//
// What this adds on top of cognitiveExecutionOrchestrator.executeWithCognition():
//   1. Sync assistant state (trajectory, coaching frame, burnout sensitivity)
//   2. Apply surface-specific behavioral profile
//   3. Gate through wellness safety governor
//   4. Inject coaching style hint into system prompt
//   5. Inject trajectory context (dominant concern, positive signals)
//   6. Inject recovery opportunities if present and relevant
//   7. Inject proactive insights (if permitted for this surface)
//   8. Execute via cognitiveExecutionOrchestrator
//   9. Update assistant state post-execution
//   10. Run consistency validation after execution
//
// No direct inference bypasses. No surface should call executeWithCognition directly.

import { executeWithCognition } from "@/ai/cognition/cognitiveExecutionOrchestrator";
import type { CognitiveInferenceResult } from "@/ai/cognition/cognitiveExecutionOrchestrator";
import { syncAssistantState, getAssistantState, setEngagementState } from "./assistantStateModel";
import { getSurfaceBehaviorProfile, getSurfaceSystemPromptAddition } from "./contextualBehaviorEngine";
import type { AssistantSurface } from "./contextualBehaviorEngine";
import { getCoachingStyleAsPromptHint } from "@/ai/coaching/adaptiveCoachingEngine";
import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { detectRecoveryOpportunities } from "@/ai/wellness/recoveryOpportunityDetector";
import { checkInterventionSafety } from "@/ai/wellness/wellnessSafetyGovernor";
import { synthesizeProactiveInsights } from "@/ai/wellness/proactiveInsightSynthesizer";
import { runConsistencyValidation, getConsistencyScore } from "./assistantConsistencyValidator";
import { emitCognitionEvent } from "@/ai/cognition/cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AssistantRequestOptions = {
  surface?: AssistantSurface;
  maxTokens?: number;
  temperature?: number;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  systemContextAddition?: string;   // caller-supplied surface hint (appended, not replacing)
  skipProactiveInjection?: boolean; // disable insight injection for pure conversational turns
};

export type AssistantResponse = {
  requestId: string;
  responseText: string;
  tokensGenerated: number;
  durationMs: number;
  surface: AssistantSurface;
  coachingFrameApplied: string;
  proactiveInsightsInjected: number;
  recoveryOpportunitiesInjected: number;
  safetyVerdict: "allowed" | "warned" | "blocked";
  cancelled: boolean;
};

export type AssistantOrchestratorReport = {
  totalRequests: number;
  blockedBySafety: number;
  lastRequestAt: number | null;
  lastSurface: AssistantSurface | null;
  isExecuting: boolean;
  consistencyScore: number;
};

// ── State ──────────────────────────────────────────────────────────────────────

let _totalRequests = 0;
let _blockedBySafety = 0;
let _lastRequestAt: number | null = null;
let _lastSurface: AssistantSurface | null = null;
let _isExecuting = false;

// ── Prompt enrichment ──────────────────────────────────────────────────────────

function buildEnrichedSystemContext(
  surface: AssistantSurface,
  profile: ReturnType<typeof getSurfaceBehaviorProfile>,
  skipProactive: boolean,
): { systemContext: string; proactiveInjected: number; recoveryInjected: number } {
  const parts: string[] = [];

  // Surface behavior guidance
  const surfaceAddition = getSurfaceSystemPromptAddition(surface);
  if (surfaceAddition) parts.push(surfaceAddition);

  // Coaching style hint
  const coachingHint = getCoachingStyleAsPromptHint();
  if (coachingHint) parts.push(coachingHint);

  // Trajectory context (always inject for awareness — kept brief)
  const trajectory = getWellnessTrajectory();
  if (trajectory) {
    const concern = trajectory.dominantConcern;
    const positive = trajectory.positiveSignals.slice(0, 2).join(", ");
    if (concern) parts.push(`Current dominant concern: ${concern}.`);
    if (positive) parts.push(`Positive signals: ${positive}.`);
    if (trajectory.burnoutProgression > 0.65) {
      parts.push("User is showing elevated burnout progression — keep all framing gentle.");
    }
  }

  let proactiveInjected = 0;
  let recoveryInjected = 0;

  if (!skipProactive && profile.proactiveAllowed) {
    // Recovery opportunities
    const recovery = detectRecoveryOpportunities();
    const nowOpportunities = recovery.opportunities.filter((o) => o.window === "now").slice(0, 1);
    for (const opp of nowOpportunities) {
      parts.push(`Recovery opportunity: ${opp.suggestion}`);
      recoveryInjected++;
    }

    // Proactive insights (only high-confidence)
    const insights = synthesizeProactiveInsights();
    const topInsights = insights.freshInsights.filter((i) => i.confidence > 0.7).slice(0, 1);
    for (const insight of topInsights) {
      parts.push(`Wellness insight: ${insight.text}`);
      proactiveInjected++;
    }
  }

  return {
    systemContext: parts.join("\n"),
    proactiveInjected,
    recoveryInjected,
  };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export async function assistantRequest(
  userMessage: string,
  options: AssistantRequestOptions = {},
): Promise<AssistantResponse> {
  const surface: AssistantSurface = options.surface ?? "ai_chat";
  _isExecuting = true;
  _totalRequests++;
  _lastRequestAt = Date.now();
  _lastSurface = surface;

  try {
    // 1. Sync state from current wellness signals
    syncAssistantState();
    setEngagementState("active");

    // 2. Get surface behavior profile
    const profile = getSurfaceBehaviorProfile(surface);

    // 3. Safety gate — block if active violation or burnout escalation
    const safetyCheck = checkInterventionSafety({
      contentType: "conversational",
      urgency: "normal",
    });

    if (safetyCheck.verdict === "block") {
      _blockedBySafety++;
      emitCognitionEvent("safety_violation", { kind: "assistant_blocked", reason: safetyCheck.reason, surface });

      return {
        requestId: `blocked-${Date.now()}`,
        responseText: "",
        tokensGenerated: 0,
        durationMs: 0,
        surface,
        coachingFrameApplied: getAssistantState().activeCoachingFrame,
        proactiveInsightsInjected: 0,
        recoveryOpportunitiesInjected: 0,
        safetyVerdict: "blocked",
        cancelled: false,
      };
    }

    // 4. Build enriched system context
    const { systemContext, proactiveInjected, recoveryInjected } = buildEnrichedSystemContext(
      surface,
      profile,
      options.skipProactiveInjection ?? false,
    );

    // Append caller-supplied context additions
    const fullSystemContext = [
      systemContext,
      options.systemContextAddition ?? "",
    ].filter(Boolean).join("\n");

    // 5. Execute via cognitive orchestrator
    const cogResult: CognitiveInferenceResult = await executeWithCognition({
      userMessage,
      systemContext: fullSystemContext || undefined,
      maxTokens: options.maxTokens ?? profile.maxResponseTokens,
      temperature: options.temperature ?? 0.7,
      onToken: options.onToken,
      signal: options.signal,
    });

    // 6. Post-execution consistency validation (non-blocking)
    try { runConsistencyValidation(); } catch { /* ok */ }

    const state = getAssistantState();

    return {
      requestId: cogResult.requestId,
      responseText: cogResult.responseText,
      tokensGenerated: cogResult.tokensGenerated,
      durationMs: cogResult.durationMs,
      surface,
      coachingFrameApplied: state.activeCoachingFrame,
      proactiveInsightsInjected: proactiveInjected,
      recoveryOpportunitiesInjected: recoveryInjected,
      safetyVerdict: safetyCheck.verdict === "warn" ? "warned" : "allowed",
      cancelled: cogResult.cancelled,
    };
  } finally {
    _isExecuting = false;
  }
}

// ── Observable ─────────────────────────────────────────────────────────────────

export function getAssistantOrchestratorReport(): AssistantOrchestratorReport {
  return {
    totalRequests: _totalRequests,
    blockedBySafety: _blockedBySafety,
    lastRequestAt: _lastRequestAt,
    lastSurface: _lastSurface,
    isExecuting: _isExecuting,
    consistencyScore: getConsistencyScore(),
  };
}
