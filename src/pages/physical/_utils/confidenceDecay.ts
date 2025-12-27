export function applyConfidenceDecay(args: {
  confidenceScore: number;
  daysSinceLastLog: number;
}): number {
  let score = args.confidenceScore;

  // Daily inactivity decay
  score -= args.daysSinceLastLog * 5;

  // Extra penalty for no recent data
  if (args.daysSinceLastLog >= 7) {
    score -= 10;
  }

  return Math.max(0, Math.round(score));
}
