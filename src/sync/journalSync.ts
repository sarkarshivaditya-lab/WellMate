import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listJournalEntries } from "@/data/local/journalStore";

/**
 * Best-effort local → Convex mirror for journal
 */
export async function syncJournal(convex: ConvexReactClient) {
  const entries = listJournalEntries(100);

  for (const e of entries) {
    await convex.mutation(api.journal.addJournalEntry, {
      dateIso: e.dateIso,
      text: e.text,
      tags: e.tags,
    });
  }
}
