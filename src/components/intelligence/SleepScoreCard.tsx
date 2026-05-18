// src/components/intelligence/SleepScoreCard.tsx
// Sleep intelligence card for the Sleep page.
// Surfaces sleep score, recovery readiness, debt, and key signals.

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { ScoreExplainerSheet } from "./ScoreExplainerSheet";
import { InsightCard, InsightCardHeader } from "@/components/ui/insight-card";
import { SignalPill } from "@/components/ui/signal-pill";
import { TrendBadge } from "@/components/ui/trend-badge";
import type { WellnessScore, SleepDebt } from "@/intelligence/types";

type Props = {
  sleepScore: WellnessScore;
  sleepDebt: SleepDebt;
  recoveryReadiness: { score: number; label: string; context: string };
  className?: string;
};

export function SleepScoreCard({
  sleepScore,
  sleepDebt,
  recoveryReadiness,
  className,
}: Props) {
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <>
    <ScoreExplainerSheet
      open={explainOpen}
      onClose={() => setExplainOpen(false)}
      score={sleepScore}
      domainLabel="Sleep"
    />
    <InsightCard
      insufficient={sleepScore.dataQuality === "insufficient"}
      insufficientLabel="Sleep Intelligence"
      insufficientBody={sleepScore.explanation}
      className={className}
    >
      {/* Score header */}
      <InsightCardHeader
        leading={
          <ScoreRing
            score={sleepScore.score}
            level={sleepScore.level}
            size={60}
            label="Sleep"
          />
        }
        title={sleepScore.headline}
        body={sleepScore.explanation}
        trailing={<TrendBadge trend={sleepScore.trend} />}
        onExplain={sleepScore.dataQuality !== "insufficient" ? () => setExplainOpen(true) : undefined}
      />

      {/* Signal grid */}
      {sleepScore.signals.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {sleepScore.signals.slice(0, 4).map((sig) => (
            <SignalPill
              key={sig.label}
              label={sig.label}
              value={sig.value}
              positive={sig.positive}
            />
          ))}
        </div>
      )}

      {/* Recovery readiness + debt row */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Recovery readiness
          </p>
          <p className={cn(
            "text-sm font-semibold mt-0.5",
            recoveryReadiness.score >= 70 ? "text-emerald-600 dark:text-emerald-400"
              : recoveryReadiness.score >= 45 ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}>
            {recoveryReadiness.label}
          </p>
        </div>

        {sleepDebt.hoursDebt > 0 && (
          <div className="flex-1 rounded-xl bg-muted/40 border border-border/30 px-3 py-2.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Sleep debt (7d)
            </p>
            <p className="text-sm font-semibold mt-0.5 text-amber-600 dark:text-amber-400">
              −{sleepDebt.hoursDebt}h
            </p>
          </div>
        )}
      </div>

      {/* Recovery context */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {recoveryReadiness.context}
      </p>
    </InsightCard>
    </>
  );
}
