// Wraps contextBridge output for direct use in inference requests.
// Applies token budget constraints and formats the assembled wellness context
// into a system prompt + context block ready for provider injection.

import { serializeContextForPrompt } from "../contextBridge";
import type { AIContextPayload } from "../types";
import { truncateToTokenBudget } from "./tokenBudget";
import { buildWellnessSystemPrompt } from "../prompts/wellnessSystemPrompt";

export type AssembledInferenceContext = {
  systemPrompt: string;
  contextBlock: string;
  estimatedTokens: number;
};

const MAX_CONTEXT_TOKENS = 800;

export function assembleInferenceContext(
  payload: AIContextPayload | null,
  opts: { maxContextTokens?: number } = {},
): AssembledInferenceContext {
  const maxTokens = opts.maxContextTokens ?? MAX_CONTEXT_TOKENS;
  const systemPrompt = buildWellnessSystemPrompt();

  if (!payload) {
    return {
      systemPrompt,
      contextBlock: "",
      estimatedTokens: Math.ceil(systemPrompt.length / 4),
    };
  }

  const raw = serializeContextForPrompt(payload);
  const contextBlock = truncateToTokenBudget(raw, maxTokens);

  const estimatedTokens =
    Math.ceil(systemPrompt.length / 4) +
    Math.ceil(contextBlock.length / 4);

  return { systemPrompt, contextBlock, estimatedTokens };
}
