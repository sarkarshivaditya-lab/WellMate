// src/ai/conversationalPrimitives.ts
// Generates grounded follow-up prompts from wellness signals.
// These are the conversation entry points seeded throughout the UI.
// All prompts are observational, calm, non-prescriptive.

import type { Recommendation, RecommendationCategory } from "@/recommendations/types";
import type { WellnessContext } from "@/intelligence/wellnessScore";
import type { WellnessMemoryContext, MemoryDomain } from "@/intelligence/memory/types";
import type { FollowUpPrompt } from "./types";

function pid(prefix: string, suffix: string): string {
  return `${prefix}_${suffix}`;
}

// Map recommendation category → memory domain
const CATEGORY_TO_DOMAIN: Record<RecommendationCategory, MemoryDomain | "composite"> = {
  sleep: "sleep",
  recovery: "activity",
  pacing: "activity",
  activity: "activity",
  hydration: "nutrition",
  mood: "mood",
  reflection: "mood",
  stress_management: "mood",
  habits: "habits",
  consistency: "habits",
  stabilization: "composite",
};

// ── Recommendation follow-ups ─────────────────────────────────────────────────

export function generateRecommendationFollowUps(
  rec: Recommendation,
): FollowUpPrompt[] {
  const domain = CATEGORY_TO_DOMAIN[rec.category] ?? "composite";
  const categoryLabel = rec.category.replace(/_/g, " ");
  const prompts: FollowUpPrompt[] = [];

  prompts.push({
    id: pid(rec.id, "explore"),
    text: `Tell me more about my ${categoryLabel}`,
    domain,
    category: "what",
    grounding: rec.explainability.reason || undefined,
  });

  if (rec.trend === "negative") {
    prompts.push({
      id: pid(rec.id, "improve"),
      text: `How can I improve my ${categoryLabel}?`,
      domain,
      category: "how",
    });
  }

  if (rec.explainability.contributingSignals.length > 0) {
    prompts.push({
      id: pid(rec.id, "why"),
      text: "What's driving this pattern?",
      domain,
      category: "why",
      grounding: rec.explainability.contributingSignals.slice(0, 2).join(". "),
    });
  }

  return prompts;
}

// ── Score-level follow-ups ────────────────────────────────────────────────────

export function generateScoreFollowUps(wellness: WellnessContext): FollowUpPrompt[] {
  const domains = [
    { key: "sleep" as const, data: wellness.domains.sleep },
    { key: "activity" as const, data: wellness.domains.activity },
    { key: "nutrition" as const, data: wellness.domains.nutrition },
    { key: "habits" as const, data: wellness.domains.habits },
  ].filter(({ data }) => data.headline.length > 0);

  const sorted = [...domains].sort((a, b) => a.data.score - b.data.score);
  const prompts: FollowUpPrompt[] = [];

  const weakest = sorted[0];
  if (weakest && weakest.data.score < 65) {
    prompts.push({
      id: `score_focus_${weakest.key}`,
      text: `What can I do about my ${weakest.key}?`,
      domain: weakest.key,
      category: "how",
      grounding: weakest.data.headline,
    });
  }

  const strongest = sorted[sorted.length - 1];
  if (strongest && strongest.data.score >= 70 && strongest.key !== weakest?.key) {
    prompts.push({
      id: `score_positive_${strongest.key}`,
      text: `What's going well with my ${strongest.key}?`,
      domain: strongest.key,
      category: "what",
      grounding: strongest.data.headline,
    });
  }

  if (wellness.topInsight) {
    prompts.push({
      id: "score_top_insight",
      text: "What should I focus on this week?",
      domain: "composite",
      category: "what",
      grounding: wellness.topInsight,
    });
  }

  return prompts.slice(0, 3);
}

// ── Memory-grounded follow-ups ────────────────────────────────────────────────

export function generateMemoryFollowUps(memory: WellnessMemoryContext): FollowUpPrompt[] {
  const prompts: FollowUpPrompt[] = [];

  const topNegative = memory.behavioralDeltas
    .filter((d) => d.direction === "down" && d.confidence !== "low")
    .slice(0, 1);

  if (topNegative.length > 0) {
    const d = topNegative[0];
    prompts.push({
      id: `memory_decline_${d.domain}`,
      text: `Why has my ${d.domain} been lower lately?`,
      domain: d.domain,
      category: "why",
      grounding: d.observation,
    });
  }

  const topPositive = memory.behavioralDeltas
    .filter((d) => d.direction === "up" && d.confidence === "high")
    .slice(0, 1);

  if (topPositive.length > 0) {
    const d = topPositive[0];
    prompts.push({
      id: `memory_positive_${d.domain}`,
      text: `How do I keep my ${d.domain} momentum going?`,
      domain: d.domain,
      category: "how",
      grounding: d.observation,
    });
  }

  const topCorrelation = memory.correlations
    .filter((c) => c.confidence !== "low" && c.sampleSize >= 5)
    .slice(0, 1);

  if (topCorrelation.length > 0) {
    const c = topCorrelation[0];
    prompts.push({
      id: `memory_correlation_${c.domainA}_${c.domainB}`,
      text: `How does my ${c.domainA} affect my ${c.domainB}?`,
      domain: c.domainA,
      category: "trend",
      grounding: c.insight,
    });
  }

  return prompts;
}

// ── Domain-specific entry point ───────────────────────────────────────────────
// Used by score cards and domain pages to generate a contextual opening line.

export function generateDomainInvocation(
  domain: MemoryDomain | "composite",
  headline: string,
): string {
  const domainLabel = domain === "composite" ? "my wellness" : `my ${domain}`;
  if (headline) return `Tell me more about ${domainLabel}: ${headline}`;
  return `Tell me more about ${domainLabel}`;
}
