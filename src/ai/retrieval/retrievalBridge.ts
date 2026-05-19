// Stub retrieval adapter.
// Returns empty results until a vector store is integrated.
// isReady() returns false explicitly — callers can gate retrieval-augmented
// paths on this flag without checking anything else.

import type {
  RetrievalAdapter,
  RetrievalQuery,
  RetrievalResult,
  RetrievalScope,
} from "./types";

class StubRetrievalAdapter implements RetrievalAdapter {
  async query(q: RetrievalQuery): Promise<RetrievalResult> {
    return { query: q, chunks: [], durationMs: 0 };
  }

  async index(
    _scope: RetrievalScope,
    _content: string,
    _metadata?: Record<string, string | number | boolean>,
  ): Promise<void> {
    // no-op until a vector store is wired
  }

  isReady(): boolean {
    return false; // signals to callers: retrieval not yet available
  }
}

// Singleton — import this directly throughout the system
export const retrievalBridge: RetrievalAdapter = new StubRetrievalAdapter();
