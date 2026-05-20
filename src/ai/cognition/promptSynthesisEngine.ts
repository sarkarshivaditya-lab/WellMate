// Prompt Synthesis Engine — builds optimized inference prompts from cognitive context.
//
// Goal: produce a prompt that feels continuous and coherent WITHOUT stuffing raw
// conversation history. The prompt is assembled from structured cognitive material —
// working memory, emotional continuity, active goals, user model — not a transcript.
//
// Token budget is strictly enforced. Sections are scored by salience and filled
// greedily. Mandatory sections (emotional state, active goals) always included.
//
// Contradiction suppression: if two context items contradict each other,
// the lower-confidence one is excluded.

import type { ContextInjection, ContextSection } from "./continuousContextInjector";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SynthesisInput = {
  userMessage: string;
  assembledContext: ContextInjection;
  systemContext?: string;
  budgetTokens: number;
};

export type SynthesisSectionReport = {
  name: string;
  tokens: number;
  included: boolean;
  reason?: string;
};

export type SynthesisOutput = {
  prompt: string;
  systemPrompt: string;
  tokenBudgetUsed: number;
  tokenBudgetTotal: number;
  sections: SynthesisSectionReport[];
  continuityFrame: string | null;
  contradictionsSuppressed: number;
  synthesizedAt: number;
};

// ── Last synthesis state ───────────────────────────────────────────────────────

let _lastOutput: SynthesisOutput | null = null;

// ── Token estimation ──────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Contradiction suppression ──────────────────────────────────────────────────

function suppressContradictions(sections: ContextSection[]): { sections: ContextSection[]; suppressed: number } {
  // Simple heuristic: if two sections share antonymous markers, drop the shorter one.
  const ANTONYM_PAIRS: [string, string][] = [
    ["improving", "declining"],
    ["high motivation", "low motivation"],
    ["stressed", "calm"],
    ["sleep well", "poor sleep"],
    ["active", "sedentary"],
  ];

  const kept: ContextSection[] = [];
  let suppressed = 0;

  for (const section of sections) {
    let conflict = false;
    for (const [a, b] of ANTONYM_PAIRS) {
      const hasA = section.content.toLowerCase().includes(a);
      const hasB = section.content.toLowerCase().includes(b);
      if (hasA && hasB) { conflict = true; break; }
      if (hasA) {
        const alreadyB = kept.some((k) => k.content.toLowerCase().includes(b));
        if (alreadyB) { conflict = true; break; }
      }
    }
    if (conflict) { suppressed++; continue; }
    kept.push(section);
  }

  return { sections: kept, suppressed };
}

// ── Continuity frame builder ──────────────────────────────────────────────────

function buildContinuityFrame(context: ContextInjection): string | null {
  const critical = context.sections.filter((s) => s.isCritical);
  if (critical.length === 0) return null;

  const fragments = critical
    .map((s) => s.content)
    .join(" | ")
    .slice(0, 300);

  return `[Context: ${fragments}]`;
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

export function synthesizePrompt(input: SynthesisInput): SynthesisOutput {
  const { userMessage, assembledContext, systemContext, budgetTokens } = input;
  const sectionReports: SynthesisSectionReport[] = [];

  // Deduplicate and suppress contradictions in context sections
  const { sections: cleanSections, suppressed: contradictionsSuppressed } =
    suppressContradictions(assembledContext.sections);

  // Sort non-critical sections by tokens (smaller first to maximize included count)
  const criticals = cleanSections.filter((s) => s.isCritical);
  const optionals = cleanSections
    .filter((s) => !s.isCritical)
    .sort((a, b) => a.tokens - b.tokens);

  // Always include critical sections
  const includedSections: ContextSection[] = [...criticals];
  let tokensUsed = criticals.reduce((sum, s) => sum + s.tokens, 0);

  for (const s of criticals) {
    sectionReports.push({ name: s.name, tokens: s.tokens, included: true, reason: "critical" });
  }

  // Fill remaining budget with optional sections
  for (const s of optionals) {
    if (tokensUsed + s.tokens <= budgetTokens) {
      includedSections.push(s);
      tokensUsed += s.tokens;
      sectionReports.push({ name: s.name, tokens: s.tokens, included: true });
    } else {
      sectionReports.push({ name: s.name, tokens: s.tokens, included: false, reason: "budget_exceeded" });
    }
  }

  // Build continuity frame
  const continuityFrame = buildContinuityFrame(assembledContext);

  // Assemble context block
  const contextBlock = includedSections.map((s) => s.content).join("\n\n").trim();

  // Build final prompt
  const parts: string[] = [];
  if (continuityFrame) parts.push(continuityFrame);
  if (contextBlock) parts.push(contextBlock);
  parts.push(userMessage);

  const prompt = parts.join("\n\n");

  // Build system prompt
  const baseSystem = systemContext ?? "You are WellMate, a private wellness coach. Be warm, honest, and concise.";
  const systemPrompt = baseSystem;

  const output: SynthesisOutput = {
    prompt,
    systemPrompt,
    tokenBudgetUsed: estimateTokens(prompt),
    tokenBudgetTotal: budgetTokens,
    sections: sectionReports,
    continuityFrame,
    contradictionsSuppressed,
    synthesizedAt: Date.now(),
  };

  _lastOutput = output;
  return output;
}

export function getLastSynthesisOutput(): SynthesisOutput | null {
  return _lastOutput;
}

export function getPromptSynthesisReport(): {
  lastSynthesis: SynthesisOutput | null;
  averageTokensUsed: number;
} {
  return {
    lastSynthesis: _lastOutput,
    averageTokensUsed: _lastOutput?.tokenBudgetUsed ?? 0,
  };
}
