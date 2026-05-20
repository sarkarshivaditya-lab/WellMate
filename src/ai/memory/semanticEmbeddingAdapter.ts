// Semantic Embedding Adapter — embedding-ready semantic memory architecture.
//
// Fully offline-first. No external APIs, no neural inference.
// Uses normalized TF-IDF token-frequency vectors as pseudo-embeddings.
// These provide approximate semantic similarity suitable for clustering and recall
// without requiring a loaded embedding model.
//
// When a real embedding model is available (future), replace computeEmbedding()
// with a real ONNX/WASM embedding model call — all downstream code stays the same.
//
// Capabilities:
//   computeEmbedding        — pseudo-embedding vector for a text string
//   semanticCluster         — k-means-lite clustering of memory entries
//   conceptualRecall        — top-k most related memories for a query
//   groupContradictions     — cluster conflicting memories
//   semanticDeduplicate     — remove near-duplicates above threshold

import type { MemoryEntry } from "./memoryHierarchy";
import { computeSemanticSimilarity, detectContradictions, groupByConceptualSimilarity } from "@/ai/cognition/semanticMemoryEngine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PseudoEmbedding = {
  entryId: string;
  vector: number[];        // L2-normalized TF-IDF token frequency vector
  vocabulary: string[];    // parallel vocab list for this embedding
  computedAt: number;
};

export type SemanticCluster = {
  id: string;
  centroidText: string;
  memberIds: string[];
  coherenceScore: number;  // 0-1 average pairwise similarity
  dominantTags: string[];
};

export type RecallResult = {
  entry: MemoryEntry;
  relevanceScore: number;  // 0-1
  matchedTokens: string[];
};

export type EmbeddingAdapterReport = {
  cachedEmbeddings: number;
  clusterCount: number;
  lastClusterAt: number | null;
  recallLatencyMs: number;
  embeddingMode: "pseudo_tfidf" | "neural";
};

// ── Vocabulary + TF-IDF helpers ───────────────────────────────────────────────

