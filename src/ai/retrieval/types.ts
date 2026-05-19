// Interface contracts for the future retrieval-augmented generation (RAG) layer.
// No implementation yet — these types define the integration surface so that
// the rest of the system can be written against a stable contract now.

export type RetrievalScope =
  | "wellness_logs"
  | "habit_history"
  | "sleep_history"
  | "nutrition_logs"
  | "mood_history"
  | "journal_entries"
  | "all";

export type RetrievalQuery = {
  text: string;             // natural-language query
  scope: RetrievalScope[];  // which data domains to search
  topK: number;             // maximum results to return
  minScore?: number;        // minimum similarity threshold (0–1)
  windowDays?: number;      // restrict to data from the last N days
};

export type RetrievalChunk = {
  id: string;
  scope: RetrievalScope;
  content: string;          // human-readable excerpt
  score: number;            // similarity score (0–1)
  timestamp: number;        // when this data was originally created
  metadata: Record<string, string | number | boolean>;
};

export type RetrievalResult = {
  query: RetrievalQuery;
  chunks: RetrievalChunk[];
  durationMs: number;
};

export interface RetrievalAdapter {
  query(q: RetrievalQuery): Promise<RetrievalResult>;
  index(
    scope: RetrievalScope,
    content: string,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<void>;
  isReady(): boolean;
}
