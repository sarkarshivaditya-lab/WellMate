import { toast } from "sonner";

const JOURNAL_DRAFT_KEY = "wellmate_journal_draft";

type JournalDraft = { title: string; body: string; mood?: number };

function readDraft(): JournalDraft | null {
  try {
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as JournalDraft) : null;
  } catch (error) {
    console.error("Unable to read journal draft:", error instanceof Error ? error.message : "storage read failed");
    return null;
  }
}

function saveDraft(d: JournalDraft) {
  try {
    if (d.title || d.body) {
      localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify(d));
    } else {
      localStorage.removeItem(JOURNAL_DRAFT_KEY);
    }
  } catch (error) {
    console.error("Unable to save journal draft:", error instanceof Error ? error.message : "storage write failed");
    toast.error("Your journal draft could not be saved on this device.");
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(JOURNAL_DRAFT_KEY);
  } catch (error) {
    console.error("Unable to clear journal draft:", error instanceof Error ? error.message : "storage remove failed");
  }
}
