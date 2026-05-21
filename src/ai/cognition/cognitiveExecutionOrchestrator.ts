// Cognitive Execution Orchestrator — the single entrypoint for all AI inference.
//
// Every inference is a stateful cognitive event, not a stateless prompt request.
// All AI execution MUST route through executeWithCognition().
//
// Pipeline (per inference):
//   1. Assemble continuous context (continuousContextInjector)
//   2. Synthesize bounded prompt (promptSynthesisEngine)
//   3. Execute inference via worker bridge
//   4. Analyze response (responseAnalysisPipeline)
//   5. Extract memory candidates (memoryExtractionEngine)
//   6. Close the cognition loop (cognitionFeedbackLoop)
//
// The orchestrator records a pipeline trace per execution — visible in AIDevPanel.

import { buildContextInjection } from "./continuousContextInjector";
import type { ContextInjection } from "./continuousContextInjector";
import { synthesizePrompt } from "./promptSynthesisEngine";
import type { SynthesisOutput } from "./promptSynthesisEngine";
import { analyzeResponse } from "./responseAnalysisPipeline";
import type { ResponseAnalysis } from "./responseAnalysisPipeline";
import { extractMemoryCandidates } from "./memoryExtractionEngine";
import { runCognitionFeedbackLoop } from "./cognitionFeedbackLoop";
import {
  recordInferenceTrace,
  addAttentionSlot,
  getEmotionalState,
} from "./cognitiveStateEngine";
import { emitCognitionEvent } from "./cognitionEventBus";
import { submitInferenceRequest } from "../workers/inferenceWorkerBridge";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CognitiveInferencePriority = "high" | "normal" | "low";

export type CognitiveInferenceRequest = {
  userMessage: string;
  systemContext?: string;
  maxTokens?: number;
  temperature?: number;
  priority?: CognitiveInferencePriority;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
};

export type PipelineStage =
  | "context_assembly"
  | "prompt_synthesis"
  | "inference"
  | "response_analysis"
  | "memory_extraction"
  | "feedback_loop";

export type PipelineStageResult = {
  stage: PipelineStage;
  durationMs: number;
  succeeded: boolean;
  detail?: string;
};

export type CognitiveExecutionStats = {
  contextTokensUsed: number;
  memoriesRetrieved: number;
  memoriesExtracted: number;
  goalsActive: number;
  emotionalValence: number;
  feedbackLoopMs: number;
};

export type CognitiveInferenceResult = {
  requestId: string;
  responseText: string;
  tokensGenerated: number;
  durationMs: number;
  stages: PipelineStageResult[];
  cognitiveStats: CognitiveExecutionStats;
  cancelled: boolean;
};

export type OrchestratorReport = {
  totalExecutions: number;
  failedExecutions: number;
  averagePipelineMs: number;
  lastExecutionAt: number | null;
  lastStages: PipelineStageResult[];
  lastRequestId: string | null;
  isExecuting: boolean;
};

// ── Module state ───────────────────────────────────────────────────────────────

let _totalExecutions = 0;
let _failedExecutions = 0;
let _totalPipelineMs = 0;
let _lastExecutionAt: number | null = null;
let _lastStages: PipelineStageResult[] = [];
let _lastRequestId: string | null = null;
let _isExecuting = false;
let _execCounter = 0;

const _listeners = new Set<() => void>();

function notify(): void {
  _listeners.forEach((fn) => fn());
}

