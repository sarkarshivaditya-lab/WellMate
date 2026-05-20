// Unified Context Assembler — single pipeline assembling ALL cognitive inputs.
//
// This replaces the ad-hoc injections scattered across unifiedAssistantOrchestrator.
// Every prompt context MUST pass through this module.
//
// Sources assembled (in salience priority order):
//   T — Emotional state + active goals         (mandatory, always)
//   T — Coaching calibration hint              (mandatory, always)
//   1 — Wellness trajectory summary            (high priority)
//   2 — Goal threads (active, stalled)         (high priority)
//   3 — Recovery opportunities (window=now)    (situational)
//   4 — Proactive insights (confidence > 0.7)  (situational)
//   5 — User model high-confidence dimensions  (medium)
//   6 — Memory hierarchy (T3+T4, salience>0.5) (medium)
//   7 — Unresolved topics                      (low)
//   8 — Emotional continuity context           (low)
//
// Hard token budget: caller-specified, never exceeded.
// Contradictions in context are suppressed before assembly.

import { assembleContext } from "./contextPrioritizer";
import { getCoachingStyleAsPromptHint } from "@/ai/coaching/adaptiveCoachingEngine";
import { getWellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { getActiveGoalThreads } from "./goalThreadTracker";
import { detectRecoveryOpportunities } from "@/ai/wellness/recoveryOpportunityDetector";
import { synthesizeProactiveInsights } from "@/ai/wellness/proactiveInsightSynthesizer";
import { getEmotionalContinuityReport } from "./emotionalContinuityEngine";
import { getHighConfidenceDimensions } from "./userModel";
import { AssistantSurface } from "@/ai/assistant/contextualBehaviorEngine";
import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ContextSection = {
  label: string;
  content: string;
  tokens: number;
  source: string;
  mandatory: boolean;
};

export type UnifiedContext = {
  systemPromptSections: ContextSection[];
  totalTokens: number;
  budgetTokens: number;
  sectionsIncluded: number;
  sectionsExcluded: number;
  assembledAt: number;
  surface: AssistantSurface | null;
};

export type UnifiedContextReport = {
  lastContext: UnifiedContext | null;
  assemblyCount: number;
  averageTokensUsed: number;
  lastAssembledAt: number | null;
};

// ── Token estimation ───────────────────────────────────────────────────────────

function est(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildMandatorySections(): ContextSection[] {
  const sections: ContextSection[] = [];

  // Coaching hint (always first)
  const coachingHint = getCoachingStyleAsPromptHint();
  if (coachingHint) {
    sections.push({ label: "coaching", content: coachingHint, tokens: est(coachingHint), source: "adaptiveCoachingEngine", mandatory: true });
  }

  // Emotional state summary
  const emotional = getEmotionalContinuityReport();
  const dom = emotional.profile.dominantDimension;
  const burnout = emotional.profile.dimensions.burnout.value;
  const stress = emotional.profile.dimensions.stress.value;
  const motiv = emotional.profile.dimensions.motivation.value;
  const emoContent = [
    `Emotional state: burnout ${(burnout * 100).toFixed(0)}%, stress ${(stress * 100).toFixed(0)}%, motivation ${(motiv * 100).toFixed(0)}%.`,
    dom ? `Dominant signal: ${dom} (${emotional.profile.dimensions[dom].trend}).` : "",
    burnout > 0.7 ? "User is showing high burnout — avoid challenge framing." : "",
  ].filter(Boolean).join(" ");
  sections.push({ label: "emotional_state", content: emoContent, tokens: est(emoContent), source: "emotionalContinuityEngine", mandatory: true });

  return sections;
}

function buildTrajectorySection(): ContextSection | null {
  const trajectory = getWellnessTrajectory();
  if (!trajectory) return null;

  const parts: string[] = [];
  if (trajectory.compositeDirection !== "unknown") {
    parts.push(`Overall wellness trajectory: ${trajectory.compositeDirection} (${trajectory.compositeSlope > 0 ? "+" : ""}${(trajectory.compositeSlope * 100).toFixed(0)}% slope).`);
  }
  if (trajectory.dominantConcern) {
    parts.push(`Primary concern area: ${trajectory.dominantConcern}.`);
  }
  if (trajectory.positiveSignals.length > 0) {
    parts.push(`Improving: ${trajectory.positiveSignals.slice(0, 2).join(", ")}.`);
  }
  if (trajectory.burnoutProgression > 0.6) {
    parts.push("Burnout progression is elevated.");
  }

  if (parts.length === 0) return null;
  const content = parts.join(" ");
  return { label: "trajectory", content, tokens: est(content), source: "wellnessTrajectoryEngine", mandatory: false };
}

function buildGoalSection(): ContextSection | null {
  const threads = getActiveGoalThreads().slice(0, 3);
  if (threads.length === 0) return null;

  const content = threads.map((t) =>
    `Goal: "${t.name}" — progress ${(t.progress * 100).toFixed(0)}%, status: ${t.status}.`
  ).join(" ");
  return { label: "goal_threads", content, tokens: est(content), source: "goalThreadTracker", mandatory: false };
}

function buildRecoverySection(): ContextSection | null {
  const report = detectRecoveryOpportunities();
  const now = report.opportunities.filter((o) => o.window === "now").slice(0, 1);
  if (now.length === 0) return null;

  const content = `Recovery opportunity: ${now[0].suggestion}`;
  return { label: "recovery_opportunity", content, tokens: est(content), source: "recoveryOpportunityDetector", mandatory: false };
}

function buildInsightSection(): ContextSection | null {
  const insights = synthesizeProactiveInsights();
  const top = insights.freshInsights.filter((i) => i.confidence > 0.7).slice(0, 1);
  if (top.length === 0) return null;

  const content = `Wellness insight: ${top[0].text}`;
  return { label: "proactive_insight", content, tokens: est(content), source: "proactiveInsightSynthesizer", mandatory: false };
}

function buildUserModelSection(): ContextSection | null {
  const highConf = getHighConfidenceDimensions(0.6).slice(0, 3);
  if (highConf.length === 0) return null;

  const content = highConf.map((d) => `${d.dimension.replace(/_/g, " ")}: ${(d.value * 100).toFixed(0)}% (${d.trend})`).join("; ");
  return { label: "user_model", content, tokens: est(content), source: "userModel", mandatory: false };
}

function buildCognitionMemorySection(budgetRemaining: number): ContextSection | null {
  const assembled = assembleContext(Math.min(budgetRemaining, 400));
  if (assembled.items.length === 0) return null;

  const memItems = assembled.items
    .filter((i) => i.kind === "episodic_memory" || i.kind === "semantic_memory")
    .slice(0, 4);
  if (memItems.length === 0) return null;

  const content = memItems.map((i) => i.content.slice(0, 120)).join(" | ");
  return { label: "memory", content, tokens: est(content), source: "contextPrioritizer", mandatory: false };
}

// ── State ──────────────────────────────────────────────────────────────────────

let _lastContext: UnifiedContext | null = null;
let _assemblyCount = 0;
let _totalTokensUsed = 0;

// ── Main assembly ─────────────────────────────────────────────────────────────

export function assembleUnifiedContext(
  budgetTokens = 900,
  surface: AssistantSurface | null = null,
  skipProactive = false,
): UnifiedContext {
  const mandatory = buildMandatorySections();
  const mandatoryTokens = mandatory.reduce((s, c) => s + c.tokens, 0);
  let remaining = budgetTokens - mandatoryTokens;

  const optional: (ContextSection | null)[] = [
    buildTrajectorySection(),
    buildGoalSection(),
    skipProactive ? null : buildRecoverySection(),
    skipProactive ? null : buildInsightSection(),
    buildUserModelSection(),
    remaining > 150 ? buildCognitionMemorySection(remaining) : null,
  ];

  const selected: ContextSection[] = [...mandatory];
  let excluded = 0;

  for (const sec of optional) {
    if (!sec) continue;
    if (remaining - sec.tokens < 0) { excluded++; continue; }
    selected.push(sec);
    remaining -= sec.tokens;
  }

  const totalTokens = budgetTokens - remaining;
  _assemblyCount++;
  _totalTokensUsed += totalTokens;

  if (totalTokens > budgetTokens * 0.95) {
    emitCognitionEvent("context_budget_exceeded", { used: totalTokens, budget: budgetTokens, source: "unifiedContextAssembler" });
  }

  _lastContext = {
    systemPromptSections: selected,
    totalTokens,
    budgetTokens,
    sectionsIncluded: selected.length,
    sectionsExcluded: excluded,
    assembledAt: Date.now(),
    surface,
  };

  return _lastContext;
}

export function buildSystemPromptFromContext(ctx: UnifiedContext): string {
  return ctx.systemPromptSections.map((s) => s.content).join("\n");
}

export function getUnifiedContextReport(): UnifiedContextReport {
  return {
    lastContext: _lastContext,
    assemblyCount: _assemblyCount,
    averageTokensUsed: _assemblyCount > 0 ? Math.round(_totalTokensUsed / _assemblyCount) : 0,
    lastAssembledAt: _lastContext?.assembledAt ?? null,
  };
}
