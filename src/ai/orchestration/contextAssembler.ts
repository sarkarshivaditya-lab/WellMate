// Wraps contextBridge output for direct use in inference requests.
// Applies token budget constraints and formats the assembled wellness context
// into a system prompt + context block ready for provider injection.

import { serializeContextForPrompt } from "../contextBridge";
import type { AIContextPayload } from "../types";
import { truncateToTokenBudget } from "./tokenBudget";

export type AssembledInferenceContext = {
  systemPrompt: string;
  contextBlock: string;
  estimatedTokens: number;
};

const MAX_CONTEXT_TOKENS = 800; // conservative ceiling — leaves room for prompt + response

// The system prompt is intentionally minimal and grounded.
// It does not impersonate a therapist, diagnose, or prescribe.
const WELLNESS_SYSTEM_PROMPT =
  "You are WellMate's wellness support layer. You have access to the user's " +
  "longitudinal wellness data. Provide calm, grounded, evidence-based observations " +
  "and gentle guidance. Never diagnose, prescribe, or replace professional care. " +
  "If you lack sufficient data to answer well, say so honestly.";

export function assembleInferenceContext(
  payload: AIContextPayload | null,
  opts: { maxContextTokens?: number } = {},
): AssembledInferenceContext {
  const maxTokens = opts.maxContextTokens ?? MAX_CONTEXT_TOKENS;

  if (!payload) {
    return {
      systemPrompt: WELLNESS_SYSTEM_PROMPT,
      contextBlock: "",
      estimatedTokens: Math.ceil(WELLNESS_SYSTEM_PROMPT.length / 4),
    };
  }

  const raw = serializeContextForPrompt(payload);
  const contextBlock = truncateToTokenBudget(raw, maxTokens);

  const estimatedTokens =
    Math.ceil(WELLNESS_SYSTEM_PROMPT.length / 4) +
    Math.ceil(contextBlock.length / 4);

  return { systemPrompt: WELLNESS_SYSTEM_PROMPT, contextBlock, estimatedTokens };
}
