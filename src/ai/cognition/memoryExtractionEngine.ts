// Memory Extraction Engine — converts conversation turns into structured memory candidates.
//
// Architecture:
//   1. Extract facts from user message + response
//   2. Classify tier (ephemeral → session → episodic → semantic → reflective)
//   3. Score confidence
//   4. Suppress duplicates against existing memories (token-overlap check)
//   5. Flag contradictions with existing semantic/episodic memories
//   6. Apply emotional weighting based on response analysis
//
// NO raw transcript dumping. Everything must be structured and classified.
// Candidates flow into memoryHierarchy.ts via the feedback loop.

import type { ResponseAnalysis } from "./responseAnalysisPipeline";
import type { MemoryDomain } from "../memory/memoryHierarchy";
import { retrieveMemory } from "../memory/memoryHierarchy";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MemoryTierClassification = 1 | 2 | 3 | 4 | 5;

export type MemoryCandidate = {
  id: string;
  content: string;
  tierClassification: MemoryTierClassification;
  domain: MemoryDomain;
  confidence: number;
  isDuplicate: boolean;
  contradicts?: string;       // content of contradicted memory
  emotionalWeight: number;    // 0-1
  tags: string[];
};

export type ExtractionInput = {
  userMessage: string;
  responseText: string;
  analysis: ResponseAnalysis;
};

export type ExtractionReport = {
  lastCandidateCount: number;
  lastDuplicatesSuppressed: number;
  lastContradictionsDetected: number;
  tierDistribution: Record<MemoryTierClassification, number>;
  lastExtractedAt: number | null;
};

// ── Tier classification rules ──────────────────────────────────────────────────
// Tier 1 (ephemeral)  — greeting/filler/low-info
// Tier 2 (session)    — current session facts; not worth long-term storage
// Tier 3 (episodic)   — notable events, emotional moments, one-time disclosures
// Tier 4 (semantic)   — stable user facts (preferences, conditions, goals)
// Tier 5 (reflective) — high-level insights; only from memoryWorthyFacts w/ high confidence

const SEMANTIC_KEYWORDS = [
  "i always", "i never", "i prefer", "i hate", "i love", "my goal",
  "every day", "every week", "i have", "i am diagnosed", "my condition",
  "i weigh", "my bmi", "my sleep", "i usually", "i typically",
];

const EPISODIC_KEYWORDS = [
  "today", "yesterday", "this week", "last night", "i felt", "i was",
  "i tried", "i went", "i ate", "i exercised", "i missed",
];

const REFLECTIVE_KEYWORDS = [
  "pattern", "trend", "always", "consistently", "over time", "i've noticed",
  "i realize", "i've learned", "it seems like",
];

function classifyTier(content: string, confidence: number): MemoryTierClassification {
  const lower = content.toLowerCase();

  if (confidence < 0.3) return 1;
  if (REFLECTIVE_KEYWORDS.some((k) => lower.includes(k)) && confidence > 0.7) return 5;
  if (SEMANTIC_KEYWORDS.some((k) => lower.includes(k))) return 4;
  if (EPISODIC_KEYWORDS.some((k) => lower.includes(k))) return 3;
  if (content.length > 60) return 2;
  return 1;
}

function classifyDomain(content: string): MemoryDomain {
  const lower = content.toLowerCase();
  if (/sleep|rest|night|tired|insomnia/.test(lower)) return "behavioral_observation";
  if (/goal|target|want to|plan|aim/.test(lower)) return "wellness_goal";
  if (/feel|emotion|stress|anxious|calm|mood/.test(lower)) return "emotional_pattern";
  if (/habit|exercise|gym|walk|run|workout/.test(lower)) return "behavioral_observation";
  if (/food|eat|meal|calories|nutrition|diet/.test(lower)) return "behavioral_observation";
  if (/prefer|like|dislike|love|hate/.test(lower)) return "user_preference";
  if (/coach|advice|suggest|recommend/.test(lower)) return "coaching_insight";
  return "behavioral_observation";
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();
  const keywords = ["sleep", "stress", "exercise", "food", "mood", "goal", "habit", "weight", "energy"];
  for (const kw of keywords) {
    if (lower.includes(kw)) tags.push(kw);
  }
  return tags.slice(0, 4);
}

// ── Duplicate suppression ─────────────────────────────────────────────────────

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const bTokens = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const t of aTokens) { if (bTokens.has(t)) shared++; }
  return shared / Math.min(aTokens.size, bTokens.size);
}

