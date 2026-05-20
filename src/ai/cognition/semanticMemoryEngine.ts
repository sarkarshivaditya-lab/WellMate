// Semantic Memory Engine — semantic similarity, deduplication, and conceptual grouping.
//
// Architecture layer only. Remains fully offline-first with no external APIs.
// Uses TF-IDF-style token overlap for similarity — no neural embeddings required.
//
// Capabilities:
//   computeSemanticSimilarity  — 0-1 similarity between two memory strings
//   deduplicateMemories        — remove near-duplicate candidates
//   detectContradictions       — cluster conflicting memory pairs
//   groupByConceptualSimilarity — group memories into conceptual buckets
//   buildMemoryRelationGraph    — emit relation edges between memory entries
//
// Bounds: max 100 entries per grouping operation; max 20 relation edges per report.

import type { MemoryEntry } from "../memory/memoryHierarchy";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MemoryRelationKind = "supports" | "contradicts" | "elaborates" | "supersedes";

export type MemoryRelation = {
  fromId: string;
  toId: string;
  kind: MemoryRelationKind;
  strength: number;         // 0-1
};

export type ConceptualGroup = {
  id: string;
  label: string;
  memberIds: string[];
  centroidTags: string[];
  coherenceScore: number;   // 0-1; average pairwise similarity
};

export type SemanticMemoryReport = {
  totalRelations: number;
  totalGroups: number;
  averageGroupCoherence: number;
  topGroups: Array<{ label: string; memberCount: number; coherence: number }>;
  contradictionCount: number;
  lastComputedAt: number | null;
};

// ── Token extraction ──────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "i", "a", "an", "the", "is", "it", "in", "on", "to", "of", "and", "or",
  "was", "for", "do", "my", "me", "we", "you", "he", "she", "they", "be",
  "have", "has", "had", "am", "are", "were", "been", "at", "by", "with",
  "this", "that", "from", "as", "not", "but", "so", "up", "if", "out",
]);

function extractTokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

// ── Similarity ─────────────────────────────────────────────────────────────────

