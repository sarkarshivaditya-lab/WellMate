// Journal indexing pipeline — converts LocalJournalEntry records into
// semantic vector store entries for retrieval-augmented generation.
//
// Scope: "journal_entries" (matches RetrievalScope union).
// Window: 90 days — older entries are unlikely to surface in casual context.
// Each entry keyed by localId so upserts are idempotent.

import { embedText, isEmbeddingReady } from "../embeddings/embeddingPipeline";
import { upsertVectorEntry } from "../embeddings/vectorStore";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";
import type { LocalJournalEntry } from "@/data/local/journalStore";

const SCOPE = "journal_entries";
const WINDOW_DAYS = 90;
const MAX_TEXT_CHARS = 400;

const MOOD_LABELS: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "neutral",
  4: "good",
  5: "great",
};

function composeChunk(entry: LocalJournalEntry): string {
  const parts: string[] = [];

  if (entry.title) parts.push(`Title: ${entry.title}`);

  const body =
    entry.text.length > MAX_TEXT_CHARS
      ? entry.text.slice(0, MAX_TEXT_CHARS) + "…"
      : entry.text;
  parts.push(body);

  if (entry.mood !== undefined && MOOD_LABELS[entry.mood]) {
    parts.push(`Mood: ${MOOD_LABELS[entry.mood]}`);
  }

  if (entry.tags.length > 0) {
    parts.push(`Tags: ${entry.tags.join(", ")}`);
  }

  return `Journal entry (${entry.dateIso}): ${parts.join(". ")}`;
}

export async function indexJournalEntries(): Promise<{
  indexed: number;
  skipped: number;
}> {
  if (!isEmbeddingReady()) return { indexed: 0, skipped: 0 };

  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  const entries = getAllLocalJournalEntries().filter(
    (e) => e.createdAt >= cutoff && e.text.trim().length > 0,
  );

  let indexed = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const text = composeChunk(entry);
      const embedding = Array.from(await embedText(text));
      await upsertVectorEntry({
        id: `journal_${entry.localId}`,
        scope: SCOPE,
        text,
        embedding,
        timestamp: entry.createdAt,
        metadata: {
          localId: entry.localId,
          dateIso: entry.dateIso,
          mood: entry.mood ?? 0,
          hasMood: entry.mood !== undefined,
        },
      });
      indexed++;
    } catch {
      skipped++;
    }
  }

  return { indexed, skipped };
}

// Re-index a single journal entry after write — called on journal mutations.
export async function reindexJournalEntry(localId: string): Promise<void> {
  if (!isEmbeddingReady()) return;

  const entry = getAllLocalJournalEntries().find((e) => e.localId === localId);
  if (!entry || entry.text.trim().length === 0) return;

  try {
    const text = composeChunk(entry);
    const embedding = Array.from(await embedText(text));
    await upsertVectorEntry({
      id: `journal_${entry.localId}`,
      scope: SCOPE,
      text,
      embedding,
      timestamp: entry.createdAt,
      metadata: {
        localId: entry.localId,
        dateIso: entry.dateIso,
        mood: entry.mood ?? 0,
        hasMood: entry.mood !== undefined,
      },
    });
  } catch {
    // Non-fatal
  }
}
