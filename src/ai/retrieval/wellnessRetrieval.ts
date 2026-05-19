// Wellness-domain retrieval: indexes local wellness data into the vector store
// and queries it semantically. This is the first real RAG pass for WellMate.
//
// Design philosophy: retrieval quality matters more than model size.
// Context assembled from real grounded retrieval beats generic big prompts.

import { embedText, isEmbeddingReady } from "../embeddings/embeddingPipeline";
import {
  upsertVectorEntry,
  queryVectorStore,
  type ScoredEntry,
} from "../embeddings/vectorStore";
import type { RetrievalAdapter, RetrievalQuery, RetrievalResult, RetrievalScope } from "./types";
import { readWeightHistory } from "@/data/local/weightHistory";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";

// ── Indexing helpers ──────────────────────────────────────────────────────────

export async function indexWellnessProfile(): Promise<void> {
  if (!isEmbeddingReady()) return;

  const profile = readOnboardingPayload();
  if (!profile) return;

  const texts: Array<{ id: string; scope: RetrievalScope; text: string; metadata: Record<string, string | number | boolean> }> = [];

  if (profile.heightCm && profile.weightKg) {
    const bmi = profile.weightKg / ((profile.heightCm / 100) ** 2);
    texts.push({
      id: "profile_body",
      scope: "wellness_logs",
      text: `User height: ${profile.heightCm}cm, weight: ${profile.weightKg}kg, BMI: ${bmi.toFixed(1)}.`,
      metadata: { heightCm: profile.heightCm, weightKg: profile.weightKg },
    });
  }

  if (profile.activityLevel) {
    texts.push({
      id: "profile_activity",
      scope: "wellness_logs",
      text: `User activity level: ${profile.activityLevel}.`,
      metadata: { activityLevel: profile.activityLevel },
    });
  }

  if (profile.goal) {
    const goalText = { lose: "lose weight", maintain: "maintain weight", gain: "gain weight" }[profile.goal] ?? profile.goal;
    texts.push({
      id: "profile_goal",
      scope: "wellness_logs",
      text: `User wellness goal: ${goalText}.`,
      metadata: { goal: profile.goal },
    });
  }

  for (const item of texts) {
    try {
      const embedding = Array.from(await embedText(item.text));
      await upsertVectorEntry({
        id: item.id,
        scope: item.scope,
        text: item.text,
        embedding,
        timestamp: Date.now(),
        metadata: item.metadata,
      });
    } catch {
      // Non-fatal — skip failed embeddings
    }
  }
}

export async function indexWeightHistory(): Promise<void> {
  if (!isEmbeddingReady()) return;

  const history = readWeightHistory();
  if (history.length === 0) return;

  const recent = history.slice(-7);
  const trend = recent.length >= 2
    ? recent[recent.length - 1].kg - recent[0].kg
    : 0;

  const text = `Weight over last ${recent.length} days: from ${recent[0].kg}kg to ${recent[recent.length - 1].kg}kg. ${
    trend > 0.5 ? "Trend: increasing." : trend < -0.5 ? "Trend: decreasing." : "Trend: stable."
  }`;

  try {
    const embedding = Array.from(await embedText(text));
    await upsertVectorEntry({
      id: "weight_recent_trend",
      scope: "wellness_logs",
      text,
      embedding,
      timestamp: Date.now(),
      metadata: { trend: trend.toFixed(2) },
    });
  } catch {
    // Non-fatal
  }
}

// ── Real retrieval adapter ────────────────────────────────────────────────────

class WellnessRetrievalAdapter implements RetrievalAdapter {
  async query(q: RetrievalQuery): Promise<RetrievalResult> {
    const start = Date.now();

    if (!isEmbeddingReady()) {
      return { query: q, chunks: [], durationMs: Date.now() - start };
    }

    let queryEmbedding: number[];
    try {
      queryEmbedding = Array.from(await embedText(q.text));
    } catch {
      return { query: q, chunks: [], durationMs: Date.now() - start };
    }

    let results: ScoredEntry[];
    try {
      results = await queryVectorStore({
        queryEmbedding,
        scopes: q.scope as string[],
        topK: q.topK,
        minScore: q.minScore,
        windowDays: q.windowDays,
      });
    } catch {
      return { query: q, chunks: [], durationMs: Date.now() - start };
    }

    return {
      query: q,
      chunks: results.map((r) => ({
        id: r.id,
        scope: r.scope as RetrievalScope,
        content: r.text,
        score: r.score,
        timestamp: r.timestamp,
        metadata: r.metadata,
      })),
      durationMs: Date.now() - start,
    };
  }

  async index(
    scope: RetrievalScope,
    content: string,
    metadata: Record<string, string | number | boolean> = {},
  ): Promise<void> {
    if (!isEmbeddingReady()) return;

    try {
      const embedding = Array.from(await embedText(content));
      await upsertVectorEntry({
        id: `${scope}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        scope,
        text: content,
        embedding,
        timestamp: Date.now(),
        metadata,
      });
    } catch {
      // Non-fatal
    }
  }

  isReady(): boolean {
    return isEmbeddingReady();
  }
}

export const wellnessRetrievalAdapter = new WellnessRetrievalAdapter();

// Called once at AI runtime startup to warm the vector index
export async function bootstrapWellnessIndex(): Promise<void> {
  await indexWellnessProfile();
  await indexWeightHistory();
}
