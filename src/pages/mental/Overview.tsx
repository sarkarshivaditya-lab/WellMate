import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import MoodSelector from "@/components/MoodSelector";
import MiniLineChart from "@/components/MiniLineChart";
import PracticeCard, { type Practice } from "@/components/PracticeCard";
import JournalCard from "@/components/JournalCard";
import { CoachTabContent } from "./AiMentalCoach";
import { ToolsTabContent } from "./Tools";
import {
  listJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  type LocalJournalEntry,
} from "@/data/local/journalStore";
import { cn } from "@/lib/utils";
import { PlusIcon, BookOpenIcon, SparklesIcon, X } from "lucide-react";
import { localDateIso } from "@/services/dateUtils";
import practicesData from "@/data/practices.json";
import { useFeatureTracker, emitAnalyticsEvent } from "@/analytics";
import { haptics } from "@/motion";
import { useFirstWeek } from "@/hooks/useFirstWeek";

/* ======================================================
   LOCAL MOOD STORE — lightweight, no dependency
   ====================================================== */

type LocalMood = {
  moodValue: number;
  note?: string;
  dateIso: string;
};

function getLocalMoods(): LocalMood[] {
  try {
    return JSON.parse(localStorage.getItem("mental.moods") || "[]");
  } catch {
    return [];
  }
}

const MOOD_EMOJIS = ["😢", "😔", "😐", "😊", "😄"];
const MOOD_LABELS = ["Very Low", "Low", "Okay", "Good", "Great"];

/* ======================================================
   JOURNAL DRAFT — persists across editor dismissals
   ====================================================== */

const JOURNAL_DRAFT_KEY = "wellmate_journal_draft";

type JournalDraft = { title: string; body: string; mood?: number };

function readDraft(): JournalDraft | null {
  try {
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as JournalDraft) : null;
  } catch {
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
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(JOURNAL_DRAFT_KEY);
  } catch {}
}

/* ======================================================
   FIRST-WEEK WELCOME CARD
   Same dismissed key as PhysicalDashboard — shown once, anywhere.
   ====================================================== */

const WELCOME_DISMISSED_KEY = "wellmate_welcome_dismissed";

function WelcomeCard() {
  const { isFirstWeek } = useFirstWeek();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(WELCOME_DISMISSED_KEY) === "true",
  );

  if (!isFirstWeek || dismissed) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold">Welcome to WellMate</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This is your mental wellbeing space — mood check-ins, journaling, and gentle tools. Start with whatever feels right.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss welcome message"
            onClick={() => {
              localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
              setDismissed(true);
            }}
            className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0 mt-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ======================================================
   OVERVIEW
   ====================================================== */

