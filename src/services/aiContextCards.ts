// src/ai/contextCards.ts
// Builds composable context cards from longitudinal memory and wellness intelligence.
// Cards are semantic units — each one is a self-contained AI-injectable summary
// of a meaningful wellness observation, grounded in citations.

import type {
  WellnessMemoryContext,
  MemoryEvent,
  MemoryEventType,
  MemoryDomain,
} from "@/intelligence/memory/types";
import type { WellnessContext } from "@/intelligence/wellnessScore";
import type { ContextCard, ContextCardType, Citation } from "./types";
import {
  buildBehavioralCitations,
  buildCorrelationCitations,
} from "./citationEngine";

function cardId(type: ContextCardType, suffix: string): string {
  return `card_${type}_${suffix}`;
}

const EVENT_TYPE_TO_CARD: Partial<Record<MemoryEventType, ContextCardType>> = {
  sleep_stabilization: "sleep_trend",
  sleep_duration_improvement: "sleep_trend",
  sleep_quality_trend: "sleep_trend",
  recovery_improvement: "recovery_state",
  recovery_strain_signal: "recovery_state",
  habit_streak_milestone: "habit_momentum",
  habit_consistency_shift: "habit_momentum",
  nutrition_logging_consistency: "nutrition_pattern",
  mood_stabilization: "mood_pattern",
  mood_elevation_period: "mood_pattern",
  hydration_consistency: "nutrition_pattern",
  activity_increase: "behavioral_shift",
  activity_decrease: "behavioral_shift",
  behavioral_shift: "behavioral_shift",
  wellness_milestone: "milestone",
};

const CARD_FOLLOW_UPS: Record<ContextCardType, string[]> = {
  sleep_trend: [
    "What's affecting my sleep?",
    "How can I improve sleep consistency?",
  ],
  behavioral_shift: [
    "What changed recently?",
    "How do these changes affect my wellbeing?",
  ],
  recovery_state: [
    "How is my recovery looking?",
    "Am I overdoing it with exercise?",
  ],
  mood_pattern: [
    "What's driving my mood patterns?",
    "How can I keep my mood more stable?",
  ],
  habit_momentum: [
    "How are my habits progressing?",
    "Which habits matter most for my goals?",
  ],
  nutrition_pattern: [
    "How is my nutrition affecting my energy?",
    "What should I focus on with food?",
  ],
  milestone: [
    "What milestones have I reached?",
    "What should I aim for next?",
  ],
  correlation: [
    "How are these areas connected?",
    "Tell me more about this pattern",
  ],
};

function eventToCard(event: MemoryEvent): ContextCard | null {
  const cardType = EVENT_TYPE_TO_CARD[event.type];
  if (!cardType) return null;

  const windowDays = Math.max(
    1,
    Math.ceil(
      (new Date(event.windowEnd).getTime() - new Date(event.windowStart).getTime()) /
        86400000,
    ),
  );

  const citation: Citation = {
    id: `event_${event.id}`,
    type: "trend",
    domain: event.domain,
    text: event.detail ?? event.headline,
    confidence: event.confidence,
    windowDays,
    dataPoints: event.supportingSignals.length,
  };

  return {
    id: cardId(cardType, event.domain),
    type: cardType,
    domain: event.domain,
    headline: event.headline,
    detail: event.detail,
    citations: [citation],
    confidence: event.confidence,
    relevance: event.trend === "negative" ? 0.9 : event.trend === "positive" ? 0.7 : 0.5,
    followUps: CARD_FOLLOW_UPS[cardType] ?? [],
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildContextCards(
  memory: WellnessMemoryContext | null,
  _wellness: WellnessContext,
): ContextCard[] {
  if (!memory) return [];

  const cards: ContextCard[] = [];
  const seenIds = new Set<string>();

  // Cards from recent memory events (last 30 days)
  for (const event of memory.recentEvents) {
    const card = eventToCard(event);
    if (!card || seenIds.has(card.id)) continue;
    seenIds.add(card.id);
    cards.push(card);
  }

  // Card from behavioral deltas when multiple domains are declining
  const declining = memory.behavioralDeltas.filter(
    (d) => d.direction === "down" && d.confidence !== "low",
  );
  if (declining.length >= 2) {
    const id = cardId("behavioral_shift", "composite");
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const citations = buildBehavioralCitations(declining);
      cards.push({
        id,
        type: "behavioral_shift",
        domain: "composite",
        headline: `${declining.length} areas slightly below your baseline`,
        detail: declining
          .slice(0, 2)
          .map((d) => d.observation)
          .join(" "),
        citations,
        confidence: "medium",
        relevance: 0.85,
        followUps: CARD_FOLLOW_UPS.behavioral_shift,
      });
    }
  }

  // Card from cross-domain correlations
  const topCorrelations = memory.correlations
    .filter((c) => c.confidence !== "low" && c.sampleSize >= 5)
    .slice(0, 2);

  if (topCorrelations.length > 0) {
    const id = cardId("correlation", "composite");
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const domainA = topCorrelations[0].domainA as MemoryDomain;
      cards.push({
        id,
        type: "correlation",
        domain: domainA,
        headline: topCorrelations[0].insight,
        citations: buildCorrelationCitations(topCorrelations),
        confidence: topCorrelations[0].confidence,
        relevance: 0.6,
        followUps: CARD_FOLLOW_UPS.correlation,
      });
    }
  }

  return cards.sort((a, b) => b.relevance - a.relevance);
}
