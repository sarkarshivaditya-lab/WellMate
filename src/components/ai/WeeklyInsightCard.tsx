// Weekly AI insight card — first user-facing AI surface.
// Shows WellMate's longitudinal summary with a grounded contextual observation
// and an "Ask WellMate" entry point for deeper exploration.
//
// Designed to feel like a calm, factual observation — not a notification.
// Renders only when there is something meaningful to say.

import React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { openWellMate } from "@/ai/wellMateEvents";
import {
  getLongitudinalSummary,
  generateLongitudinalSummary,
  isSummaryStale,
  type LongitudinalSummary,
} from "@/ai/memory/longitudinalSummary";
import { haptics } from "@/motion/haptics";
import { cn } from "@/lib/utils";

function buildInsightText(summary: LongitudinalSummary): string {
  // Choose the most salient observation — mood > sleep > habits > overall
  const { moodSentence, sleepSentence, habitSentence, overallWellnessSentence } = summary;

  const hasRealMood = !moodSentence.includes("No mood");
  const hasRealSleep = !sleepSentence.includes("No sleep");

  if (hasRealMood) return moodSentence;
  if (hasRealSleep) return sleepSentence;
  if (!habitSentence.includes("No habits")) return habitSentence;
  return overallWellnessSentence;
}

function buildFollowUpPrompt(summary: LongitudinalSummary): string {
  // Generate a contextual question based on what the summary reveals
  const { moodSentence, sleepSentence, overallWellnessSentence } = summary;

  if (moodSentence.includes("low") && !moodSentence.includes("No mood")) {
    return "My mood has been low this week. What might be contributing to this, and what can I gently do about it?";
  }
  if (sleepSentence.includes("below") || (sleepSentence.match(/(\d+\.?\d*) hours/) ?? [])[1] !== undefined) {
    const hoursMatch = sleepSentence.match(/(\d+\.?\d*) hours/);
    if (hoursMatch && parseFloat(hoursMatch[1]) < 7) {
      return "My sleep has been shorter than ideal this week. What are some gentle approaches to improving it?";
    }
  }
  if (overallWellnessSentence.includes("positive") || moodSentence.includes("great") || moodSentence.includes("good")) {
    return "My wellness has been good this week. What should I build on or pay attention to going forward?";
  }
  return "How is my overall wellness looking based on what I've tracked this week?";
}

export function WeeklyInsightCard() {
  const [summary, setSummary] = React.useState<LongitudinalSummary | null>(null);

  React.useEffect(() => {
    // Synchronous — all data comes from localStorage, no async needed
    const existing = getLongitudinalSummary();
    if (!existing || isSummaryStale()) {
      setSummary(generateLongitudinalSummary());
    } else {
      setSummary(existing);
    }
  }, []);

  if (!summary) return null;

  const hasNoData =
    summary.moodSentence.includes("No mood") &&
    summary.sleepSentence.includes("No sleep") &&
    summary.journalHighlight.includes("No journal");

  // Don't show the card if there's genuinely no data to speak to
  if (hasNoData) return null;

  const insightText = buildInsightText(summary);
  const followUpPrompt = buildFollowUpPrompt(summary);

  function handleAsk() {
    haptics.light();
    openWellMate({ prompt: followUpPrompt });
  }

  return (
    <Card className={cn("border-border/30 bg-muted/8 overflow-hidden")}>
      <CardContent className="py-5 px-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary/40 flex-shrink-0" />
          <p className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted-foreground/45">
            WellMate · This week
          </p>
        </div>

        {/* Insight text */}
        <p className="text-[13.5px] text-foreground/65 leading-relaxed">
          {insightText}
        </p>

        {/* Ask WellMate entry */}
        <button
          type="button"
          onClick={handleAsk}
          className={cn(
            "flex items-center gap-1.5",
            "text-[12px] text-primary/50 hover:text-primary/75",
            "transition-colors active:scale-[0.98]",
          )}
        >
          <span>Ask WellMate about this</span>
          <span className="text-primary/35">→</span>
        </button>
      </CardContent>
    </Card>
  );
}