function isDuplicate(candidate: string): boolean {
  try {
    const existing = retrieveMemory({ tiers: [2, 3, 4], limit: 30 });
    return existing.some((e) => tokenOverlap(e.content, candidate) > 0.75);
  } catch {
    return false;
  }
}

function findContradiction(candidate: string): string | undefined {
  try {
    const existing = retrieveMemory({ tiers: [3, 4], limit: 20 });
    const ANTONYM_PAIRS: [string, string][] = [
      ["never exercise", "exercise regularly"],
      ["can't sleep", "sleep well"],
      ["high stress", "low stress"],
      ["gaining weight", "losing weight"],
      ["poor diet", "healthy diet"],
    ];
    for (const entry of existing) {
      for (const [a, b] of ANTONYM_PAIRS) {
        const existingHasA = entry.content.toLowerCase().includes(a);
        const candidateHasB = candidate.toLowerCase().includes(b);
        const existingHasB = entry.content.toLowerCase().includes(b);
        const candidateHasA = candidate.toLowerCase().includes(a);
        if ((existingHasA && candidateHasB) || (existingHasB && candidateHasA)) {
          return entry.content.slice(0, 100);
        }
      }
    }
  } catch { /* safe */ }
  return undefined;
}

// ── State ──────────────────────────────────────────────────────────────────────

let _extractionCounter = 0;
let _lastReport: ExtractionReport = {
  lastCandidateCount: 0,
  lastDuplicatesSuppressed: 0,
  lastContradictionsDetected: 0,
  tierDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  lastExtractedAt: null,
};

// ── Main entry ────────────────────────────────────────────────────────────────

export function extractMemoryCandidates(input: ExtractionInput): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  let duplicatesSuppressed = 0;
  let contradictionsDetected = 0;

  // Extract from memory-worthy facts (highest quality source)
  for (const fact of input.analysis.memoryWorthyFacts) {
    if (fact.content.length < 10) continue;
    const dup = isDuplicate(fact.content);
    if (dup) { duplicatesSuppressed++; continue; }
    const contradiction = findContradiction(fact.content);
    if (contradiction) contradictionsDetected++;

    candidates.push({
      id: `mc-${Date.now()}-${_extractionCounter++}`,
      content: fact.content,
      tierClassification: classifyTier(fact.content, fact.confidence),
      domain: fact.domain,
      confidence: fact.confidence,
      isDuplicate: false,
      contradicts: contradiction,
      emotionalWeight: Math.abs(input.analysis.emotionalSignals.valence),
      tags: extractTags(fact.content),
    });
  }

  // Extract from user commitments
  for (const commitment of input.analysis.commitments) {
    if (commitment.length < 15) continue;
    const dup = isDuplicate(commitment);
    if (dup) { duplicatesSuppressed++; continue; }

    candidates.push({
      id: `mc-${Date.now()}-${_extractionCounter++}`,
      content: commitment,
      tierClassification: 3,   // commitments → episodic
      domain: "wellness_goal",
      confidence: 0.6,
      isDuplicate: false,
      emotionalWeight: 0.5,
      tags: extractTags(commitment),
    });
  }

  // Extract user message directly if it's substantial and semantic
  const msgLower = input.userMessage.toLowerCase();
  if (
    input.userMessage.length > 30 &&
    SEMANTIC_KEYWORDS.some((k) => msgLower.includes(k))
  ) {
    const content = input.userMessage.slice(0, 200);
    const dup = isDuplicate(content);
    if (!dup) {
      candidates.push({
        id: `mc-${Date.now()}-${_extractionCounter++}`,
        content,
        tierClassification: classifyTier(content, 0.65),
        domain: classifyDomain(content),
        confidence: 0.65,
        isDuplicate: false,
        contradicts: findContradiction(content),
        emotionalWeight: Math.abs(input.analysis.emotionalSignals.valence),
        tags: extractTags(content),
      });
    } else {
      duplicatesSuppressed++;
    }
  }

  // Update report
  const tierDist: Record<MemoryTierClassification, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of candidates) tierDist[c.tierClassification]++;

  _lastReport = {
    lastCandidateCount: candidates.length,
    lastDuplicatesSuppressed: duplicatesSuppressed,
    lastContradictionsDetected: contradictionsDetected,
    tierDistribution: tierDist,
    lastExtractedAt: Date.now(),
  };

  return candidates.slice(0, 8);  // hard cap
}

export function getMemoryExtractionReport(): ExtractionReport {
  return { ..._lastReport };
}