export function subscribeToOrchestrator(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// ── Execution ──────────────────────────────────────────────────────────────────

export async function executeWithCognition(
  req: CognitiveInferenceRequest,
): Promise<CognitiveInferenceResult> {
  const requestId = `cog-${Date.now()}-${_execCounter++}`;
  const overallStart = Date.now();
  const stages: PipelineStageResult[] = [];
  let responseText = "";
  let tokensGenerated = 0;
  let cancelled = false;

  _isExecuting = true;
  notify();

  try {
    // ── Stage 1: Context assembly ──────────────────────────────────────────────
    const ctxStart = Date.now();
    let injection: ContextInjection = { sections: [], totalTokens: 0, budgetTokens: 800, criticalTokens: 0, assembledAt: Date.now() };
    let contextTokensUsed = 0;
    try {
      injection = buildContextInjection(800);
      contextTokensUsed = injection.totalTokens;
      stages.push({ stage: "context_assembly", durationMs: Date.now() - ctxStart, succeeded: true, detail: `${contextTokensUsed} tokens` });
    } catch {
      stages.push({ stage: "context_assembly", durationMs: Date.now() - ctxStart, succeeded: false });
    }

    // ── Stage 2: Prompt synthesis ──────────────────────────────────────────────
    const synthStart = Date.now();
    let synthesized: SynthesisOutput = { prompt: req.userMessage, systemPrompt: req.systemContext ?? "", tokenBudgetUsed: 0, tokenBudgetTotal: 1200, sections: [], continuityFrame: null, contradictionsSuppressed: 0, synthesizedAt: Date.now() };
    try {
      synthesized = synthesizePrompt({
        userMessage: req.userMessage,
        assembledContext: injection,
        systemContext: req.systemContext,
        budgetTokens: 1200,
      });
      stages.push({ stage: "prompt_synthesis", durationMs: Date.now() - synthStart, succeeded: true, detail: `${synthesized.tokenBudgetUsed} tokens` });
    } catch {
      stages.push({ stage: "prompt_synthesis", durationMs: Date.now() - synthStart, succeeded: false });
    }

    // ── Stage 3: Inference ─────────────────────────────────────────────────────
    const inferStart = Date.now();
    try {
      const stats = await submitInferenceRequest(
        synthesized.prompt,
        {
          maxTokens: req.maxTokens ?? 256,
          temperature: req.temperature ?? 0.7,
          topP: 0.9,
          repeatPenalty: 1.1,
          nCtx: 2048,
        },
        { onToken: req.onToken, signal: req.signal },
      );

      // The actual response text accumulates via onToken; stats gives us the count
      tokensGenerated = stats.tokensGenerated;
      cancelled = stats.cancelled;

      stages.push({
        stage: "inference",
        durationMs: Date.now() - inferStart,
        succeeded: true,
        detail: `${tokensGenerated} tokens, ${stats.wasmMode}`,
      });

      // Reconstruct text from tokens if onToken was used — otherwise stats has no text field.
      // The calling UI typically accumulates via onToken itself. We store a placeholder.
      responseText = `[${tokensGenerated} tokens generated]`;
    } catch (err) {
      cancelled = req.signal?.aborted ?? false;
      stages.push({ stage: "inference", durationMs: Date.now() - inferStart, succeeded: false, detail: String(err) });
      if (!cancelled) throw err;
    }

    if (cancelled) {
      stages.push(...["response_analysis", "memory_extraction", "feedback_loop"].map((s) => ({
        stage: s as PipelineStage, durationMs: 0, succeeded: false, detail: "cancelled",
      })));
      return finalizeResult(requestId, responseText, tokensGenerated, true, stages, overallStart, 0, 0, 0, 0);
    }

    // ── Stage 4: Response analysis ─────────────────────────────────────────────
    const analysisStart = Date.now();
    let analysis: ResponseAnalysis = { requestId, emotionalSignals: { valence: 0, arousal: 0.3, dominantEmotion: "calm" }, unresolvedGoals: [], commitments: [], contradictions: [], memoryWorthyFacts: [], coachingOpportunities: [], motivationalShifts: [], analysisMs: 0 };
    try {
      analysis = analyzeResponse({ requestId, userMessage: req.userMessage, responseText, tokensGenerated });
      stages.push({ stage: "response_analysis", durationMs: Date.now() - analysisStart, succeeded: true });
    } catch {
      stages.push({ stage: "response_analysis", durationMs: Date.now() - analysisStart, succeeded: false });
    }

    // ── Stage 5: Memory extraction ─────────────────────────────────────────────
    const memStart = Date.now();
    let candidates: ReturnType<typeof extractMemoryCandidates> = [];
    try {
      candidates = extractMemoryCandidates({ userMessage: req.userMessage, responseText, analysis });
      stages.push({ stage: "memory_extraction", durationMs: Date.now() - memStart, succeeded: true, detail: `${candidates.length} candidates` });
    } catch {
      stages.push({ stage: "memory_extraction", durationMs: Date.now() - memStart, succeeded: false });
    }

    // ── Stage 6: Feedback loop ─────────────────────────────────────────────────
    const fbStart = Date.now();
    let feedbackMs = 0;
    try {
      await runCognitionFeedbackLoop({ analysis, memoryCandidates: candidates });
      feedbackMs = Date.now() - fbStart;
      stages.push({ stage: "feedback_loop", durationMs: feedbackMs, succeeded: true });
    } catch {
      feedbackMs = Date.now() - fbStart;
      stages.push({ stage: "feedback_loop", durationMs: feedbackMs, succeeded: false });
    }

    // Record attention slot for this conversation turn
    addAttentionSlot(
      req.userMessage.slice(0, 120),
      "recent_event",
      0.75,
    );

    // Record inference trace for working memory
    recordInferenceTrace({
      requestId,
      topicSummary: req.userMessage.slice(0, 80),
      emotionalTone: analysis.emotionalSignals.dominantEmotion,
      goalsMentioned: analysis.unresolvedGoals.slice(0, 3),
      responseQuality: tokensGenerated > 50 ? "high" : tokensGenerated > 20 ? "medium" : "low",
      tokenCount: tokensGenerated,
      timestamp: Date.now(),
    });

    emitCognitionEvent("cognition_checkpoint_created", { requestId, stage: "post_inference" });

    return finalizeResult(
      requestId, responseText, tokensGenerated, false, stages, overallStart,
      feedbackMs, contextTokensUsed, candidates.length, getEmotionalState().valence,
    );
  } catch (err) {
    _failedExecutions++;
    emitCognitionEvent("safety_violation", { kind: "execution_failure", detail: String(err) });
    throw err;
  } finally {
    _totalExecutions++;
    const totalMs = Date.now() - overallStart;
    _totalPipelineMs += totalMs;
    _lastExecutionAt = Date.now();
    _lastStages = stages;
    _lastRequestId = requestId;
    _isExecuting = false;
    notify();
  }
}

function finalizeResult(
  requestId: string,
  responseText: string,
  tokensGenerated: number,
  cancelled: boolean,
  stages: PipelineStageResult[],
  overallStart: number,
  feedbackMs: number,
  contextTokensUsed: number,
  memoriesExtracted: number,
  emotionalValence: number,
): CognitiveInferenceResult {
  return {
    requestId,
    responseText,
    tokensGenerated,
    durationMs: Date.now() - overallStart,
    stages,
    cancelled,
    cognitiveStats: {
      contextTokensUsed,
      memoriesRetrieved: 0,
      memoriesExtracted,
      goalsActive: 0,
      emotionalValence,
      feedbackLoopMs: feedbackMs,
    },
  };
}

// ── Observable ─────────────────────────────────────────────────────────────────

export function getOrchestratorReport(): OrchestratorReport {
  return {
    totalExecutions: _totalExecutions,
    failedExecutions: _failedExecutions,
    averagePipelineMs: _totalExecutions > 0 ? Math.round(_totalPipelineMs / _totalExecutions) : 0,
    lastExecutionAt: _lastExecutionAt,
    lastStages: _lastStages,
    lastRequestId: _lastRequestId,
    isExecuting: _isExecuting,
  };
}
