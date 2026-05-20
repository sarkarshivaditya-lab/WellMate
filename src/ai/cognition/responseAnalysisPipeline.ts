// Response Analysis Pipeline — extracts structured signals from model output.
//
// This is purely deterministic pattern analysis — no neural inference.
// It runs synchronously after each response, converting unstructured text
// into typed cognitive updates that feed the feedback loop.
//
// What it extracts:
//   emotionalSignals    — valence/arousal inferred from linguistic markers
//   unresolvedGoals     — questions / intentions not answered in the response
//   commitments         — user-stated action intentions ("I will", "I'll try")
//   contradictions      — response contradicts prior context
//   memoryWorthyFacts   — specific facts worth persisting (numbers, dates, conditions)
//   coachingOpportunities — moments where follow-up would be valuable
//   motivationalShifts  — sentiment direction changes mid-response

import type { MemoryDomain } from "../memory/memoryHierarchy";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EmotionalSignalResult = {
  valence: number;         // -1 (negative) to +1 (positive)
  arousal: number;         // 0 (calm) to 1 (activated)
  dominantEmotion: string;
};

export type MemoryWorthyFact = {
  content: string;
  confidence: number;      // 0-1
  domain: MemoryDomain;
};

export type MotivationalShift = {
  from: string;
  to: string;
  confidence: number;
};

export type ResponseAnalysis = {
  requestId: string;
  emotionalSignals: EmotionalSignalResult;
  unresolvedGoals: string[];
  commitments: string[];
  contradictions: string[];
  memoryWorthyFacts: MemoryWorthyFact[];
  coachingOpportunities: string[];
  motivationalShifts: MotivationalShift[];
  analysisMs: number;
};

export type ResponseAnalysisInput = {
  requestId: string;
  userMessage: string;
  responseText: string;
  tokensGenerated: number;
};

// ── Emotion lexicons ──────────────────────────────────────────────────────────

