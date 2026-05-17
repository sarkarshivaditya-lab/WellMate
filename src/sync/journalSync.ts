import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { listPendingJournalEntries, markJournalEntrySynced } from "@/data/local/journalStore";
import { isUnauthError } from "./syncUtils";

/**
 * Best-effort local → Convex mirror for journal entries.
 *
 * Only pushes entries with syncStatus === "pending". After a successful
 * Convex write the record is marked "synced" and is never pushed again.
 *
 * Note: the Convex backend deduplicates by (userId, dateIso). When multiple
 * local entries share a date, the most recently pushed one wins in Convex.
 * Local storage retains all entries regardless.
 *
 * On UNAUTHENTICATED: aborts immediately. Entries stay "pending".
 */
export async function syncJournal(convex: ConvexReactClient) {
  const pending = listPendingJournalEntries();
  if (pending.length === 0) return;

  for (const e of pending) {
    try {
      await convex.mutation(api.journal.addJournalEntry, {
        dateIso: e.dateIso,
        text: e.text,
        tags: e.tags,
      });

      try {
        markJournalEntrySynced(e.localId);
      } catch {
        // local write failure is non-fatal
      }
    } catch (err) {
      if (isUnauthError(err)) {
        return;
      }
      // Other errors: leave as "pending" for retry
    }
  }
}
