// Reflection Engine — periodic internal self-analysis of the AI's cognitive state.
//
// This is NOT chain-of-thought exposure. This is internal reflective cognition:
// the AI auditing its own understanding of the user, detecting drift, and
// synthesizing long-term observations into compact working hypotheses.
//
// Reflection runs on a schedule, not on every inference. It operates on:
//   - The current user model (high-confidence dimensions)
//   - Recent memory hierarchy snapshots
//   - Active and recently resolved goals
//   - Emotional continuity history
//   - Unresolved topic accumulation
//
// Output: ReflectionEntry stored to Tier 5 (Reflective Memory) via memoryHierarchy.
//
// Guards: never runs more than once per hour; skip if insufficient evidence.

import { getActiveGoals, getEmotionalState, getUnresolvedTopics, getRecentTraces } from "./cognitiveStateEngine";
import { retrieveMemory, writeMemory } from "../memory/memoryHierarchy";
import { getUserModelReport, getContradictoryDimensions } from "./userModel";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReflectionKind =
  | "progress_synthesis"
  | "contradiction_resolution"
  | "stalled_goal_detection"
  | "motivational_drift"
  | "struggle_pattern"
  | "engagement_shift";

export type ReflectionEntry = {
  id: string;
  kind: ReflectionKind;
  summary: string;             // compact insight (≤200 chars)
  evidenceBasis: string[];     // IDs of memory entries that informed this
  confidence: number;          // 0-1
  generatedAt: number;
  validUntilMs: number;        // TTL — reflection expires and gets regenerated
};

export type ReflectionReport = {
  totalReflections: number;
  lastReflectionAt: number | null;
  nextEligibleAt: number | null;
  recentReflections: Array<{ kind: string; summary: string; generatedAt: number }>;
  skippedReason: string | null;
};

// ── State ──────────────────────────────────────────────────────────────────────

const REFLECTION_STORAGE_KEY = "ai_reflections_v1";
const MIN_REFLECTION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour minimum between runs
const REFLECTION_TTL_MS = 24 * 60 * 60 * 1000;     // reflections valid for 24h
const MIN_EVIDENCE_THRESHOLD = 3;                    // need ≥3 memory items to reflect

let _lastReflectionAt: number | null = null;
let _reflectionIdCounter = 0;
let _skippedReason: string | null = null;

function nextReflectionId(): string {
  return `ref-${Date.now()}-${_reflectionIdCounter++}`;
}

// ── Persistence ────────────────────────────────────────────────────────────────

function loadReflections(): ReflectionEntry[] {
  try { return JSON.parse(localStorage.getItem(REFLECTION_STORAGE_KEY) ?? "[]") as ReflectionEntry[]; }
  catch { return []; }
}

function saveReflections(entries: ReflectionEntry[]): void {
  try { localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(entries)); } catch { /* */ }
}

// ── Reflection generators ──────────────────────────────────────────────────────

