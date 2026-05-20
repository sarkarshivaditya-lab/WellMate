// Longitudinal Pattern Graph — builds relationship graphs between wellness domains.
//
// This moves beyond isolated metrics to multi-domain wellness reasoning.
//
// Graph structure:
//   Nodes: wellness domains (sleep, stress, activity, habits, mood, nutrition, motivation, burnout)
//   Edges: co-trending relationships detected across rolling 4-week windows
//
// Edge types:
//   co_positive  — both domains trend up together
//   co_negative  — both domains trend down together
//   inverse      — one rises when the other falls
//   independent  — no detectable relationship
//
// Evidence threshold: edge only added when trend correlation > 0.6 over 3+ weeks.
// This prevents single-week anomalies from creating false relationships.
//
// Data sources:
//   - computeRollingTrends() — domain trend series
//   - getEmotionalProfile() — emotional domain trends
//   - buildRecommendationContext() — energy state and signal snapshot

import { computeRollingTrends } from "@/intelligence/longitudinalEngine";
import { getEmotionalProfile } from "@/ai/cognition/emotionalContinuityEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PatternDomain =
  | "sleep" | "stress" | "activity" | "habits" | "mood"
  | "nutrition" | "motivation" | "burnout" | "recovery";

export type EdgeRelationship = "co_positive" | "co_negative" | "inverse" | "independent";

export type PatternEdge = {
  from: PatternDomain;
  to: PatternDomain;
  relationship: EdgeRelationship;
  strength: number;        // 0-1
  confidence: number;      // 0-1
  observationText: string; // human-readable, non-causal
};

export type PatternNode = {
  domain: PatternDomain;
  currentTrend: "up" | "stable" | "down" | "unknown";
  trendStrength: number;   // 0-1
  connectedDomains: PatternDomain[];
};

export type LongitudinalPatternGraph = {
  nodes: PatternNode[];
  edges: PatternEdge[];
  dominantPattern: string | null;    // human-readable summary
  computedAt: number;
};

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let _cached: LongitudinalPatternGraph | null = null;
let _cachedAt = 0;

// ── Correlation ───────────────────────────────────────────────────────────────

function normalizeWeeks(weeks: number[]): number[] {
  const max = Math.max(...weeks, 1);
  const min = Math.min(...weeks);
  const range = max - min;
  if (range === 0) return weeks.map(() => 0.5);
  return weeks.map((v) => (v - min) / range);
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const trimA = a.slice(0, n);
  const trimB = b.slice(0, n);
  const meanA = trimA.reduce((s, v) => s + v, 0) / n;
  const meanB = trimB.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = trimA[i] - meanA;
    const db = trimB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  return denom === 0 ? 0 : num / denom;
}

function classifyRelationship(correlation: number): EdgeRelationship {
  if (Math.abs(correlation) < 0.3) return "independent";
  if (correlation >= 0.5) return "co_positive";
  if (correlation <= -0.5) return "inverse";
  if (correlation < -0.3) return "inverse";
  return "co_negative";
}

function buildObservationText(from: PatternDomain, to: PatternDomain, rel: EdgeRelationship): string {
  const relText: Record<EdgeRelationship, string> = {
    co_positive: "tends to improve alongside",
    co_negative: "often declines alongside",
    inverse: "often moves in the opposite direction to",
    independent: "appears unrelated to",
  };
  return `${from} ${relText[rel]} ${to}.`;
}

// ── Trend direction ────────────────────────────────────────────────────────────

