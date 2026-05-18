// src/components/intelligence/WellnessScoreCard.tsx
// Composite wellness score card for the Overview page.
// Domain pills are tappable — tap to reveal that domain's explanation + signals inline.

import React, { useState } from "react";
import { Moon, Dumbbell, UtensilsCrossed, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { InsightCard } from "@/components/ui/insight-card";
import { SignalPill } from "@/components/ui/signal-pill";
import { scoreLevelColors } from "@/design/tokens";
import type { CompositeWellnessScore, WellnessScore, ScoreLevel } from "@/intelligence/types";

const DOMAIN_CONFIG = {
  sleep:     { label: "Sleep",     Icon: Moon },
  activity:  { label: "Activity",  Icon: Dumbbell },
  nutrition: { label: "Nutrition", Icon: UtensilsCrossed },
  habits:    { label: "Habits",    Icon: Repeat },
};

type DomainKey = keyof typeof DOMAIN_CONFIG;

// ── DomainPill ────────────────────────────────────────────────────────────────

function DomainPill({
  domainKey,
  score,
  selected,
  onClick,
}: {
  domainKey: DomainKey;
  score: WellnessScore | null;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { label, Icon } = DOMAIN_CONFIG[domainKey];
  const level: ScoreLevel =
    !score || score.dataQuality === "insufficient" ? "low" : score.level;
  const value =
    !score || score.dataQuality === "insufficient" ? "—" : `${score.score}`;
  const colors = scoreLevelColors[level];
  const hasData = score && score.dataQuality !== "insufficient";

  if (!hasData) {
    return (
      <div
        role="img"
        aria-label={`${label}: no data yet`}
        className={cn(
          "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl",
          colors.bg,
        )}
      >
        <Icon aria-hidden className={cn("h-3.5 w-3.5", colors.text)} />
        <span aria-hidden className={cn("text-sm font-semibold tabular-nums", colors.text)}>
          {value}
        </span>
        <span aria-hidden className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} score: ${value}. Tap for details.`}
      aria-expanded={selected}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-colors touch-manipulation",
        colors.bg,
        selected && "ring-1 ring-inset ring-current/20",
      )}
    >
      <Icon aria-hidden className={cn("h-3.5 w-3.5", colors.text)} />
      <span aria-hidden className={cn("text-sm font-semibold tabular-nums", colors.text)}>
        {value}
      </span>
      <span aria-hidden className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
        {label}
      </span>
    </button>
  );
}

// ── DomainExpansion ───────────────────────────────────────────────────────────

function DomainExpansion({
  domainKey,
  score,
}: {
  domainKey: DomainKey;
  score: WellnessScore;
}) {
  const { label } = DOMAIN_CONFIG[domainKey];
  const positiveSignals = score.signals.filter((s) => s.positive);
  const cautionSignals = score.signals.filter((s) => !s.positive);
  const allSignals = [...positiveSignals, ...cautionSignals].slice(0, 4);

  return (
    <div className="rounded-xl bg-muted/30 border border-border/20 px-3 py-3 space-y-2.5">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        {label} · Why this score
      </p>
      <p className="text-[13px] text-foreground/80 leading-relaxed">
        {score.explanation}
      </p>
      {allSignals.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {allSignals.map((sig) => (
            <SignalPill
              key={sig.label}
              label={sig.label}
              value={sig.value}
              positive={sig.positive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── WellnessScoreCard ─────────────────────────────────────────────────────────

type Props = {
  composite: CompositeWellnessScore;
  className?: string;
};

export function WellnessScoreCard({ composite, className }: Props) {
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | null>(null);

  function handleDomainTap(key: DomainKey) {
    setSelectedDomain((prev) => (prev === key ? null : key));
  }

  const expandedScore =
    selectedDomain != null ? composite.domains[selectedDomain] : null;
  const showExpansion =
    expandedScore != null && expandedScore.dataQuality !== "insufficient";

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
        <div
          role="img"
          aria-label={
            composite.dataQuality === "insufficient"
              ? "Overall wellness score: not enough data yet"
              : `Overall wellness score: ${composite.score} — ${composite.level}`
          }
        >
          <ScoreRing
            score={composite.dataQuality === "insufficient" ? 0 : composite.score}
            level={composite.level}
            size={68}
            label="Wellness"
          />
        </div>

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

      {/* Domain breakdown — tappable when data is available */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(DOMAIN_CONFIG) as DomainKey[]).map((key) => (
          <DomainPill
            key={key}
            domainKey={key}
            score={composite.domains[key]}
            selected={selectedDomain === key}
            onClick={() => handleDomainTap(key)}
          />
        ))}
      </div>

      {/* Inline domain expansion */}
      {showExpansion && selectedDomain && (
        <DomainExpansion domainKey={selectedDomain} score={expandedScore!} />
      )}
    </InsightCard>
  );
}