function synthesizeProgress(): ReflectionEntry | null {
  const goals = getActiveGoals();
  const memories = retrieveMemory({ domain: "milestone", minSalience: 0.5, limit: 5 });
  if (goals.length === 0 && memories.length === 0) return null;

  const goalsInProgress = goals.filter((g) => g.progress > 0.1 && g.progress < 0.9);
  const completedCount = goals.filter((g) => g.progress >= 0.9).length;

  let summary = "";
  if (completedCount > 0) {
    summary = `${completedCount} goal(s) near completion. `;
  }
  if (goalsInProgress.length > 0) {
    summary += `Active focus: ${goalsInProgress[0].description.slice(0, 80)}.`;
  } else if (memories.length > 0) {
    summary += `Recent milestone detected in memory layer.`;
  }

  if (!summary.trim()) return null;

  return {
    id: nextReflectionId(),
    kind: "progress_synthesis",
    summary: summary.trim().slice(0, 200),
    evidenceBasis: memories.map((m) => m.id),
    confidence: 0.65,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

function detectContradictions(): ReflectionEntry | null {
  const contradictory = getContradictoryDimensions();
  if (contradictory.length === 0) return null;

  const dims = contradictory.map((d) => d.dimension).join(", ");
  const summary = `Contradictory signals in: ${dims}. Confidence reduced — monitor before acting on these dimensions.`;

  return {
    id: nextReflectionId(),
    kind: "contradiction_resolution",
    summary: summary.slice(0, 200),
    evidenceBasis: [],
    confidence: 0.5,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

function detectStalledGoals(): ReflectionEntry | null {
  const goals = getActiveGoals();
  const now = Date.now();
  const STALL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days with no progress

  const stalled = goals.filter((g) =>
    g.progress < 0.15 && now - g.lastUpdatedAt > STALL_THRESHOLD_MS
  );
  if (stalled.length === 0) return null;

  const summary = `Goal "${stalled[0].description.slice(0, 60)}" has stalled. Consider re-scoping or deprioritizing.`;

  return {
    id: nextReflectionId(),
    kind: "stalled_goal_detection",
    summary: summary.slice(0, 200),
    evidenceBasis: [],
    confidence: 0.7,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

function detectMotivationalDrift(): ReflectionEntry | null {
  const userReport = getUserModelReport();
  const motivation = userReport.dimensions.find((d) => d.dimension === "motivation_level");
  if (!motivation || motivation.confidence < 0.4) return null;

  if (motivation.trend !== "declining" || motivation.value > 0.45) return null;

  const summary = `Motivation trending downward (${Math.round(motivation.value * 100)}%). Consider reducing goal load or celebrating recent effort.`;

  return {
    id: nextReflectionId(),
    kind: "motivational_drift",
    summary: summary.slice(0, 200),
    evidenceBasis: [],
    confidence: motivation.confidence,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

function detectStrugglePattern(): ReflectionEntry | null {
  const struggles = retrieveMemory({ domain: "struggle", minSalience: 0.4, limit: 4 });
  if (struggles.length < 2) return null;

  const unresolved = getUnresolvedTopics();
  const summary = `${struggles.length} struggle memories accumulated${unresolved.length > 0 ? ` + ${unresolved.length} unresolved topic(s)` : ""}. Pattern may indicate systemic barrier.`;

  return {
    id: nextReflectionId(),
    kind: "struggle_pattern",
    summary: summary.slice(0, 200),
    evidenceBasis: struggles.map((m) => m.id),
    confidence: 0.55,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

function detectEngagementShift(): ReflectionEntry | null {
  const traces = getRecentTraces(8);
  if (traces.length < 5) return null;

  const qualityScores = traces.map((t) => (t.responseQuality === "high" ? 1 : t.responseQuality === "medium" ? 0.5 : 0));
  const recentAvg = qualityScores.slice(-3).reduce((s: number, v) => s + v, 0) / 3;
  const olderAvg = qualityScores.slice(0, 3).reduce((s: number, v) => s + v, 0) / 3;
  const delta = recentAvg - olderAvg;

  if (Math.abs(delta) < 0.2) return null;

  const direction = delta > 0 ? "improving" : "declining";
  const summary = `Inference response quality ${direction} over last 3 exchanges (Δ=${delta > 0 ? "+" : ""}${Math.round(delta * 100)}%). Engagement is shifting.`;

  return {
    id: nextReflectionId(),
    kind: "engagement_shift",
    summary: summary.slice(0, 200),
    evidenceBasis: [],
    confidence: 0.5,
    generatedAt: Date.now(),
    validUntilMs: Date.now() + REFLECTION_TTL_MS,
  };
}

// ── Main reflection cycle ─────────────────────────────────────────────────────

export function runReflectionCycle(): ReflectionEntry[] {
  const now = Date.now();

  // Rate limit
  if (_lastReflectionAt && now - _lastReflectionAt < MIN_REFLECTION_INTERVAL_MS) {
    _skippedReason = "rate_limited";
    return [];
  }

  // Evidence gate
  const evidence = retrieveMemory({ maxTier: 5, minSalience: 0.3, limit: 20 });
  if (evidence.length < MIN_EVIDENCE_THRESHOLD) {
    _skippedReason = "insufficient_evidence";
    return [];
  }

  _skippedReason = null;
  _lastReflectionAt = now;

  const generated: ReflectionEntry[] = [];
  const generators = [
    synthesizeProgress,
    detectContradictions,
    detectStalledGoals,
    detectMotivationalDrift,
    detectStrugglePattern,
    detectEngagementShift,
  ];

  for (const gen of generators) {
    try {
      const entry = gen();
      if (entry) generated.push(entry);
    } catch { /* isolate individual generator failures */ }
  }

  if (generated.length === 0) return [];

  // Persist reflections
  const existing = loadReflections();
  const fresh = existing.filter((r) => r.validUntilMs > now); // purge expired
  const updated = [...fresh, ...generated].slice(-20); // keep last 20
  saveReflections(updated);

  // Write highest-confidence reflections to Tier 5 (Reflective Memory)
  for (const r of generated.filter((r) => r.confidence >= 0.6)) {
    writeMemory(5, `[Reflection:${r.kind}] ${r.summary}`, {
      domain: "synthesis",
      salience: r.confidence,
      confidence: r.confidence,
      source: "reflectionEngine",
    });
  }

  emitCognitionEvent("reflection_generated", {
    count: generated.length,
    kinds: generated.map((r) => r.kind),
  });

  return generated;
}

// ── Retrieval ──────────────────────────────────────────────────────────────────

export function getActiveReflections(): ReflectionEntry[] {
  const now = Date.now();
  return loadReflections().filter((r) => r.validUntilMs > now);
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getReflectionReport(): ReflectionReport {
  const all = loadReflections();
  const now = Date.now();
  const active = all.filter((r) => r.validUntilMs > now);

  const nextEligible = _lastReflectionAt
    ? _lastReflectionAt + MIN_REFLECTION_INTERVAL_MS
    : null;

  return {
    totalReflections: all.length,
    lastReflectionAt: _lastReflectionAt,
    nextEligibleAt: nextEligible && nextEligible > now ? nextEligible : null,
    recentReflections: active.slice(-5).map((r) => ({
      kind: r.kind,
      summary: r.summary,
      generatedAt: r.generatedAt,
    })),
    skippedReason: _skippedReason,
  };
}
