// First real user-facing AI surface.
// Shows a grounded, personalized reflection powered by Phi-3 local inference.
// Only renders when presence rules confirm meaningful continuity exists.
// Stays invisible when data is too sparse or the user dismissed it.

import React from "react";
import { X, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { openWellMate } from "@/ai/wellMateEvents";
import {
  generateDailyReflection,
  getStoredReflection,
  isReflectionStale,
} from "@/ai/reflection/reflectionEngine";
import { evaluatePresence, suppressPresenceFor } from "@/ai/presence/presenceRules";

type CardState =
  | "checking"    // evaluating presence
  | "hidden"      // presence rules: not enough data
  | "generating"  // running inference
  | "ready"       // reflection available
  | "error";      // inference failed or safety blocked

export function DailyReflectionCard() {
  const [state, setState] = React.useState<CardState>("checking");
  const [text, setText] = React.useState("");
  const [streamedText, setStreamedText] = React.useState("");
  const [confidence, setConfidence] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      const presence = evaluatePresence();
      if (!presence.show) {
        if (!cancelled) setState("hidden");
        return;
      }

      // Show cached reflection immediately
      const cached = getStoredReflection("daily");
      if (cached && !isReflectionStale("daily")) {
        if (!cancelled) {
          setText(cached.text);
          setConfidence(cached.confidence);
          setState("ready");
        }
        return;
      }

      // Generate fresh reflection
      if (!cancelled) setState("generating");

      const result = await generateDailyReflection({
        onToken: (token) => {
          if (!cancelled) setStreamedText((prev) => prev + token);
        },
      });

      if (cancelled) return;

      if (!result) {
        setState("hidden"); // no meaningful reflection — stay invisible
        return;
      }

      setText(result.text);
      setConfidence(result.confidence);
      setState("ready");
    }

    load().catch(() => {
      if (!cancelled) setState("hidden");
    });

    return () => { cancelled = true; };
  }, []);

  function handleDismiss() {
    suppressPresenceFor(24);
    setState("hidden");
  }

  function handleAsk() {
    const followUp = text
      ? `I noticed this about my wellness: "${text.slice(0, 120)}". Can you help me reflect on it?`
      : "What patterns do you notice in my recent wellness data?";
    openWellMate({ prompt: followUp });
  }

  if (state === "checking" || state === "hidden" || state === "error") return null;

  const displayText = state === "generating" ? streamedText : text;

  return (
    <Card className="border-border/25 bg-background/50">
      <CardContent className="py-5 px-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-foreground/30 flex-shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Reflection
            </p>
          </div>
          {state === "ready" && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="text-muted-foreground/25 hover:text-muted-foreground/55 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Reflection text */}
        <p className="text-[13.5px] text-foreground/75 leading-relaxed">
          {displayText}
          {state === "generating" && (
            <span className="inline-block w-1 h-3.5 bg-foreground/30 ml-0.5 animate-pulse align-middle" />
          )}
        </p>

        {/* Contextual CTA — only when ready */}
        {state === "ready" && text && (
          <button
            type="button"
            onClick={handleAsk}
            className="text-[11.5px] text-muted-foreground/50 hover:text-foreground/60 transition-colors"
          >
            Explore with WellMate →
          </button>
        )}

        {/* Confidence indicator — subtle, not a number */}
        {state === "ready" && confidence < 0.4 && (
          <p className="text-[10.5px] text-muted-foreground/35">
            Based on limited data — more entries improve accuracy.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
