// Production Inference Bridge — enforces the unified AI execution path.
//
// All assistant surfaces MUST call assistantRequest() from unifiedAssistantOrchestrator.
// This module audits compliance and provides the official guarded API.
//
// Enforcement model:
//   - guardedRequest() is the recommended call site for any component needing AI output
//   - It routes to assistantRequest() internally
//   - Direct submitInferenceRequest() calls are not preventable at runtime, but this
//     module provides an audit mechanism: bypassAudit() detects when inference happened
//     without going through the unified path (by comparing orchestrator execution count
//     with inference worker submission count)
//
// Usage:
//   import { guardedRequest } from "@/ai/production/productionInferenceBridge";
//   const response = await guardedRequest(message, { surface: "habits" });

import { assistantRequest, AssistantRequestOptions, AssistantResponse } from "@/ai/assistant/unifiedAssistantOrchestrator";
import { getAssistantOrchestratorReport } from "@/ai/assistant/unifiedAssistantOrchestrator";
import { getInferenceWorkerBridgeState } from "@/ai/workers/inferenceWorkerBridge";
import { canExecuteInferenceNow } from "@/ai/platform/mobileExecutionHardener";
import { assertPsychologicalSafety } from "@/ai/assistant/psychologicalSafetyRuntime";
import { AssistantSurface } from "@/ai/assistant/contextualBehaviorEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BypassAuditResult = {
  orchestratorExecutions: number;
  workerSubmissions: number;
  estimatedBypasses: number;
  bypassRatio: number;         // 0-1; 0 = no bypasses
  verdict: "clean" | "suspected_bypass" | "audit_unavailable";
};

export type InferenceBridgeReport = {
  totalGuardedRequests: number;
  totalBlockedByMobile: number;
  totalBlockedBySafety: number;
  lastRequestAt: number | null;
  bypassAudit: BypassAuditResult;
};

// ── State ──────────────────────────────────────────────────────────────────────

let _totalGuarded = 0;
let _blockedMobile = 0;
let _blockedSafety = 0;
let _lastRequestAt: number | null = null;

// ── Guarded request ────────────────────────────────────────────────────────────

export async function guardedRequest(
  message: string,
  options: AssistantRequestOptions & { surface?: AssistantSurface } = {},
): Promise<AssistantResponse | null> {
  _totalGuarded++;
  _lastRequestAt = Date.now();

  // Mobile execution gate
  const urgency = (options.maxTokens ?? 256) > 200 ? "normal" : "low";
  if (!canExecuteInferenceNow(urgency as "high" | "normal" | "low")) {
    _blockedMobile++;
    return null;
  }

  // Psychological safety gate
  if (!assertPsychologicalSafety({
    contentType: options.skipProactiveInjection ? "conversational" : "proactive",
    surface: options.surface,
    urgency: urgency as "low" | "normal" | "high",
  })) {
    _blockedSafety++;
    return null;
  }

  return assistantRequest(message, options);
}

// ── Bypass audit ───────────────────────────────────────────────────────────────

export function runBypassAudit(): BypassAuditResult {
  const orchestratorReport = getAssistantOrchestratorReport();
  const workerState = getInferenceWorkerBridgeState();

  // workerState.slots gives us individual slot inference counts
  const workerSubmissions = workerState.slots.reduce((s, slot) => s + slot.inferenceCount, 0);
  const orchestratorExecutions = orchestratorReport.totalRequests;

  // Discrepancy: if worker saw more submissions than orchestrator saw requests,
  // something went directly to submitInferenceRequest
  const estimatedBypasses = Math.max(0, workerSubmissions - orchestratorExecutions);
  const bypassRatio = workerSubmissions === 0 ? 0 : estimatedBypasses / workerSubmissions;

  const verdict: BypassAuditResult["verdict"] =
    workerSubmissions === 0 ? "audit_unavailable" :
    estimatedBypasses > 0 ? "suspected_bypass" : "clean";

  return { orchestratorExecutions, workerSubmissions, estimatedBypasses, bypassRatio, verdict };
}

// ── Observable ────────────────────────────────────────────────────────────────

export function getInferenceBridgeReport(): InferenceBridgeReport {
  return {
    totalGuardedRequests: _totalGuarded,
    totalBlockedByMobile: _blockedMobile,
    totalBlockedBySafety: _blockedSafety,
    lastRequestAt: _lastRequestAt,
    bypassAudit: runBypassAudit(),
  };
}
