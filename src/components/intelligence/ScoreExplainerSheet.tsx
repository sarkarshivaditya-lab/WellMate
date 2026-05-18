// src/components/intelligence/ScoreExplainerSheet.tsx
// Universal domain score explanation sheet — slides up from bottom on tap.
// Shows the full explanation, all contributing factors, and data quality context.
// The sheet exists because InsightCardHeader body is line-clamp-2 by design;
// this is the intentional "read more" surface for every intelligence card.

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SignalPill } from "@/components/ui/signal-pill";
import { TrendBadge } from "@/components/ui/trend-badge";
import { ScoreRing } from "./ScoreRing";
import type { WellnessScore } from "@/intelligence/types";

type Props = {
  open: boolean;
  onClose: () => void;
  score: WellnessScore;
  domainLabel: string;
  lookbackDays?: number;
};

export function ScoreExplainerSheet({
  open,
  onClose,
  score,
  domainLabel,
  lookbackDays = 30,
}: Props) {
  const positiveSignals = score.signals.filter((s) => s.positive);
  const cautionSignals = score.signals.filter((s) => !s.positive);

  const dataNote =
    score.dataQuality === "partial"
      ? `Accuracy will improve with more ${domainLabel.toLowerCase()} entries. The current score reflects the data logged so far.`
      : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[84dvh] overflow-y-auto rounded-t-2xl"
      >
        {/* Required for accessibility — visually hidden */}
        <SheetTitle className="sr-only">{domainLabel} score details</SheetTitle>

        <div className="px-4 pt-4 pb-8 space-y-5">

          {/* Score ring + headline + trend + domain/window label */}
          <div className="flex items-center gap-4">
            <ScoreRing
              score={score.score}
              level={score.level}
              size={52}
              label={domainLabel}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold leading-tight">{score.headline}</p>
                <TrendBadge trend={score.trend} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                {domainLabel} · past {lookbackDays} days
              </p>
            </div>
          </div>

          {/* Why this score — full text, no line-clamp */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Why this score
            </p>
            <p className="text-[13px] text-foreground/80 leading-relaxed">
              {score.explanation}
            </p>
          </div>

          {/* Contributing factors — positive and caution separated */}
          {score.signals.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                Contributing factors
              </p>
              {positiveSignals.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {positiveSignals.map((sig) => (
                    <SignalPill
                      key={sig.label}
                      label={sig.label}
                      value={sig.value}
                      positive
                    />
                  ))}
                </div>
              )}
              {cautionSignals.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {cautionSignals.map((sig) => (
                    <SignalPill
                      key={sig.label}
                      label={sig.label}
                      value={sig.value}
                      positive={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data quality caveat — only when data is limited */}
          {dataNote && (
            <div className="rounded-xl bg-muted/30 border border-border/20 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {dataNote}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
