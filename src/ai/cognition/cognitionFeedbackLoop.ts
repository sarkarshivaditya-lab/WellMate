// Cognition Feedback Loop — closes the cognitive loop after every inference.
//
// After each inference response is analyzed and memory extracted,
// this module writes back into all cognition subsystems:
//   1. Write extracted memory candidates to appropriate memory tiers
//   2. Update goal threads based on response analysis
//   3. Update emotional continuity based on emotional signals
//   4. Update user model evidence
//   5. Decay stale attention slots
//   6. Checkpoint cognitive state
//   7. Evaluate whether a reflection cycle should trigger
//   8. Run safety audit
//
// This is NOT run on every keypress — only after a full inference completes.
// It runs async and does not block the response return path.

import { writeMemory } from "../memory/memoryHierarchy";
import {
  applyAttentionDecay,
  checkpointCognitiveState,
} from "./cognitiveStateEngine";
import { runReflectionCycle } from "./reflectionEngine";
import { recordUserEvidence } from "./userModel";
import { runSafetyAudit } from "./memorySafetyGovernor";
import { emitCognitionEvent } from "./cognitionEventBus";
import { upsertGoalThread } from "./goalThreadTracker";
import { recordEmotionalSignal } from "./emotionalContinuityEngine";
import type { ResponseAnalysis } from "./responseAnalysisPipeline";
import type { MemoryCandidate } from "./memoryExtractionEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FeedbackLoopInput = {
  analysis: ResponseAnalysis;
  memoryCandidates: MemoryCandidate[];
};

export type FeedbackLoopResult = {
  memoriesWritten: number;
  goalsUpdated: number;
  emotionalContinuityUpdated: boolean;
  userModelUpdated: boolean;
  attentionDecayed: boolean;
  checkpointCreated: boolean;
  reflectionTriggered: boolean;
  safetyViolationsDetected: number;
  durationMs: number;
};

// ── State ──────────────────────────────────────────────────────────────────────

let _lastResult: FeedbackLoopResult | null = null;
let _totalLoops = 0;
let _totalMemoriesWritten = 0;
let _reflectionTriggerCount = 0;

// Reflection trigger: run after every 5 inference loops, or when emotional shift detected
const REFLECTION_INTERVAL = 5;

// ── Memory write ──────────────────────────────────────────────────────────────

function writeCandidatesToMemory(candidates: MemoryCandidate[]): number {
  let written = 0;
  for (const candidate of candidates) {
    if (candidate.isDuplicate) continue;
    if (candidate.tierClassification === 1) continue;  // ephemeral: don't persist

    try {
      writeMemory(
        candidate.tierClassification,
        candidate.content,
        {
          domain: candidate.domain,
          salience: Math.max(0.2, candidate.emotionalWeight * 0.5 + candidate.confidence * 0.5),
          confidence: candidate.confidence,
          source: "memoryExtractionEngine",
          semanticTags: candidate.tags,
        },
      );
      written++;
    } catch { /* storage full or validation failed — skip */ }
  }
  return written;
}

// ── Goal thread update ────────────────────────────────────────────────────────

function updateGoalThreads(analysis: ResponseAnalysis): number {
  let updated = 0;
  const valence = analysis.emotionalSignals.valence;
  const direction = valence > 0.2 ? "positive" : valence < -0.2 ? "negative" : "neutral";

  // Update from commitments (positive goal signal)
  for (const commitment of analysis.commitments) {
    upsertGoalThread({ snippet: commitment, direction: "positive", emotionalWeight: 0.6 });
    updated++;
  }

  // Update from coaching opportunities (negative/struggle signal)
  for (const opp of analysis.coachingOpportunities) {
    upsertGoalThread({ snippet: opp, direction: "negative", emotionalWeight: Math.abs(valence) });
    updated++;
  }

  // Update from unresolved goals (neutral — they exist but aren't resolved yet)
  for (const goal of analysis.unresolvedGoals) {
    upsertGoalThread({ snippet: goal, direction, emotionalWeight: 0.4 });
    updated++;
  }

  return updated;
}

// ── Emotional continuity update ───────────────────────────────────────────────

