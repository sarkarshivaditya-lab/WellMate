// src/components/intelligence/WellnessScoreCard.tsx
// Composite wellness score card for the Overview page.
// Calm, explainable — shows score breakdown + top insight.

import React from "react";
import { Moon, Dumbbell, UtensilsCrossed, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { InsightCard } from "@/components/ui/insight-card";
import { scoreLevelColors } from "@/design/tokens";
import type { CompositeWellnessScore, WellnessScore, ScoreLevel } from "@/intelligence/types";

const DOMAIN_CONFIG = {
  sleep:     { label: "Sleep",     Icon: Moon },
  activity:  { label: "Activity",  Icon: Dumbbell },
  nutrition: { label: "Nutrition", Icon: UtensilsCrossed },
  habits:    { label: "Habits",    Icon: Repeat },
};

function DomainPill({
  domainKey,
  score,
}: {
  domainKey: keyof typeof DOMAIN_CONFIG;
  score: WellnessScore | null;
}) {
  const { label, Icon } = DOMAIN_CONFIG[domainKey];
  const level: ScoreLevel =
    !score || score.dataQuality === "insufficient" ? "low" : score.level;
  const value =
    !score || score.dataQuality === "insufficient" ? "—" : `${score.score}`;
  const colors = scoreLevelColors[level];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl",
        colors.bg,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", colors.text)} />
      <span className={cn("text-sm font-semibold tabular-nums", colors.text)}>
        {value}
      </span>
      <span className="text-[9px] text-muted-foreground font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

type Props = {
  composite: CompositeWellnessScore;
  className?: string;
};

export function WellnessScoreCard({ composite, className }: Props) {
  return (
    <InsightCard
      className={cn(
        "shadow-[0_1px_3px_rgba(20,60,50,0.05),_0_4px_16px_rgba(20,60,50,0.08)]",
        "px-5 py-5",
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-4">
        <ScoreRing
          score={composite.dataQuality === "insufficient" ? 0 : composite.score}
          level={composite.level}
          size={68}
          label="Wellness"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {composite.headline}
          </p>
          {composite.dataQuality === "insufficient" && (
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Log sleep, meals, or exercise to build your score.
            </p>
          )}
        </div>
      </div>

      {/* Domain breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(DOMAIN_CONFIG) as (keyof typeof DOMAIN_CONFIG)[]).map(
          (key) => (
            <DomainPill
              key={key}
              domainKey={key}
              score={composite.domains[key]}
            />
          ),
        )}
      </div>
    </InsightCard>
  );
}
