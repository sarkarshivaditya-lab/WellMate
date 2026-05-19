// Token budget manager.
// Estimates token costs before submission so prompts never silently overflow
// a model's context window. Conservative — uses 4 chars/token.

const CHARS_PER_TOKEN = 4;

export type BudgetAllocation = {
  system: number;
  context: number;
  prompt: number;
  response: number;
  total: number;
};

export type BudgetResult =
  | { fits: true; allocation: BudgetAllocation }
  | { fits: false; reason: string; overflow: number };

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function buildBudget(opts: {
  systemText: string;
  contextText: string;
  promptText: string;
  maxResponseTokens: number;
  modelContextLength: number;
}): BudgetResult {
  const system   = estimateTokens(opts.systemText);
  const context  = estimateTokens(opts.contextText);
  const prompt   = estimateTokens(opts.promptText);
  const response = opts.maxResponseTokens;
  const total    = system + context + prompt + response;

  if (total > opts.modelContextLength) {
    return {
      fits: false,
      reason: `Estimated ${total} tokens exceeds model limit of ${opts.modelContextLength}`,
      overflow: total - opts.modelContextLength,
    };
  }

  return { fits: true, allocation: { system, context, prompt, response, total } };
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}