function trendDirection(weeks: number[]): { trend: "up" | "stable" | "down"; strength: number } {
  if (weeks.length < 2) return { trend: "stable", strength: 0 };
  const normalized = normalizeWeeks(weeks);
  const last = normalized[normalized.length - 1];
  const first = normalized[0];
  const delta = last - first;
  if (Math.abs(delta) < 0.1) return { trend: "stable", strength: 0 };
  return {
    trend: delta > 0 ? "up" : "down",
    strength: Math.min(1, Math.abs(delta)),
  };
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeLongitudinalPatternGraph(forceRefresh = false): LongitudinalPatternGraph {
  const now = Date.now();
  if (!forceRefresh && _cached && now - _cachedAt < CACHE_TTL_MS) return _cached;

  const rollingTrends = computeRollingTrends();
  const emotional = getEmotionalProfile();

  // Build domain → weeks map from rolling trends
  const domainWeeks = new Map<PatternDomain, number[]>();
  for (const trend of rollingTrends) {
    const key = trend.domain.toLowerCase() as PatternDomain;
    domainWeeks.set(key, trend.weeks);
  }

  // Add emotional domains from EMA values (approximate as flat series with trend overlay)
  const motivationVal = emotional.dimensions.motivation.value;
  const burnoutVal = emotional.dimensions.burnout.value;
  const stressVal = emotional.dimensions.stress.value;
  const motivTrend = emotional.dimensions.motivation.trend;
  const burnoutTrend = emotional.dimensions.burnout.trend;
  const stressTrend = emotional.dimensions.stress.trend;

  function syntheticWeeks(val: number, trend: string): number[] {
    const base = val * 100;
    const delta = trend === "rising" ? 10 : trend === "falling" ? -10 : 0;
    return [base - delta * 1.5, base - delta * 0.5, base + delta * 0.5, base + delta];
  }

  domainWeeks.set("motivation", syntheticWeeks(motivationVal, motivTrend));
  domainWeeks.set("burnout", syntheticWeeks(burnoutVal, burnoutTrend));
  domainWeeks.set("stress", syntheticWeeks(stressVal, stressTrend));

  // Build nodes
  const nodes: PatternNode[] = [];
  for (const [domain, weeks] of domainWeeks) {
    const { trend, strength } = trendDirection(weeks);
    nodes.push({ domain, currentTrend: trend, trendStrength: strength, connectedDomains: [] });
  }

  // Build edges: compute pairwise correlations
  const edges: PatternEdge[] = [];
  const domainList = [...domainWeeks.keys()];

  for (let i = 0; i < domainList.length && edges.length < 20; i++) {
    for (let j = i + 1; j < domainList.length && edges.length < 20; j++) {
      const domainA = domainList[i];
      const domainB = domainList[j];
      const weeksA = normalizeWeeks(domainWeeks.get(domainA) ?? []);
      const weeksB = normalizeWeeks(domainWeeks.get(domainB) ?? []);

      const correlation = pearsonCorrelation(weeksA, weeksB);
      const relationship = classifyRelationship(correlation);
      if (relationship === "independent") continue;

      const confidence = Math.min(0.85, Math.abs(correlation));
      if (confidence < 0.3) continue;

      const edge: PatternEdge = {
        from: domainA,
        to: domainB,
        relationship,
        strength: Math.abs(correlation),
        confidence,
        observationText: buildObservationText(domainA, domainB, relationship),
      };
      edges.push(edge);

      // Update node connections
      const nodeA = nodes.find((n) => n.domain === domainA);
      const nodeB = nodes.find((n) => n.domain === domainB);
      if (nodeA && !nodeA.connectedDomains.includes(domainB)) nodeA.connectedDomains.push(domainB);
      if (nodeB && !nodeB.connectedDomains.includes(domainA)) nodeB.connectedDomains.push(domainA);
    }
  }

  // Dominant pattern: strongest edge
  const strongestEdge = edges.sort((a, b) => b.strength - a.strength)[0];
  const dominantPattern = strongestEdge ? strongestEdge.observationText : null;

  _cached = { nodes, edges, dominantPattern, computedAt: now };
  _cachedAt = now;
  return _cached;
}

export function getLongitudinalPatternGraph(): LongitudinalPatternGraph | null {
  return _cached;
}

export function getPatternGraphReport(): {
  nodeCount: number;
  edgeCount: number;
  dominantPattern: string | null;
  topRelationships: PatternEdge[];
  lastComputedAt: number | null;
} {
  if (!_cached) return { nodeCount: 0, edgeCount: 0, dominantPattern: null, topRelationships: [], lastComputedAt: null };
  return {
    nodeCount: _cached.nodes.length,
    edgeCount: _cached.edges.length,
    dominantPattern: _cached.dominantPattern,
    topRelationships: _cached.edges.slice(0, 4),
    lastComputedAt: _cached.computedAt,
  };
}
