// Context Prioritizer — salience-based selection of what enters the inference context.
//
// The AI must NOT inject all memory into prompts. This engine selects
// the most relevant cognitive material under a strict token budget.
//
// Salience formula:
//   score = base_salience
//           × recency_weight(age)
//           × (1 + unresolved_boost if topic is unresolved)
//           × (1 + emotional_boost if emotionally salient)
//           × confidence
//
// Pipeline:
//   1. Collect candidates: attention slots + memory hierarchy + user model
//   2. Score each candidate
//   3. Detect and suppress redundant/contradictory items
//   4. Fill token budget greedily by score
//   5. Always include: active goals + emotional state (mandatory)
//
// Output is a ranked, deduplicated set of context strings with total token estimate.

import { getTopAttentionSlots, getActiveGoals, getEmotionalState, getUnresolvedTopics } from "./cognitiveStateEngine";
import { retrieveMemory } from "../memory/memoryHierarchy";
import { getHighConfidenceDimensions, getCoachingContext } from "./userModel";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ContextItemKind =
  | "attention_slot" | "active_goal" | "emotional_state"
  | "episodic_memory" | "semantic_memory" | "user_model"
  | "unresolved_topic" | "coaching_context";

export type ContextItem = {
  id: string;
  kind: ContextItemKind;
  content: string;
  salienceScore: number;     // 0-1 composite score
  estimatedTokens: number;
  tier?: number;             // memory tier if from hierarchy
  isManatory: boolean;       // always included regardless of budget
};

export type ContradictionFlag = {
  itemA: string;
  itemB: string;
  reason: string;
};

export type AssembledContext = {
  items: ContextItem[];
  totalTokens: number;
  budgetTokens: number;
  utilizationPct: number;
  itemsExcluded: number;
  contradictionsDetected: number;
  assembledAt: number;
};

export type ContextBudgetReport = {
  budgetTokens: number;
  lastAssembled: AssembledContext | null;
  itemsIncluded: number;
  itemsExcluded: number;
  utilizationPct: number;
  contradictionsDetected: number;
  topItems: Array<{ content: string; kind: string; score: number }>;
};

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // ~4 characters per token (rough LLM tokenization estimate)
  return Math.ceil(text.length / 4);
}

// ── Recency weighting ──────────────────────────────────────────────────────────

function recencyWeight(ageMs: number, halfLifeMs: number): number {
  return Math.exp(-Math.log(2) * ageMs / halfLifeMs);
}

// ── Contradiction detection ───────────────────────────────────────────────────

function detectContradictions(items: ContextItem[]): ContradictionFlag[] {
  const flags: ContradictionFlag[] = [];
  const content = items.map((i) => i.content.toLowerCase());

  // Simple lexical contradiction patterns
  const contradictionPatterns = [
    { a: "motivated", b: "demotivated" },
    { a: "consistent", b: "inconsistent" },
    { a: "improving", b: "declining" },
    { a: "low stress", b: "high stress" },
    { a: "morning person", b: "evening person" },
  ];

  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      for (const pattern of contradictionPatterns) {
        if (content[i].includes(pattern.a) && content[j].includes(pattern.b)) {
          flags.push({ itemA: items[i].id, itemB: items[j].id, reason: `${pattern.a} vs ${pattern.b}` });
        }
      }
    }
  }

  return flags;
}

// ── Redundancy suppression ────────────────────────────────────────────────────

function suppressRedundant(items: ContextItem[]): ContextItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.content.trim().slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Context assembly ──────────────────────────────────────────────────────────

let _lastAssembled: AssembledContext | null = null;
let _contextIdCounter = 0;

function nextCtxId(): string { return `ctx-${_contextIdCounter++}`; }

