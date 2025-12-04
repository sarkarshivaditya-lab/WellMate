import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
  const [showMoodDialog, setShowMoodDialog] = useState(false);
  
  const today = new Date().toISOString().split("T")[0];
  const todayMood = useQuery(api.moods.getMoodByDate, { dateIso: today });
  const recentMoods = useQuery(api.moods.listMoods, { limit: 7 });
  const recentEntries = useQuery(api.journal.listJournalEntries, { limit: 3 });
  
  const addMood = useMutation(api.moods.addMood);

  const handleSaveMood = async (moodValue: number, note: string) => {
    try {
      await addMood({ dateIso: today, moodValue, note });
      toast.success("Mood saved!");
      setShowMoodDialog(false);
    } catch (error) {
      toast.error("Failed to save mood");
    }
  };

  // Get suggested practice (random)
  interface Practice {
    id: string;
    title: string;
    type: "breathing" | "gratitude" | "reflection" | "grounding";
    steps: string[];
  }
  const suggestedPractice = practicesData[Math.floor(Math.random() * practicesData.length)] as Practice;

  if (todayMood === undefined || recentMoods === undefined || recentEntries === undefined) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const moodData = recentMoods.map((m: { moodValue: number }) => m.moodValue).reverse();

  return (
    <div className="space-y-6 p-4 pb-24">
      {/* Today's Mood */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's Mood</CardTitle>
        </CardHeader>
        <CardContent>
          {todayMood ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{moodEmojis[todayMood.moodValue - 1]}</span>
                <div>
                  <p className="font-medium text-lg">{moodLabels[todayMood.moodValue - 1]}</p>
                  {todayMood.note && (
                    <p className="text-sm text-muted-foreground mt-1">{todayMood.note}</p>
                  )}
                </div>
              </div>
              <Dialog open={showMoodDialog} onOpenChange={setShowMoodDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Your Mood</DialogTitle>
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
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">You haven't logged your mood today</p>
              <Dialog open={showMoodDialog} onOpenChange={setShowMoodDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Mood
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>How Are You Feeling?</DialogTitle>
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
            <CardTitle className="text-lg">7-Day Mood Trend</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <MiniLineChart data={moodData} width={320} height={100} color="#10b981" />
          </CardContent>
        </Card>
      )}



      {/* Suggested Practice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Suggested Practice for Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PracticeCard practice={suggestedPractice} />
          <p className="text-xs text-muted-foreground mt-3">
            Tip: Visit the Tools tab to see all practices
          </p>
        </CardContent>
      </Card>

      {/* Journal Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            Recent Journal Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length > 0 ? (
            <div className="space-y-2">
              {recentEntries.map((entry: { _id: string; text: string; dateIso: string }) => (
                <div
                  key={entry._id}
                  className="p-3 bg-secondary/50 rounded-lg"
                >
                  <p className="text-sm line-clamp-2">{entry.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(entry.dateIso).toLocaleDateString()}
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Visit the Journal tab to see all entries
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No journal entries yet</p>
              <p className="text-xs text-muted-foreground mt-2">
                Visit the Journal tab to start writing
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
