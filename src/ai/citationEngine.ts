// src/ai/citationEngine.ts
// Builds traceable citations from behavioral and longitudinal data.
// Citations are the evidence layer that grounds AI recommendations.

import type {
  BehavioralDelta,
  LongitudinalCorrelation,
  WellnessMemoryContext,
  MemoryDomain,
} from "@/intelligence/memory/types";
import type { WellnessContext } from "@/intelligence/wellnessScore";
import type { Citation, ConfidenceLevel } from "./types";

// ConfidenceLevel re-exported for convenience; imported from types above
type _ConfidenceLevel = ConfidenceLevel; // used below to satisfy stricter inference

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Score citations ───────────────────────────────────────────────────────────

export function buildScoreCitations(wellness: WellnessContext): Citation[] {
  const pairs = [
    { domain: "sleep" as MemoryDomain, data: wellness.domains.sleep },
    { domain: "activity" as MemoryDomain, data: wellness.domains.activity },
    { domain: "nutrition" as MemoryDomain, data: wellness.domains.nutrition },
    { domain: "habits" as MemoryDomain, data: wellness.domains.habits },
  ] as const;

  return pairs
    .filter(({ data }) => data.headline.length > 0)
    .map(({ domain, data }) => {
      const confidence: _ConfidenceLevel =
        data.score >= 65 ? "high" : data.score >= 42 ? "medium" : "low";
      return {
        id: `score_${domain}_${uid()}`,
        type: "score" as const,
        domain,
        text: `${domain.charAt(0).toUpperCase() + domain.slice(1)}: ${data.score}/100 — ${data.headline}`,
        confidence,
        windowDays: 30,
        dataPoints: 1,
      };
    });
}

// ── Behavioral citations ──────────────────────────────────────────────────────

export function buildBehavioralCitations(deltas: BehavioralDelta[]): Citation[] {
  return deltas
    .filter((d) => d.direction !== "stable" && d.confidence !== "low")
    .map((d) => ({
      id: `behavioral_${d.domain}_${uid()}`,
      type: "behavioral" as const,
      domain: d.domain,
      text: d.observation,
      confidence: d.confidence,
      windowDays: 30,
      dataPoints: 1,
    }));
}

// ── Correlation citations ─────────────────────────────────────────────────────

export function buildCorrelationCitations(
  correlations: LongitudinalCorrelation[],
): Citation[] {
  return correlations
    .filter((c) => c.confidence !== "low" && c.sampleSize >= 5)
    .slice(0, 3)
    .map((c) => ({
      id: `corr_${c.domainA}_${c.domainB}_${uid()}`,
      type: "correlation" as const,
      domain: c.domainA,
      text: c.insight,
      confidence: c.confidence,
      windowDays: c.windowDays,
      dataPoints: c.sampleSize,
    }));
}

// ── Composite builder ─────────────────────────────────────────────────────────
// Merges all citation sources, deduplicating by domain (highest confidence wins).

export function buildAllCitations(
  memory: WellnessMemoryContext | null,
  wellness: WellnessContext,
): Citation[] {
  const all: Citation[] = [
    ...buildScoreCitations(wellness),
    ...buildBehavioralCitations(memory?.behavioralDeltas ?? []),
    ...buildCorrelationCitations(memory?.correlations ?? []),
  ];

  const byDomain = new Map<string, Citation>();
  const rank: Record<_ConfidenceLevel, number> = { high: 2, medium: 1, low: 0 };

  for (const c of all) {
    const key = `${c.type}_${c.domain}`;
    const existing = byDomain.get(key);
    if (!existing || rank[c.confidence] > rank[existing.confidence]) {
      byDomain.set(key, c);
    }
  }

  return Array.from(byDomain.values());
}