export default function Overview() {
  useFeatureTracker("mental");
  const [tab, setTab] = useState<"overview" | "journal" | "coach" | "tools">("overview");
  const [showMoodDialog, setShowMoodDialog] = useState(false);

  // Journal state
  const [entries, setEntries] = useState<LocalJournalEntry[]>(() => listJournalEntries());
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LocalJournalEntry | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [editorMood, setEditorMood] = useState<number | undefined>(undefined);
  const [draftRestored, setDraftRestored] = useState(false);

  // Auto-save draft whenever the new-entry editor content changes
  useEffect(() => {
    if (!showEditor || editingEntry) return;
    saveDraft({ title: editorTitle, body: editorBody, mood: editorMood });
  }, [showEditor, editingEntry, editorTitle, editorBody, editorMood]);

  const today = localDateIso();
  const moods = getLocalMoods();
  const todayMood = moods.find((m) => m.dateIso === today) ?? null;
  const recentMoods = moods.slice(-7);
  const moodData = recentMoods.map((m) => m.moodValue);
  // Stabilize with useState so it doesn't re-randomize on every render
  const [suggestedPractice] = useState(
    () => practicesData[Math.floor(Math.random() * practicesData.length)] as Practice,
  );

  // Journal helpers
  function refreshEntries() {
    setEntries(listJournalEntries());
  }

  function openNewEntry() {
    const draft = readDraft();
    setEditingEntry(null);
    if (draft && (draft.title || draft.body)) {
      setEditorTitle(draft.title);
      setEditorBody(draft.body);
      setEditorMood(draft.mood);
      setDraftRestored(true);
    } else {
      setEditorTitle("");
      setEditorBody("");
      setEditorMood(undefined);
      setDraftRestored(false);
    }
    setShowEditor(true);
  }

  function openEditEntry(entry: LocalJournalEntry) {
    setEditingEntry(entry);
    setEditorTitle(entry.title ?? "");
    setEditorBody(entry.text);
    setEditorMood(entry.mood);
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingEntry(null);
    setDraftRestored(false);
    // Draft is intentionally left in localStorage — restored on next openNewEntry()
  }

  function handleSaveEntry() {
    if (!editorBody.trim()) return;
    if (editingEntry) {
      updateJournalEntry(editingEntry.localId, {
        title: editorTitle.trim() || undefined,
        text: editorBody.trim(),
        mood: editorMood,
      });
    } else {
      addJournalEntry({
        title: editorTitle.trim() || undefined,
        text: editorBody.trim(),
        tags: [],
        mood: editorMood,
      });
      emitAnalyticsEvent({ type: "wellness_logged", entity: "journal", ts: Date.now() });
    }
    clearDraft();
    haptics.complete();
    refreshEntries();
    closeEditor();
  }

  function handleDeleteEntry(localId: string) {
    haptics.destructive();
    deleteJournalEntry(localId);
    refreshEntries();
  }

  function handleSaveMood(moodValue: number, note: string) {
    const next: LocalMood = { dateIso: today, moodValue, note };
    const filtered = moods.filter((m) => m.dateIso !== today);
    localStorage.setItem("mental.moods", JSON.stringify([...filtered, next]));
    haptics.gentle();
    emitAnalyticsEvent({ type: "wellness_logged", entity: "mood", ts: Date.now() });
    setShowMoodDialog(false);
  }

  return (
    <PageLayout
      title="Mental Wellbeing"
      subtitle="Mood, reflection, and gentle mental care."
      tabs={[
        { label: "Overview", value: "overview" },
        { label: "Journal", value: "journal" },
        { label: "Coach", value: "coach" },
        { label: "Tools", value: "tools" },
      ]}
      activeTab={tab}
      onTabChange={(v) => setTab(v as typeof tab)}
    >
      {/* ──────────────────────────────────────────────
          OVERVIEW TAB
      ────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div key="overview" className="space-y-6 animate-wm-tab-in">
          <WelcomeCard />

          {/* Today's Mood */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Mood</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Single Dialog instance — content adapts based on todayMood */}
              <Dialog open={showMoodDialog} onOpenChange={setShowMoodDialog}>
                {todayMood ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">{MOOD_EMOJIS[todayMood.moodValue - 1]}</span>
                      <div>
                        <p className="text-lg font-medium">{MOOD_LABELS[todayMood.moodValue - 1]}</p>
                        {todayMood.note && (
                          <p className="mt-1 text-sm text-muted-foreground">{todayMood.note}</p>
                        )}
                      </div>
                    </div>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Update</Button>
                    </DialogTrigger>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      How are you feeling today?
                    </p>
                    <DialogTrigger asChild>
                      <Button>
                        <PlusIcon className="h-4 w-4" />
                        Check in
                      </Button>
                    </DialogTrigger>
                  </div>
                )}
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>How are you feeling right now?</DialogTitle>
                  </DialogHeader>
                  <MoodSelector
                    initialMood={todayMood?.moodValue}
                    initialNote={todayMood?.note}
                    onSave={handleSaveMood}
                    onCancel={() => setShowMoodDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* 7-Day Mood Trend */}
          {moodData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mood over the past week</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <MiniLineChart data={moodData} width={320} height={100} color="#10b981" />
              </CardContent>
            </Card>
          )}

          {/* Suggested Practice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 text-primary/70" />
                A gentle practice for today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PracticeCard
                practice={suggestedPractice}
                onClick={() => setTab("tools")}
              />
            </CardContent>
          </Card>

          {/* Recent Journal Reflections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpenIcon className="h-4 w-4 text-primary/70" />
                  Recent reflections
                </CardTitle>
                {entries.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab("journal")}
                    className="text-xs text-muted-foreground"
                  >
                    View all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {entries.length > 0 ? (
                <div className="space-y-3">
                  {entries.slice(0, 3).map((entry) => (
                    <button
                      key={entry.localId}
                      onClick={() => { setTab("journal"); openEditEntry(entry); }}
                      className="w-full text-left rounded-xl bg-muted/40 p-3 hover:bg-muted/70 transition-premium"
                    >
                      {entry.title && (
                        <p className="text-xs font-semibold mb-0.5 text-foreground/90">{entry.title}</p>
                      )}
                      <p className="line-clamp-2 text-[13px] text-foreground/80">{entry.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Nothing written yet</p>
                  <p className="text-xs text-muted-foreground/60">
                    Even a sentence or two can help you understand how you feel.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => { setTab("journal"); openNewEntry(); }}
                  >
                    Write your first entry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          JOURNAL TAB
      ────────────────────────────────────────────── */}
      {tab === "journal" && (
        <div key="journal" className="space-y-4 animate-wm-tab-in">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {entries.length === 0
                ? "No entries yet"
                : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            </p>
            <Button size="sm" onClick={openNewEntry}>
              <PlusIcon className="h-4 w-4" />
              New Entry
            </Button>
          </div>

          {entries.length === 0 ? (
            <Empty className="min-h-[320px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpenIcon />
                </EmptyMedia>
                <EmptyTitle>Your journal is empty</EmptyTitle>
                <EmptyDescription>
                  A private space for thoughts, feelings, and reflections — without judgment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={openNewEntry}>
                  <PlusIcon className="h-4 w-4" />
                  Write your first entry
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <JournalCard
                  key={entry.localId}
                  entry={entry}
                  onEdit={() => openEditEntry(entry)}
                  onDelete={() => handleDeleteEntry(entry.localId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          COACH TAB
      ────────────────────────────────────────────── */}
      {tab === "coach" && (
        <div key="coach" className="animate-wm-tab-in">
          <CoachTabContent />
        </div>
      )}

      {/* ──────────────────────────────────────────────
          TOOLS TAB
      ────────────────────────────────────────────── */}
      {tab === "tools" && (
        <div key="tools" className="animate-wm-tab-in">
          <ToolsTabContent />
        </div>
      )}

      {/* ──────────────────────────────────────────────
          JOURNAL EDITOR — always mounted, accessible from any tab
      ────────────────────────────────────────────── */}
      <Dialog open={showEditor} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[92dvh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/40">
            <DialogTitle className="text-base font-semibold">
              {editingEntry ? "Edit entry" : "New entry"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Draft restored indicator */}
            {draftRestored && (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Draft restored</p>
                <button
                  type="button"
                  onClick={() => {
                    clearDraft();
                    setEditorTitle("");
                    setEditorBody("");
                    setEditorMood(undefined);
                    setDraftRestored(false);
                  }}
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  Discard
                </button>
              </div>
            )}

            {/* Optional title */}
            <Input
              placeholder="Title (optional)"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              className="border-border/50 bg-transparent text-sm font-medium placeholder:text-muted-foreground/60"
            />

            {/* Mood chips */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                How are you feeling?
              </p>
              <div className="flex gap-2">
                {MOOD_EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditorMood(editorMood === i + 1 ? undefined : i + 1)}
                    aria-label={MOOD_LABELS[i]}
                    className={cn(
                      "flex-1 rounded-xl py-2.5 text-xl transition-premium",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      editorMood === i + 1
                        ? "bg-primary/12 ring-1 ring-primary/40 scale-[1.06]"
                        : "bg-muted/60 hover:bg-muted",
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Writing surface */}
            <Textarea
              placeholder="What's on your mind…"
              value={editorBody}
              onChange={(e) => setEditorBody(e.target.value)}
              rows={10}
              className={cn(
                "resize-none border-border/40 bg-transparent",
                "text-[15px] leading-[1.7] tracking-[0.01em]",
                "placeholder:text-muted-foreground/40",
                "focus-visible:ring-1 focus-visible:ring-primary/30",
              )}
            />
          </div>

          <div className="px-5 py-4 border-t border-border/40">
            <Button
              className="w-full"
              disabled={!editorBody.trim()}
              onClick={handleSaveEntry}
            >
              {editingEntry ? "Save changes" : "Save entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
