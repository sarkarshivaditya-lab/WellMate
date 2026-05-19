// Journal page AI presence — surfaces one pattern or theme from recent entries.
// Appears only when enough journal data exists for meaningful reflection.
// Non-intrusive: renders as a subtle card, not a chatbot prompt.

import React from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openWellMate } from "@/ai/wellMateEvents";
import {
  generateJournalReflection,
  getStoredReflection,
  isReflectionStale,
} from "@/ai/reflection/reflectionEngine";
import { getAllLocalJournalEntries } from "@/data/local/journalStore";

type CardState = "checking" | "hidden" | "generating" | "ready";

const MIN_ENTRIES_TO_SHOW = 3;

export function JournalReflectionCard() {
  const [state, setState] = React.useState<CardState>("checking");
  const [text, setText] = React.useState("");
  const [streamedText, setStreamedText] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      // Minimum entry threshold — no point reflecting on 1-2 entries
      const entries = getAllLocalJournalEntries();
      if (entries.length < MIN_ENTRIES_TO_SHOW) {
        if (!cancelled) setState("hidden");
        return;
      }

      // Show cached
      const cached = getStoredReflection("journal");
      if (cached && !isReflectionStale("journal")) {
        if (!cancelled) {
          setText(cached.text);
          setState("ready");
        }
        return;
      }

      if (!cancelled) setState("generating");

      const result = await generateJournalReflection({
        onToken: (token) => {
          if (!cancelled) setStreamedText((prev) => prev + token);
        },
      });

      if (cancelled) return;

      if (!result) {
        setState("hidden");
        return;
      }

      setText(result.text);
      setState("ready");
    }

    load().catch(() => {
      if (!cancelled) setState("hidden");
    });

    return () => { cancelled = true; };
  }, []);

  function handleExplore() {
    const prompt = text
      ? `You noticed this about my journal: "${text.slice(0, 120)}". I'd like to reflect on this.`
      : "What themes do you notice across my recent journal entries?";
    openWellMate({ prompt });
  }

  if (state === "checking" || state === "hidden") return null;

  const displayText = state === "generating" ? streamedText : text;

  return (
    <Card className="border-border/20 bg-muted/8">
      <CardContent className="py-5 px-5 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-foreground/25 flex-shrink-0" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/45">
            Journal pattern
          </p>
        </div>

        <p className="text-[13.5px] text-foreground/70 leading-relaxed">
          {displayText}
          {state === "generating" && (
            <span className="inline-block w-1 h-3.5 bg-foreground/25 ml-0.5 animate-pulse align-middle" />
          )}
        </p>

        {state === "ready" && text && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExplore}
            className="text-[11.5px] h-7 px-0 text-muted-foreground/55 hover:text-foreground/65 hover:bg-transparent"
          >
            Reflect with WellMate →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
