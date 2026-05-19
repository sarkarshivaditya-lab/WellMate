// Emotional salience scoring — re-ranks retrieval chunks to surface the most
// contextually meaningful wellness moments.
//
// Applied on top of cosine similarity scores from the vector store query.
// Three dimensions:
//   1. Recency decay  — exponential with 14-day half-life
//   2. Emotional intensity — low moods weighted higher (more need for attention)
//   3. Base similarity  — the cosine score from upstream

import type { RetrievalChunk } from "./types";

const HALFLIFE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

function recencyDecay(timestamp: number): number {
  const ageDays = (Date.now() - timestamp) / MS_PER_DAY;
  return Math.exp(-Math.LN2 * (ageDays / HALFLIFE_DAYS));
}

function emotionalIntensity(chunk: RetrievalChunk): number {
  const mood = Number(chunk.metadata.moodValue ?? 0);
  if (mood === 0) return 1.0; // no mood signal — neutral
  if (mood <= 2) return 1.4;  // distress is contextually salient
  if (mood >= 5) return 1.15; // positive peaks matter too
  return 1.0;
}

export type SalienceWeightedChunk = RetrievalChunk & { salienceScore: number };

export function applySalience(
  chunks: RetrievalChunk[],
  opts: { windowDays?: number } = {},
): SalienceWeightedChunk[] {
  const cutoff = opts.windowDays
    ? Date.now() - opts.windowDays * MS_PER_DAY
    : 0;

  return chunks
    .filter((c) => c.timestamp >= cutoff)
    .map((c) => ({
      ...c,
      salienceScore:
        c.score * recencyDecay(c.timestamp) * emotionalIntensity(c),
    }))
    .sort((a, b) => b.salienceScore - a.salienceScore);
}
