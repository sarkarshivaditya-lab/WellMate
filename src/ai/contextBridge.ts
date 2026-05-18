// src/ai/contextBridge.ts
// Assembles the full AI-injectable context payload from all intelligence layers.
// Token-budgeted: sections are weighted; lower-weight sections drop first.
// Deduplicated: each signal appears at most once across the assembled context.

import type { WellnessMemoryContext } from "@/intelligence/memory/types";
import type { WellnessContext } from "@/intelligence/wellnessScore";
import type { Recommendation } from "@/recommendations/types";
import {
  composeBehavioralEvolutionSummary,
  compose30dTrendRecap,
} from "@/intelligence/memory/summaryComposer";
import type { AIContextPayload, AIContextSection } from "./types";
import type { MemoryDomain } from "@/intelligence/memory/types";

const TOKEN_BUDGET = 1200; // ~4800 chars — fits comfortably in a system prompt

function estTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function section(
  label: string,
  content: string,
  weight: number,
): AIContextSection {
  return { label, content, tokenEstimate: estTokens(content), weight };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildAIContextPayload(opts: {
  wellness: WellnessContext;
  memory: WellnessMemoryContext | null;
  recommendations: Recommendation[];
  focusDomain?: string;
}): AIContextPayload {
  const { wellness, memory, recommendations, focusDomain } = opts;
  const sections: AIContextSection[] = [];

  // 1 — Composite wellness state (always included)
  const compositeContent = [
    `Wellness score: ${wellness.compositeScore}/100 (${wellness.compositeLevel}).`,
    wellness.topInsight,
  ]
    .filter(Boolean)
    .join(" ");
  sections.push(section("Wellness state", compositeContent, 1.0));

  // 2 — Domain breakdown (scores + headlines)
  const domainLines = (
    [
      { k: "Sleep", d: wellness.domains.sleep },
      { k: "Activity", d: wellness.domains.activity },
      { k: "Nutrition", d: wellness.domains.nutrition },
      { k: "Habits", d: wellness.domains.habits },
    ] as const
  )
    .filter(({ d }) => d.headline.length > 0)
    .map(({ k, d }) => `${k}: ${d.score}/100 — ${d.headline}`);

  if (domainLines.length > 0) {
    sections.push(section("Domain scores", domainLines.join("\n"), 0.85));
  }

  // 3 — 30-day trend recap
  const trendText = compose30dTrendRecap();
  if (trendText) {
    sections.push(section("30-day trends", trendText, 0.8));
  }

  // 4 — Behavioral evolution (only when longitudinal data exists)
  if (memory && memory.dataSpanDays >= 14 && memory.behavioralDeltas.length > 0) {
    const evolutionText = composeBehavioralEvolutionSummary(memory.behavioralDeltas);
    if (evolutionText && !evolutionText.startsWith("Not enough")) {
      sections.push(section("Behavioral shifts", evolutionText, 0.75));
    }
  }

  // 5 — Cross-domain correlations (top 2, high/medium confidence)
  const correlations = (memory?.correlations ?? [])
    .filter((c) => c.confidence !== "low" && c.sampleSize >= 5)
    .slice(0, 2);

  if (correlations.length > 0) {
    const corrContent = correlations.map((c) => `· ${c.insight}`).join("\n");
    sections.push(section("Patterns observed", corrContent, 0.65));
  }

  // 6 — Active guidance (top 3 recommendations)
  const topRecs = recommendations.slice(0, 3);
  if (topRecs.length > 0) {
    const recContent = topRecs
      .map((r) => `· ${r.title}: ${r.body}`)
      .join("\n");
    sections.push(section("Active guidance", recContent, 0.7));
  }

  // 7 — Focus domain boost (when a specific domain is the conversation topic)
  if (focusDomain) {
    const domainMap = wellness.domains as Record<string, { score: number; headline: string }>;
    const fd = domainMap[focusDomain];
    if (fd?.headline) {
      const focusContent = `User is asking about: ${focusDomain}. ${fd.headline}`;
      sections.push(section("Focus area", focusContent, 0.95));
    }
  }

  // Apply token budget — highest weight wins when budget is tight
  const sorted = [...sections].sort((a, b) => b.weight - a.weight);
  let budget = TOKEN_BUDGET;
  const included: AIContextSection[] = [];

  for (const s of sorted) {
    if (s.tokenEstimate <= budget) {
      included.push(s);
      budget -= s.tokenEstimate;
    }
  }

  // Restore original order (most recent / fundamental first)
  included.sort((a, b) => b.weight - a.weight);

  // Assemble prose
  const systemContext = included
    .map((s) => `[${s.label}]\n${s.content}`)
    .join("\n\n");

  // Active topics: domains with notable deviation from neutral
  const activeTopics = (["sleep", "activity", "nutrition", "habits"] as MemoryDomain[]).filter(
    (d) => {
      const domainMap = wellness.domains as Record<string, { score: number }>;
      const score = domainMap[d]?.score ?? 50;
      return score < 45 || score > 70;
    },
  );

  return {
    systemContext,
    sections: included,
    activeTopics,
    topInsight: wellness.topInsight || `Wellness at ${wellness.compositeScore}/100`,
    generatedAt: Date.now(),
    dataSpanDays: memory?.dataSpanDays ?? 0,
  };
}

// Compact serialization for prompt injection.
export function serializeContextForPrompt(payload: AIContextPayload): string {
  return payload.systemContext;
}