export function computeSemanticSimilarity(a: string, b: string): number {
  const tokA = extractTokens(a);
  const tokB = extractTokens(b);

  if (tokA.size === 0 || tokB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokA) { if (tokB.has(t)) intersection++; }

  // Jaccard similarity
  const union = tokA.size + tokB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export function deduplicateMemories(
  candidates: Array<{ id: string; content: string }>,
  threshold = 0.7,
): Array<{ id: string; content: string }> {
  const kept: Array<{ id: string; content: string }> = [];

  for (const candidate of candidates) {
    const isDuplicate = kept.some(
      (k) => computeSemanticSimilarity(k.content, candidate.content) >= threshold,
    );
    if (!isDuplicate) kept.push(candidate);
  }

  return kept;
}

// ── Contradiction detection ───────────────────────────────────────────────────

const CONTRADICTION_ANTONYMS: Array<[string, string]> = [
  ["always exercise", "never exercise"],
  ["sleep well", "poor sleep"],
  ["high stress", "low stress"],
  ["motivated", "unmotivated"],
  ["losing weight", "gaining weight"],
  ["healthy eating", "poor diet"],
  ["consistently", "inconsistently"],
  ["improving", "declining"],
];

export function detectContradictions(
  entries: Array<{ id: string; content: string }>,
): MemoryRelation[] {
  const relations: MemoryRelation[] = [];

  for (let i = 0; i < entries.length && relations.length < 20; i++) {
    for (let j = i + 1; j < entries.length && relations.length < 20; j++) {
      const a = entries[i].content.toLowerCase();
      const b = entries[j].content.toLowerCase();

      for (const [termA, termB] of CONTRADICTION_ANTONYMS) {
        const aHasA = a.includes(termA);
        const aHasB = a.includes(termB);
        const bHasA = b.includes(termA);
        const bHasB = b.includes(termB);

        if ((aHasA && bHasB) || (aHasB && bHasA)) {
          relations.push({
            fromId: entries[i].id,
            toId: entries[j].id,
            kind: "contradicts",
            strength: 0.8,
          });
          break;
        }
      }
    }
  }

  return relations;
}

// ── Conceptual grouping ───────────────────────────────────────────────────────

const CONCEPT_ANCHORS: Array<{ label: string; keywords: string[] }> = [
  { label: "sleep", keywords: ["sleep", "rest", "tired", "night", "insomnia", "wake"] },
  { label: "stress", keywords: ["stress", "anxious", "overwhelmed", "pressure", "tension"] },
  { label: "exercise", keywords: ["exercise", "gym", "workout", "run", "walk", "steps", "fitness"] },
  { label: "nutrition", keywords: ["food", "eat", "meal", "calories", "diet", "nutrition"] },
  { label: "motivation", keywords: ["motivation", "goal", "plan", "want", "progress", "achieve"] },
  { label: "mood", keywords: ["mood", "feel", "emotion", "happy", "sad", "joy", "frustrated"] },
  { label: "weight", keywords: ["weight", "lbs", "kg", "bmi", "body"] },
  { label: "burnout", keywords: ["burnout", "exhausted", "recovery", "overworked", "depleted"] },
];

export function groupByConceptualSimilarity(
  entries: Array<{ id: string; content: string; semanticTags?: string[] }>,
): ConceptualGroup[] {
  const groups: Map<string, ConceptualGroup> = new Map();
  const capped = entries.slice(0, 100);

  for (const entry of capped) {
    const contentLower = entry.content.toLowerCase();
    let assignedGroup: string | null = null;
    let maxScore = 0;

    for (const anchor of CONCEPT_ANCHORS) {
      const score = anchor.keywords.filter((k) => contentLower.includes(k)).length / anchor.keywords.length;
      if (score > maxScore && score > 0) {
        maxScore = score;
        assignedGroup = anchor.label;
      }
    }

    if (!assignedGroup) assignedGroup = "general";

    if (!groups.has(assignedGroup)) {
      groups.set(assignedGroup, {
        id: `cg-${assignedGroup}`,
        label: assignedGroup,
        memberIds: [],
        centroidTags: entry.semanticTags ?? [],
        coherenceScore: 0,
      });
    }
    groups.get(assignedGroup)!.memberIds.push(entry.id);
  }

  // Compute coherence score for each group
  for (const group of groups.values()) {
    if (group.memberIds.length < 2) { group.coherenceScore = 1; continue; }
    const members = capped.filter((e) => group.memberIds.includes(e.id));
    let totalSim = 0;
    let pairs = 0;
    for (let i = 0; i < Math.min(members.length, 5); i++) {
      for (let j = i + 1; j < Math.min(members.length, 5); j++) {
        totalSim += computeSemanticSimilarity(members[i].content, members[j].content);
        pairs++;
      }
    }
    group.coherenceScore = pairs > 0 ? totalSim / pairs : 0;
  }

  return [...groups.values()].sort((a, b) => b.memberIds.length - a.memberIds.length);
}

// ── Memory relation graph ─────────────────────────────────────────────────────

export function buildMemoryRelationGraph(
  entries: MemoryEntry[],
): MemoryRelation[] {
  const relations: MemoryRelation[] = [];
  const capped = entries.slice(0, 50);

  // Detect contradictions
  const contradictions = detectContradictions(capped);
  relations.push(...contradictions);

  // Detect "elaborates" — high similarity but not identical
  for (let i = 0; i < capped.length && relations.length < 20; i++) {
    for (let j = i + 1; j < capped.length && relations.length < 20; j++) {
      const sim = computeSemanticSimilarity(capped[i].content, capped[j].content);
      if (sim > 0.4 && sim < 0.7) {
        relations.push({
          fromId: capped[j].id,
          toId: capped[i].id,
          kind: capped[i].accessCount > capped[j].accessCount ? "supports" : "elaborates",
          strength: sim,
        });
      }
    }
  }

  return relations.slice(0, 20);
}

// ── State + report ─────────────────────────────────────────────────────────────

let _lastReport: SemanticMemoryReport = {
  totalRelations: 0,
  totalGroups: 0,
  averageGroupCoherence: 0,
  topGroups: [],
  contradictionCount: 0,
  lastComputedAt: null,
};

export function computeSemanticMemoryReport(entries: MemoryEntry[]): SemanticMemoryReport {
  const relations = buildMemoryRelationGraph(entries);
  const groups = groupByConceptualSimilarity(entries);
  const contradictions = relations.filter((r) => r.kind === "contradicts");
  const avgCoherence = groups.length > 0
    ? groups.reduce((sum, g) => sum + g.coherenceScore, 0) / groups.length
    : 0;

  _lastReport = {
    totalRelations: relations.length,
    totalGroups: groups.length,
    averageGroupCoherence: avgCoherence,
    topGroups: groups.slice(0, 4).map((g) => ({
      label: g.label,
      memberCount: g.memberIds.length,
      coherence: g.coherenceScore,
    })),
    contradictionCount: contradictions.length,
    lastComputedAt: Date.now(),
  };

  return _lastReport;
}

export function getSemanticMemoryReport(): SemanticMemoryReport {
  return { ..._lastReport };
}
