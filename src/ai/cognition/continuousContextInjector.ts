// Continuous Context Injector — assembles cognitive state into prompt context.
//
// This is the context layer that makes every prompt "stateful without being verbose."
// It pulls from:
//   - Active cognitive state (attention slots, goals, emotional state)
//   - Emotional continuity (longitudinal user emotion)
//   - Active goal threads (persistent wellness arcs)
//   - User model (stable behavioral traits)
//   - Wellness trajectory (from contextPrioritizer if available)
//
// Enforces strict token ceilings. Critical sections always included.
// Non-critical sections fill remaining budget by salience.

import {
  getTopAttentionSlots,
  getActiveGoals,
  getEmotionalState,
  getUnresolvedTopics,
} from "./cognitiveStateEngine";
import { getCoachingContext } from "./userModel";
import { getActiveGoalThreads } from "./goalThreadTracker";
import { getEmotionalProfile } from "./emotionalContinuityEngine";
import { assembleContext } from "./contextPrioritizer";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ContextSection = {
  name: string;
  content: string;
  tokens: number;
  isCritical: boolean;
  source: string;
};

export type ContextInjection = {
  sections: ContextSection[];
  totalTokens: number;
  budgetTokens: number;
  criticalTokens: number;
  assembledAt: number;
};

export type ContextInjectionReport = {
  lastInjection: ContextInjection | null;
  averageSectionsIncluded: number;
  averageTokensUsed: number;
  criticalSectionNames: string[];
};

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildAttentionSection(): ContextSection | null {
  const slots = getTopAttentionSlots(3);
  if (slots.length === 0) return null;
  const content = "Active focus: " + slots.map((s) => s.content).join("; ");
  return {
    name: "attention_slots",
    content,
    tokens: estimateTokens(content),
    isCritical: false,
    source: "cognitiveStateEngine",
  };
}

function buildGoalsSection(): ContextSection | null {
  const goals = getActiveGoals();
  if (goals.length === 0) return null;
  const content = "Active goals: " + goals.map((g) => `${g.description} (progress: ${Math.round(g.progress * 100)}%)`).join("; ");
  return {
    name: "active_goals",
    content,
    tokens: estimateTokens(content),
    isCritical: true,
    source: "cognitiveStateEngine",
  };
}

function buildEmotionalStateSection(): ContextSection {
  const state = getEmotionalState();
  const profile = getEmotionalProfile();
  const content = `User emotional state: ${state.dominantEmotion} (valence ${state.valence.toFixed(2)}, trend: ${state.trend}). Longitudinal: ${profile.dominantDimension ? `elevated ${profile.dominantDimension}` : "balanced"}.`;
  return {
    name: "emotional_state",
    content,
    tokens: estimateTokens(content),
    isCritical: true,
    source: "emotionalContinuityEngine",
  };
}

function buildUnresolvedTopicsSection(): ContextSection | null {
  const topics = getUnresolvedTopics();
  if (topics.length === 0) return null;
  const content = "Unresolved topics: " + topics.map((t) => t.topic).join("; ");
  return {
    name: "unresolved_topics",
    content,
    tokens: estimateTokens(content),
    isCritical: false,
    source: "cognitiveStateEngine",
  };
}

function buildGoalThreadsSection(): ContextSection | null {
  const threads = getActiveGoalThreads();
  if (threads.length === 0) return null;
  const topThread = threads[0];
  const content = `Long-running wellness arc: "${topThread.name}" — ${Math.round(topThread.progress * 100)}% progress, ${topThread.status}${threads.length > 1 ? `. Also tracking: ${threads.slice(1, 3).map((t) => t.category).join(", ")}` : ""}.`;
  return {
    name: "goal_threads",
    content,
    tokens: estimateTokens(content),
    isCritical: false,
    source: "goalThreadTracker",
  };
}

function buildUserModelSection(): ContextSection | null {
  try {
    const coaching = getCoachingContext();
    if (!coaching) return null;
    const content = `User profile: ${coaching}`;
    return {
      name: "user_model",
      content: content.slice(0, 300),
      tokens: estimateTokens(content.slice(0, 300)),
      isCritical: false,
      source: "userModel",
    };
  } catch {
    return null;
  }
}

function buildWellnessContextSection(budget: number): ContextSection | null {
  try {
    const ctx = assembleContext(budget);
    if (ctx.items.length === 0) return null;
    const topItems = ctx.items.slice(0, 3).map((i) => i.content.slice(0, 100)).join("; ");
    const content = `Wellness context: ${topItems}`;
    return {
      name: "wellness_context",
      content,
      tokens: estimateTokens(content),
      isCritical: false,
      source: "contextPrioritizer",
    };
  } catch {
    return null;
  }
}

// ── Assembly ──────────────────────────────────────────────────────────────────

let _lastInjection: ContextInjection | null = null;
let _totalSectionsIncluded = 0;
let _totalTokensUsed = 0;
let _injectionCount = 0;

export function buildContextInjection(budgetTokens: number): ContextInjection {
  const allSections: ContextSection[] = [];

  // Always-critical sections
  allSections.push(buildEmotionalStateSection());

  const goalsSection = buildGoalsSection();
  if (goalsSection) allSections.push(goalsSection);

  // Optional sections built in priority order
  const optionalBuilders: Array<() => ContextSection | null> = [
    () => buildGoalThreadsSection(),
    () => buildAttentionSection(),
    () => buildUnresolvedTopicsSection(),
    () => buildUserModelSection(),
    () => buildWellnessContextSection(Math.max(100, budgetTokens - 400)),
  ];

  const criticalSections = allSections.filter((s) => s.isCritical);
  const criticalTokens = criticalSections.reduce((sum, s) => sum + s.tokens, 0);
  let remainingBudget = budgetTokens - criticalTokens;

  for (const builder of optionalBuilders) {
    if (remainingBudget <= 30) break;
    const section = builder();
    if (!section) continue;
    if (section.tokens <= remainingBudget) {
      allSections.push(section);
      remainingBudget -= section.tokens;
    }
  }

  const totalTokens = allSections.reduce((sum, s) => sum + s.tokens, 0);

  const injection: ContextInjection = {
    sections: allSections,
    totalTokens,
    budgetTokens,
    criticalTokens,
    assembledAt: Date.now(),
  };

  _lastInjection = injection;
  _totalSectionsIncluded += allSections.length;
  _totalTokensUsed += totalTokens;
  _injectionCount++;

  return injection;
}

export function getCriticalContext(): ContextSection[] {
  return _lastInjection?.sections.filter((s) => s.isCritical) ?? [];
}

export function getContextInjectionReport(): ContextInjectionReport {
  return {
    lastInjection: _lastInjection,
    averageSectionsIncluded: _injectionCount > 0 ? Math.round(_totalSectionsIncluded / _injectionCount) : 0,
    averageTokensUsed: _injectionCount > 0 ? Math.round(_totalTokensUsed / _injectionCount) : 0,
    criticalSectionNames: _lastInjection?.sections.filter((s) => s.isCritical).map((s) => s.name) ?? [],
  };
}
