import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import { Skeleton } from "@/components/ui/skeleton";
import MoodSelector from "@/components/MoodSelector";
import MiniLineChart from "@/components/MiniLineChart";
import PracticeCard from "@/components/PracticeCard";
import { PlusIcon, BookOpenIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import practicesData from "@/data/practices.json";

const moodEmojis = ["😢", "😔", "😐", "😊", "😄"];
const moodLabels = ["Very Low", "Low", "Okay", "Good", "Excellent"];

export default function Overview() {
  const [tab, setTab] = useState<"overview" | "journal" | "tools">("overview");
  const [showMoodDialog, setShowMoodDialog] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const todayMood = useQuery(api.moods.getMoodByDate, { dateIso: today });
  const recentMoods = useQuery(api.moods.listMoods, { limit: 7 });
  const recentEntries = useQuery(api.journal.listJournalEntries, { limit: 3 });

  const addMood = useMutation(api.moods.addMood);

  const handleSaveMood = async (moodValue: number, note: string) => {
    try {
      await addMood({ dateIso: today, moodValue, note });
      toast.success("Mood noted");
      setShowMoodDialog(false);
    } catch {
      toast.error("Couldn’t save mood right now");
    }
  };

  interface Practice {
    id: string;
    title: string;
    type: "breathing" | "gratitude" | "reflection" | "grounding";
    steps: string[];
  }

  const suggestedPractice =
    practicesData[
      Math.floor(Math.random() * practicesData.length)
    ] as Practice;

  if (
    todayMood === undefined ||
    recentMoods === undefined ||
    recentEntries === undefined
  ) {
    return (
      <PageLayout title="Mental Wellbeing">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (recentMoods === null || recentEntries === null) {
    return (
      <PageLayout
        title="Mental Wellbeing"
        subtitle="Mood, reflection, and gentle mental care."
      >
        <div className="py-12 text-center text-sm text-muted-foreground">
          Sign in to view your mood trends and journal entries.
        </div>
      </PageLayout>
    );
  }

  const moodData = recentMoods
    .map((m: { moodValue: number }) => m.moodValue)
    .reverse();

  return (
    <PageLayout
      title="Mental Wellbeing"
      subtitle="Mood, reflection, and gentle mental care."
      tabs={[
        { label: "Overview", value: "overview" },
        { label: "Journal", value: "journal" },
        { label: "Tools", value: "tools" },
      ]}
      activeTab={tab}
      onTabChange={(v) =>
        setTab(v as "overview" | "journal" | "tools")
      }
    >
      {/* ---------- OVERVIEW TAB ---------- */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Today's Mood */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today’s Mood</CardTitle>
            </CardHeader>
            <CardContent>
              {todayMood ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">
                      {moodEmojis[todayMood.moodValue - 1]}
                    </span>
                    <div>
                      <p className="text-lg font-medium">
                        {moodLabels[todayMood.moodValue - 1]}
                      </p>
                      {todayMood.note && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {todayMood.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <Dialog
                    open={showMoodDialog}
                    onOpenChange={setShowMoodDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          How are you feeling right now?
                        </DialogTitle>
                      </DialogHeader>
                      <MoodSelector
                        initialMood={todayMood.moodValue}
                        initialNote={todayMood.note}
                        onSave={handleSaveMood}
                        onCancel={() => setShowMoodDialog(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              ) : todayMood === null ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sign in to track your mood.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Once auth is wired, youll be able to check in here.
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You haven’t checked in with yourself today
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Noticing your mood can help build awareness over time
                  </p>
                  <Dialog
                    open={showMoodDialog}
                    onOpenChange={setShowMoodDialog}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Check in
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          How are you feeling right now?
                        </DialogTitle>
                      </DialogHeader>
                      <MoodSelector
                        onSave={handleSaveMood}
                        onCancel={() => setShowMoodDialog(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7-Day Trend */}
          {moodData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Mood over the past week
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <MiniLineChart
                  data={moodData}
                  width={320}
                  height={100}
                  color="#10b981"
                />
              </CardContent>
            </Card>
          )}

          {/* Suggested Practice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <SparklesIcon className="h-5 w-5" />
                A gentle practice for today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PracticeCard practice={suggestedPractice} />
              <p className="mt-3 text-xs text-muted-foreground">
                You can explore more practices anytime in the Tools tab
              </p>
            </CardContent>
          </Card>

          {/* Journal Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpenIcon className="h-5 w-5" />
                Recent reflections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEntries.length > 0 ? (
                <div className="space-y-2">
                  {recentEntries.map(
                    (entry: {
                      _id: string;
                      text: string;
                      dateIso: string;
                    }) => (
                      <div
                        key={entry._id}
                        className="rounded-lg bg-secondary/50 p-3"
                      >
                        <p className="line-clamp-2 text-sm">
                          {entry.text}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(
                            entry.dateIso,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    ),
                  )}
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Visit the Journal tab to read or write more
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">
                    No reflections yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Writing can help clarify thoughts — when you’re ready
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- JOURNAL TAB ---------- */}
      {tab === "journal" && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Visit the Journal section to write or revisit reflections.
        </div>
      )}

      {/* ---------- TOOLS TAB ---------- */}
      {tab === "tools" && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Visit the Tools section to explore calming practices.
        </div>
      )}
    </PageLayout>
  );
}