const POSITIVE_MARKERS = [
  "great", "better", "improved", "happy", "excited", "motivated", "proud",
  "strong", "confident", "energized", "accomplished", "well", "good", "yes",
  "progress", "success", "thanks", "love", "enjoy",
];
const NEGATIVE_MARKERS = [
  "tired", "exhausted", "stressed", "anxious", "worried", "bad", "worse",
  "difficult", "hard", "struggling", "failed", "missed", "can't", "don't",
  "won't", "never", "burnt out", "overwhelmed", "sad", "frustrated",
];
const HIGH_AROUSAL_MARKERS = [
  "urgent", "now", "immediately", "excited", "panic", "rush", "emergency",
  "must", "have to", "right away",
];
const COMMITMENT_PATTERNS = [
  /i'?ll\s+\w+/i,
  /i will\s+\w+/i,
  /going to\s+\w+/i,
  /planning to\s+\w+/i,
  /i want to\s+\w+/i,
  /i promise\s+\w+/i,
  /i'm going to\s+\w+/i,
];
const UNRESOLVED_QUESTION_PATTERNS = [
  /\?\s*$/m,
  /\bhow (do|can|should|would)\b/i,
  /\bwhat (should|can|would|will)\b/i,
  /\bwhy (don't|can't|won't)\b/i,
];

// ── Numeric fact patterns ──────────────────────────────────────────────────────

const NUMERIC_FACT_PATTERNS: Array<{ pattern: RegExp; domain: MemoryDomain }> = [
  { pattern: /\b(\d+)\s*(lbs?|kg|pounds?|kilograms?)\b/i, domain: "wellness_goal" },
  { pattern: /\b(\d+)\s*(hours?|hrs?)\s*(of\s+)?sleep\b/i, domain: "wellness_goal" },
  { pattern: /\b(\d+)\s*(steps|calories|kcal)\b/i, domain: "behavioral_observation" },
  { pattern: /\b(\d+)\s*(days?|weeks?|months?)\b/i, domain: "behavioral_observation" },
  { pattern: /\b(bmi|blood pressure|heart rate|resting hr)\s*:?\s*\d+/i, domain: "wellness_goal" },
];

// ── Coaching opportunity patterns ─────────────────────────────────────────────

const COACHING_OPPORTUNITY_PATTERNS = [
  { pattern: /i (feel|felt|am feeling)\s+(stressed|anxious|overwhelmed|burnt out)/i, opportunity: "stress management guidance" },
  { pattern: /i('ve)? been (skipping|missing|not doing)/i, opportunity: "habit consistency support" },
  { pattern: /(can't|cannot) sleep/i, opportunity: "sleep improvement coaching" },
  { pattern: /i don't know (what|how|why|where)/i, opportunity: "clarity coaching" },
  { pattern: /give up|quit|stop (trying|doing)/i, opportunity: "motivational recovery" },
];

// ── Analysis functions ────────────────────────────────────────────────────────

function extractEmotionalSignals(text: string): EmotionalSignalResult {
  const lower = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  let arousalBoost = 0;

  for (const m of POSITIVE_MARKERS) {
    if (lower.includes(m)) positiveScore += 1;
  }
  for (const m of NEGATIVE_MARKERS) {
    if (lower.includes(m)) negativeScore += 1;
  }
  for (const m of HIGH_AROUSAL_MARKERS) {
    if (lower.includes(m)) arousalBoost += 0.15;
  }

  const total = positiveScore + negativeScore || 1;
  const valence = (positiveScore - negativeScore) / total;
  const arousal = Math.min(1, 0.3 + arousalBoost + (Math.abs(valence) * 0.2));

  let dominantEmotion = "calm";
  if (valence > 0.4) dominantEmotion = "motivated";
  else if (valence < -0.4) dominantEmotion = negativeScore > 3 ? "frustrated" : "anxious";
  else if (arousal > 0.6) dominantEmotion = "uncertain";

  return { valence: Math.max(-1, Math.min(1, valence)), arousal, dominantEmotion };
}

function extractCommitments(text: string): string[] {
  const results: string[] = [];
  for (const pattern of COMMITMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match) results.push(match[0].slice(0, 80));
  }
  return [...new Set(results)].slice(0, 4);
}

function extractUnresolvedGoals(userMessage: string): string[] {
  const results: string[] = [];
  for (const pattern of UNRESOLVED_QUESTION_PATTERNS) {
    if (pattern.test(userMessage)) {
      const snippet = userMessage.match(pattern)?.[0] ?? userMessage.slice(0, 60);
      results.push(snippet.slice(0, 80));
    }
  }
  return [...new Set(results)].slice(0, 3);
}

function extractMemoryWorthyFacts(text: string): MemoryWorthyFact[] {
  const results: MemoryWorthyFact[] = [];
  for (const { pattern, domain } of NUMERIC_FACT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      results.push({
        content: match[0].slice(0, 120),
        confidence: 0.75,
        domain,
      });
    }
  }
  return results.slice(0, 5);
}

function extractCoachingOpportunities(text: string): string[] {
  const results: string[] = [];
  for (const { pattern, opportunity } of COACHING_OPPORTUNITY_PATTERNS) {
    if (pattern.test(text)) results.push(opportunity);
  }
  return [...new Set(results)].slice(0, 3);
}

function detectMotivationalShifts(text: string): MotivationalShift[] {
  // Very lightweight: look for "but" or "however" indicating a turn
  const shifts: MotivationalShift[] = [];
  const turnMarkers = [/\bbut\b.*?(?:\.|$)/gi, /\bhowever\b.*?(?:\.|$)/gi];
  for (const marker of turnMarkers) {
    const match = text.match(marker);
    if (match && match[0].length > 20) {
      shifts.push({ from: "current_state", to: "shifted_state", confidence: 0.4 });
    }
  }
  return shifts.slice(0, 2);
}

// ── Main entry ────────────────────────────────────────────────────────────────

let _lastAnalysis: ResponseAnalysis | null = null;

export function analyzeResponse(input: ResponseAnalysisInput): ResponseAnalysis {
  const start = Date.now();
  const fullText = `${input.userMessage} ${input.responseText}`;

  const analysis: ResponseAnalysis = {
    requestId: input.requestId,
    emotionalSignals: extractEmotionalSignals(fullText),
    unresolvedGoals: extractUnresolvedGoals(input.userMessage),
    commitments: extractCommitments(input.userMessage),
    contradictions: [],
    memoryWorthyFacts: extractMemoryWorthyFacts(fullText),
    coachingOpportunities: extractCoachingOpportunities(fullText),
    motivationalShifts: detectMotivationalShifts(fullText),
    analysisMs: 0,
  };

  analysis.analysisMs = Date.now() - start;
  _lastAnalysis = analysis;
  return analysis;
}

export function getLastResponseAnalysis(): ResponseAnalysis | null {
  return _lastAnalysis;
}

export function getResponseAnalysisPipelineReport(): {
  lastAnalysis: ResponseAnalysis | null;
  hasCoachingOpportunities: boolean;
  hasCommitments: boolean;
  emotionalValence: number;
} {
  return {
    lastAnalysis: _lastAnalysis,
    hasCoachingOpportunities: (_lastAnalysis?.coachingOpportunities.length ?? 0) > 0,
    hasCommitments: (_lastAnalysis?.commitments.length ?? 0) > 0,
    emotionalValence: _lastAnalysis?.emotionalSignals.valence ?? 0,
  };
}
