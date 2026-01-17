// src/pages/physical/_utils/insightMemory.ts

const MEMORY_WINDOW_DAYS = 2;
const STRONG_IMPROVEMENT_DELTA = 8;
const STRONG_REGRESSION_DELTA = 6;

type InsightMemoryRecord = {
  lastShownIso: string;
  lastConfidenceScore: number;
};

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.floor(Math.abs(a - b) / (1000 * 60 * 60 * 24));
}

export function applyInsightMemory<T extends { id: string }>(args: {
  insights: T[];
  confidenceScore: number;
  todayIso: string;
}): T[] {
  const { insights, confidenceScore, todayIso } = args;

  const result: T[] = [];

  for (const insight of insights) {
    const key = `wellmate:insight:${insight.id}`;
    const raw = localStorage.getItem(key);

    let allowShow = true;

    if (raw) {
      const record: InsightMemoryRecord = JSON.parse(raw);
      const ageDays = daysBetween(record.lastShownIso, todayIso);
      const delta = confidenceScore - record.lastConfidenceScore;

      const confidenceStronglyImproved =
        delta >= STRONG_IMPROVEMENT_DELTA;

      const confidenceStronglyRegressed =
        delta <= -STRONG_REGRESSION_DELTA;

      // 🔒 Cool-off window: suppress unless strong regression
      if (
        ageDays < MEMORY_WINDOW_DAYS &&
        !confidenceStronglyRegressed
      ) {
        allowShow = false;
      }

      // 🛡️ Resolved but fragile:
      // Small improvements do NOT resurface insight
      if (delta > 0 && delta < STRONG_IMPROVEMENT_DELTA) {
        allowShow = false;
      }

      // 🚨 Strong regression always allows resurfacing
      if (confidenceStronglyRegressed) {
        allowShow = true;
      }

      // 🧘 Strong improvement extends suppression window
      if (confidenceStronglyImproved && ageDays < MEMORY_WINDOW_DAYS * 2) {
        allowShow = false;
      }
    }

    if (!allowShow) continue;

    // Record memory on show
    localStorage.setItem(
      key,
      JSON.stringify({
        lastShownIso: todayIso,
        lastConfidenceScore: confidenceScore,
      }),
    );

    result.push(insight);
  }

  return result;
}
