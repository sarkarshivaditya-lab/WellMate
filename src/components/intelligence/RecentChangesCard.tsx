// src/components/intelligence/RecentChangesCard.tsx
// Surfaces meaningful behavioral shifts from the longitudinal memory system.
// Only renders when there is at least one significant, non-stable delta — invisible otherwise.

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightCard } from "@/components/ui/insight-card";
import type { BehavioralDelta } from "@/intelligence/memory/types";

const DOMAIN_LABELS: Record<string, string> = {
  sleep: "Sleep",
  activity: "Activity",
  nutrition: "Nutrition",
  habits: "Habits",
  mood: "Mood",
  hydration: "Hydration",
  journal: "Journal",
  composite: "Wellness",
};

type Props = {
  deltas: BehavioralDelta[];
  className?: string;
};

export function RecentChangesCard({ deltas, className }: Props) {
  const significant = deltas
    .filter((d) => d.direction !== "stable" && d.confidence !== "low")
    .slice(0, 4);

  if (significant.length === 0) return null;

  return (
    <InsightCard className={className}>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        Recent shifts
      </p>
      <div className="space-y-3">
        {significant.map((delta) => {
          const isUp = delta.direction === "up";
          const Icon = isUp ? TrendingUp : TrendingDown;
          const iconColor = isUp
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400";

          return (
            <div
              key={`${delta.domain}_${delta.metric}`}
              className="flex items-start gap-2.5"
            >
              <span className={cn("mt-0.5 flex-shrink-0", iconColor)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                  {DOMAIN_LABELS[delta.domain] ?? delta.domain}
                </p>
                <p className="text-[13px] text-foreground/80 leading-snug">
                  {delta.observation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}
