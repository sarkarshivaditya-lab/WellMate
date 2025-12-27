import type { PhysicalInsight } from "./types";

/**
 * Apply insight saturation caps to avoid overwhelming the user.
 * Assumes insights are already:
 * - ranked
 * - suppressed
 * - memory-filtered
 */
export function applyInsightSaturation<T extends PhysicalInsight>(
  insights: T[],
): T[] {
  const MAX_TOTAL = 3;
  const MAX_HIGH = 1; // impact === 3
  const MAX_MEDIUM = 2; // impact === 2

  const result: T[] = [];

  let highCount = 0;
  let mediumCount = 0;

  for (const insight of insights) {
    if (result.length >= MAX_TOTAL) break;

    if (insight.impact === 3) {
      if (highCount >= MAX_HIGH) continue;
      highCount++;
    }

    if (insight.impact === 2) {
      if (mediumCount >= MAX_MEDIUM) continue;
      mediumCount++;
    }

    result.push(insight);
  }

  return result;
}
