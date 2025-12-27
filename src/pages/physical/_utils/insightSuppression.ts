import type { PhysicalInsight } from "./types";
import { applyConfidenceDecay } from "./confidenceDecay";

type SuppressibleInsight = PhysicalInsight & {
  category?: string;
  generatedAtIso?: string;
  confidenceScore?: number;
  severity?: "low" | "medium" | "high";
};

function daysSince(iso: string): number {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function suppressInsights(
  insights: SuppressibleInsight[],
): SuppressibleInsight[] {
  const byCategory = new Map<string, SuppressibleInsight>();

  for (const insight of insights) {
    const generatedAtIso = insight.generatedAtIso ?? new Date().toISOString();
    const daysSinceLastLog = daysSince(generatedAtIso);

    const baseConfidence = insight.confidenceScore ?? 0;
    const decayedConfidence = applyConfidenceDecay({
      confidenceScore: baseConfidence,
      daysSinceLastLog,
    });

    // Rule 1 — hard confidence floor
    if (decayedConfidence < 25) continue;

    // Rule 2 — low severity suppression
    if (insight.severity === "low" && decayedConfidence < 50) continue;

    const category = insight.category ?? insight.id;
    const existing = byCategory.get(category);

    // Rule 3 — redundancy (keep highest confidence only)
    if (!existing || decayedConfidence > (existing.confidenceScore ?? 0)) {
      byCategory.set(category, {
        ...insight,
        confidenceScore: decayedConfidence,
      });
    }
  }

  return Array.from(byCategory.values());
}