const STOPWORDS = new Set([
  "i", "a", "an", "the", "is", "it", "in", "on", "to", "of", "and", "or",
  "was", "for", "do", "my", "me", "we", "you", "he", "she", "they", "be",
  "have", "has", "had", "am", "are", "were", "been", "at", "by", "with",
  "this", "that", "from", "as", "not", "but", "so", "up", "if", "out",
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function buildTfVector(tokens: string[], vocab: string[]): number[] {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const vector = vocab.map((v) => (freq.get(v) ?? 0) / Math.max(1, tokens.length));
  // L2 normalize
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

function buildVocabulary(entries: MemoryEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of new Set(tokenize(e.content))) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  // Keep tokens appearing in 2+ entries, capped at 200
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
    .map(([t]) => t);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));  // already L2-normalized → dot = cosine
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const _embeddingCache = new Map<string, PseudoEmbedding>();
let _lastClusters: SemanticCluster[] = [];
let _lastClusterAt: number | null = null;
let _lastRecallMs = 0;

// ── Public API ─────────────────────────────────────────────────────────────────

export function computeEmbedding(entryId: string, text: string, vocabEntries: MemoryEntry[]): PseudoEmbedding {
  const cached = _embeddingCache.get(entryId);
  if (cached && Date.now() - cached.computedAt < 30 * 60 * 1000) return cached;  // 30-min cache

  const vocab = buildVocabulary(vocabEntries);
  const tokens = tokenize(text);
  const vector = buildTfVector(tokens, vocab);

  const embedding: PseudoEmbedding = { entryId, vector, vocabulary: vocab, computedAt: Date.now() };
  _embeddingCache.set(entryId, embedding);
  return embedding;
}

export function semanticCluster(entries: MemoryEntry[], k = 5): SemanticCluster[] {
  if (entries.length < k) k = Math.max(1, entries.length);

  const vocab = buildVocabulary(entries);
  const embeddings = entries.map((e) => ({
    entry: e,
    vector: buildTfVector(tokenize(e.content), vocab),
  }));

  // K-means-lite: 5 iterations, random init
  const centroids = embeddings.slice(0, k).map((e) => [...e.vector]);

  for (let iter = 0; iter < 5; iter++) {
    const clusters: number[][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < embeddings.length; i++) {
      let bestCluster = 0, bestScore = -1;
      for (let j = 0; j < k; j++) {
        const sim = cosineSimilarity(embeddings[i].vector, centroids[j]);
        if (sim > bestScore) { bestScore = sim; bestCluster = j; }
      }
      clusters[bestCluster].push(i);
    }
    // Update centroids
    for (let j = 0; j < k; j++) {
      if (clusters[j].length === 0) continue;
      const dims = vocab.length;
      const newCentroid = new Array(dims).fill(0);
      for (const idx of clusters[j]) {
        for (let d = 0; d < dims; d++) newCentroid[d] += embeddings[idx].vector[d];
      }
      const count = clusters[j].length;
      centroids[j] = newCentroid.map((v) => v / count);
    }
  }

  // Build final clusters
  const assignments: number[] = new Array(embeddings.length).fill(0);
  for (let i = 0; i < embeddings.length; i++) {
    let best = 0, bestSim = -1;
    for (let j = 0; j < k; j++) {
      const sim = cosineSimilarity(embeddings[i].vector, centroids[j]);
      if (sim > bestSim) { bestSim = sim; best = j; }
    }
    assignments[i] = best;
  }

  const result: SemanticCluster[] = [];
  for (let j = 0; j < k; j++) {
    const members = embeddings.filter((_, i) => assignments[i] === j);
    if (members.length === 0) continue;

    // Coherence: average pairwise cosine similarity
    let coherenceSum = 0, pairs = 0;
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length; b++) {
        coherenceSum += cosineSimilarity(members[a].vector, members[b].vector);
        pairs++;
      }
    }
    const coherenceScore = pairs > 0 ? coherenceSum / pairs : 1;

    // Dominant tags: top tokens in centroid
    const centroidTokens = vocab
      .map((t, i) => ({ t, v: centroids[j][i] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 5)
      .map((x) => x.t);

    result.push({
      id: `cluster-${j}`,
      centroidText: centroidTokens.join(", "),
      memberIds: members.map((m) => m.entry.id),
      coherenceScore,
      dominantTags: centroidTokens,
    });
  }

  _lastClusters = result;
  _lastClusterAt = Date.now();
  return result;
}

export function conceptualRecall(query: string, entries: MemoryEntry[], topK = 5): RecallResult[] {
  const start = Date.now();

  const results: RecallResult[] = entries.map((entry) => {
    const sim = computeSemanticSimilarity(query, entry.content);
    const queryTokens = new Set(tokenize(query));
    const entryTokens = tokenize(entry.content);
    const matched = entryTokens.filter((t) => queryTokens.has(t));
    return { entry, relevanceScore: sim, matchedTokens: matched.slice(0, 5) };
  });

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  _lastRecallMs = Date.now() - start;
  return results.slice(0, topK);
}

export function groupContradictions(entries: MemoryEntry[]): Array<{ a: MemoryEntry; b: MemoryEntry; reason: string }> {
  const contradictions = detectContradictions(entries);
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  return contradictions
    .map((c) => {
      const a = entryMap.get(c.fromId);
      const b = entryMap.get(c.toId);
      if (!a || !b) return null;
      return { a, b, reason: c.kind };
    })
    .filter((x): x is { a: MemoryEntry; b: MemoryEntry; reason: string } => x !== null);
}

export function semanticDeduplicate(entries: MemoryEntry[], threshold = 0.85): MemoryEntry[] {
  const kept: MemoryEntry[] = [];
  for (const entry of entries) {
    const isDuplicate = kept.some((k) => computeSemanticSimilarity(k.content, entry.content) >= threshold);
    if (!isDuplicate) kept.push(entry);
  }
  return kept;
}

export function getEmbeddingAdapterReport(): EmbeddingAdapterReport {
  return {
    cachedEmbeddings: _embeddingCache.size,
    clusterCount: _lastClusters.length,
    lastClusterAt: _lastClusterAt,
    recallLatencyMs: _lastRecallMs,
    embeddingMode: "pseudo_tfidf",
  };
}

export function getLastClusters(): SemanticCluster[] {
  return _lastClusters;
}