export function assembleContext(budgetTokens = 1000): AssembledContext {
  const now = Date.now();
  const candidates: ContextItem[] = [];

  // ── Mandatory items (always included) ─────────────────────────────────────

  // Active goals
  for (const goal of getActiveGoals()) {
    const content = `Goal: ${goal.description} (progress: ${Math.round(goal.progress * 100)}%)`;
    candidates.push({
      id: nextCtxId(), kind: "active_goal", content,
      salienceScore: 0.9 + goal.priority * 0.1,
      estimatedTokens: estimateTokens(content),
      isManatory: true,
    });
  }

  // Emotional state
  const emo = getEmotionalState();
  const emoContent = `Emotional state: ${emo.dominantEmotion} (trend: ${emo.trend})`;
  candidates.push({
    id: nextCtxId(), kind: "emotional_state", content: emoContent,
    salienceScore: 0.85, estimatedTokens: estimateTokens(emoContent),
    isManatory: true,
  });

  // ── Attention slots (scored by current salience) ───────────────────────────

  for (const slot of getTopAttentionSlots(5)) {
    const ageMs = now - slot.lastReferenced;
    const recency = recencyWeight(ageMs, 30 * 60 * 1000); // 30min half-life
    const unresolvedTopics = getUnresolvedTopics();
    const unresolvedBoost = unresolvedTopics.some((t) =>
      t.topic.toLowerCase().includes(slot.content.toLowerCase().slice(0, 20))
    ) ? 0.2 : 0;
    const score = slot.salience * recency * (1 + unresolvedBoost);

    candidates.push({
      id: nextCtxId(), kind: "attention_slot", content: slot.content,
      salienceScore: Math.min(1, score),
      estimatedTokens: estimateTokens(slot.content),
      isManatory: false,
    });
  }

  // ── Unresolved topics ─────────────────────────────────────────────────────

  for (const topic of getUnresolvedTopics().slice(0, 3)) {
    const content = `Unresolved: ${topic.topic}`;
    candidates.push({
      id: nextCtxId(), kind: "unresolved_topic", content,
      salienceScore: 0.6 + topic.urgency * 0.3,
      estimatedTokens: estimateTokens(content),
      isManatory: false,
    });
  }

  // ── Memory hierarchy (episodic + semantic, high salience) ─────────────────

  const memories = retrieveMemory({ maxTier: 4, minSalience: 0.5, limit: 8 });
  for (const mem of memories) {
    const ageMs = now - mem.createdAt;
    const halfLife = mem.tier === 3 ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const recency = recencyWeight(ageMs, halfLife);
    const score = mem.salience * mem.confidence * recency;

    candidates.push({
      id: nextCtxId(),
      kind: mem.tier <= 3 ? "episodic_memory" : "semantic_memory",
      content: mem.content,
      salienceScore: Math.min(1, score),
      estimatedTokens: estimateTokens(mem.content),
      tier: mem.tier,
      isManatory: false,
    });
  }

  // ── User model coaching context ───────────────────────────────────────────

  const coachingCtx = getCoachingContext();
  if (coachingCtx) {
    candidates.push({
      id: nextCtxId(), kind: "coaching_context", content: `User profile: ${coachingCtx}`,
      salienceScore: 0.75, estimatedTokens: estimateTokens(coachingCtx),
      isManatory: false,
    });
  }

  // ── Contradiction detection and suppression ────────────────────────────────

  const contradictions = detectContradictions(candidates);
  const contradictionIds = new Set(contradictions.flatMap((c) => [c.itemA, c.itemB]).slice(0, 2));

  if (contradictions.length > 0) {
    emitCognitionEvent("contradiction_detected", { count: contradictions.length });
  }

  // ── Redundancy suppression ────────────────────────────────────────────────

  const deduplicated = suppressRedundant(candidates.filter((c) => !contradictionIds.has(c.id)));

  // ── Fill token budget ─────────────────────────────────────────────────────

  const mandatory = deduplicated.filter((c) => c.isManatory);
  const optional = deduplicated.filter((c) => !c.isManatory).sort((a, b) => b.salienceScore - a.salienceScore);

  const selected: ContextItem[] = [...mandatory];
  let usedTokens = mandatory.reduce((s, c) => s + c.estimatedTokens, 0);

  for (const item of optional) {
    if (usedTokens + item.estimatedTokens > budgetTokens) continue;
    selected.push(item);
    usedTokens += item.estimatedTokens;
  }

  const excluded = candidates.length - selected.length;
  const utilizationPct = Math.round((usedTokens / budgetTokens) * 100);

  if (utilizationPct > 90) {
    emitCognitionEvent("context_budget_exceeded", { used: usedTokens, budget: budgetTokens });
  }

  const assembled: AssembledContext = {
    items: selected,
    totalTokens: usedTokens,
    budgetTokens,
    utilizationPct,
    itemsExcluded: excluded,
    contradictionsDetected: contradictions.length,
    assembledAt: now,
  };

  _lastAssembled = assembled;
  return assembled;
}

export function getLastAssembledContext(): AssembledContext | null { return _lastAssembled; }

// ── Observability ──────────────────────────────────────────────────────────────

export function getContextBudgetReport(): ContextBudgetReport {
  const last = _lastAssembled;
  return {
    budgetTokens: last?.budgetTokens ?? 1000,
    lastAssembled: last,
    itemsIncluded: last?.items.length ?? 0,
    itemsExcluded: last?.itemsExcluded ?? 0,
    utilizationPct: last?.utilizationPct ?? 0,
    contradictionsDetected: last?.contradictionsDetected ?? 0,
    topItems: (last?.items ?? []).slice(0, 5).map((i) => ({
      content: i.content.slice(0, 60),
      kind: i.kind,
      score: Math.round(i.salienceScore * 100) / 100,
    })),
  };
}