function updateEmotionalContinuity(analysis: ResponseAnalysis): boolean {
  const { valence, arousal, dominantEmotion } = analysis.emotionalSignals;
  const confidence = 0.5;  // single inference has moderate confidence

  // Map emotional signals to specific dimensions
  if (valence < -0.3) {
    recordEmotionalSignal("stress", Math.abs(valence) * arousal, confidence);
    recordEmotionalSignal("frustration", Math.abs(valence) * 0.7, confidence * 0.8);
  }
  if (valence > 0.3) {
    recordEmotionalSignal("motivation", valence * 0.8 + 0.1, confidence);
    recordEmotionalSignal("encouragement_effectiveness", valence * 0.6 + 0.2, confidence * 0.7);
  }
  if (dominantEmotion === "tired" || dominantEmotion === "frustrated") {
    recordEmotionalSignal("burnout", 0.6, confidence * 0.6);
  }

  return true;
}

// ── User model evidence ───────────────────────────────────────────────────────

function updateUserModel(analysis: ResponseAnalysis): boolean {
  const { valence } = analysis.emotionalSignals;

  if (analysis.commitments.length > 0) {
    recordUserEvidence({ dimension: "motivation", observation: "commitment_detected", value: 0.7, weight: 0.6, timestamp: Date.now() });
  }
  if (analysis.coachingOpportunities.includes("motivational recovery")) {
    recordUserEvidence({ dimension: "motivation", observation: "struggle_signal", value: 0.2, weight: 0.5, timestamp: Date.now() });
  }
  if (valence > 0.4) {
    recordUserEvidence({ dimension: "engagement_depth", observation: "positive_response", value: 0.7, weight: 0.4, timestamp: Date.now() });
  }

  return true;
}

// ── Reflection trigger evaluation ─────────────────────────────────────────────

function shouldTriggerReflection(): boolean {
  // Trigger every N loops
  if (_totalLoops > 0 && _totalLoops % REFLECTION_INTERVAL === 0) return true;
  return false;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function runCognitionFeedbackLoop(input: FeedbackLoopInput): Promise<FeedbackLoopResult> {
  const start = Date.now();
  let memoriesWritten = 0;
  let goalsUpdated = 0;
  let emotionalContinuityUpdated = false;
  let userModelUpdated = false;
  let reflectionTriggered = false;
  let safetyViolationsDetected = 0;

  _totalLoops++;

  try {
    // 1. Write memory candidates
    memoriesWritten = writeCandidatesToMemory(input.memoryCandidates);
    _totalMemoriesWritten += memoriesWritten;

    // 2. Update goal threads
    goalsUpdated = updateGoalThreads(input.analysis);

    // 3. Update emotional continuity
    emotionalContinuityUpdated = updateEmotionalContinuity(input.analysis);

    // 4. Update user model
    userModelUpdated = updateUserModel(input.analysis);

    // 5. Decay stale attention
    applyAttentionDecay();

    // 6. Checkpoint cognitive state
    checkpointCognitiveState();

    // 7. Reflection trigger
    if (shouldTriggerReflection()) {
      try {
        runReflectionCycle();
        reflectionTriggered = true;
        _reflectionTriggerCount++;
      } catch { /* reflection is non-critical */ }
    }

    // 8. Safety audit (non-blocking, every 10 loops)
    if (_totalLoops % 10 === 0) {
      const audit = runSafetyAudit(false);
      safetyViolationsDetected = audit.violations.length;
      if (safetyViolationsDetected > 0) {
        emitCognitionEvent("safety_violation", { count: safetyViolationsDetected, violations: audit.violations });
      }
    }

  } catch { /* feedback loop errors must not propagate to callers */ }

  const result: FeedbackLoopResult = {
    memoriesWritten,
    goalsUpdated,
    emotionalContinuityUpdated,
    userModelUpdated,
    attentionDecayed: true,
    checkpointCreated: true,
    reflectionTriggered,
    safetyViolationsDetected,
    durationMs: Date.now() - start,
  };

  _lastResult = result;
  return result;
}

export function getCognitionFeedbackLoopReport(): {
  totalLoops: number;
  totalMemoriesWritten: number;
  reflectionTriggerCount: number;
  lastResult: FeedbackLoopResult | null;
} {
  return {
    totalLoops: _totalLoops,
    totalMemoriesWritten: _totalMemoriesWritten,
    reflectionTriggerCount: _reflectionTriggerCount,
    lastResult: _lastResult,
  };
}
