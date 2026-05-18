import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import {
  ChevronRight,
  Activity,
  Brain,
  Repeat,
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  Zap,
  Heart,
  Sparkles,
  Shield,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/timeline/ActivityTimeline";
import { computeWellnessRelations } from "@/insights/wellnessRelations";
import type { WellnessRelation } from "@/insights/wellnessRelations";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { WellnessScoreCard } from "@/components/intelligence/WellnessScoreCard";
import { WeeklySummaryCard } from "@/components/intelligence/WeeklySummaryCard";
import { RecentChangesCard } from "@/components/intelligence/RecentChangesCard";
import { useWellnessIntelligence } from "@/hooks/useWellnessIntelligence";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { useWellnessMemory } from "@/hooks/useWellnessMemory";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useAdaptiveProfile } from "@/hooks/useAdaptiveProfile";
import type { Recommendation, RecommendationCategory } from "@/recommendations/types";
import type { ModuleId } from "@/personalization/types";

// ── Quick links ───────────────────────────────────────────────────────────────

type ModuleMeta = {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
};

const MODULE_META: Record<ModuleId, ModuleMeta> = {
  physical: {
    to: "/physical",
    icon: <Activity className="h-4 w-4" />,
    label: "Physical Health",
    description: "Activity, nutrition, and body metrics",
  },
  mental: {
    to: "/mental",
    icon: <Brain className="h-4 w-4" />,
    label: "Mental Wellbeing",
    description: "Mood, journal, and mindfulness",
  },
  habits: {
    to: "/habits",
    icon: <Repeat className="h-4 w-4" />,
    label: "Habits",
    description: "Build consistency through daily actions",
  },
  sleep: {
    to: "/sleep",
    icon: <Moon className="h-4 w-4" />,
    label: "Sleep",
    description: "Track rest quality and patterns",
  },
};

type QuickLinkProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent?: boolean;
};

function QuickLink({ to, icon, label, description, accent }: QuickLinkProps) {
  return (
    <Link to={to} className="block">
      <Card
        className={cn(
          "transition-premium hover:bg-accent/20",
          accent && "border-primary/20 hover:border-primary/40",
        )}
      >
        <CardContent className="px-4 py-3.5 flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0",
              accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">{label}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
              {description}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Wellness relation card ─────────────────────────────────────────────────────

function RelationCard({ relation }: { relation: WellnessRelation }) {
  const TrendIcon =
    relation.trend === "positive"
      ? TrendingUp
      : relation.trend === "negative"
        ? TrendingDown
        : Minus;

  const trendColor =
    relation.trend === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : relation.trend === "negative"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "px-4 py-3.5 rounded-2xl",
        "bg-card/60 border border-border/30",
        "flex items-start gap-3",
      )}
    >
      <span className={cn("mt-0.5 flex-shrink-0", trendColor)}>
        <TrendIcon className="h-4 w-4" />
      </span>
      <p className="text-[13px] text-foreground/90 leading-snug">{relation.insight}</p>
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

const CATEGORY_ICONS: Partial<Record<RecommendationCategory, LucideIcon>> = {
  sleep: Moon,
  recovery: Zap,
  hydration: Droplets,
  activity: Activity,
  mood: Heart,
  habits: Repeat,
  pacing: Gauge,
  reflection: Sparkles,
  stabilization: Shield,
  stress_management: Shield,
};

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[rec.category] ?? Sparkles;

  const iconColor =
    rec.trend === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : rec.trend === "negative"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary/60";

  const hasExplainability =
    rec.explainability.reason.length > 0 ||
    rec.explainability.contributingSignals.length > 0;

  return (
    <div
      className={cn(
        "px-4 py-3.5 rounded-2xl",
        "bg-card/60 border border-border/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex-shrink-0", iconColor)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="space-y-0.5 min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground/90 leading-snug">{rec.title}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{rec.body}</p>
          {hasExplainability && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors touch-manipulation"
            >
              {expanded ? "Less" : "Why?"}
            </button>
          )}
        </div>
      </div>
      {expanded && hasExplainability && (
        <div className="mt-2.5 ml-7 rounded-xl bg-muted/30 border border-border/20 px-3 py-2.5 space-y-1.5">
          {rec.explainability.reason && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {rec.explainability.reason}
            </p>
          )}
          {rec.explainability.contributingSignals.length > 0 && (
            <ul className="space-y-0.5">
              {rec.explainability.contributingSignals.map((signal) => (
                <li
                  key={signal}
                  className="text-[11px] text-muted-foreground/80 leading-relaxed before:content-['·'] before:mr-1.5"
                >
                  {signal}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recent activity (gated) ───────────────────────────────────────────────────
// Returns null — no orphaned section header — when the user has no logged data.

function RecentActivitySection() {
  const items = useRecentActivity(6);
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeader label="Recent activity" />
      <ActivityTimeline limit={6} />
    </section>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

export default function Overview() {
  const localProfile = useLocalProfile();
  const profile = localProfile
    ? {
        ...localProfile,
        activityLevel: localProfile.activityLevel ?? undefined,
        goal: localProfile.goal ?? undefined,
      }
    : null;
  const intelligence = useWellnessIntelligence(profile);
  const relations = useMemo(() => computeWellnessRelations(), []);
  const { memory } = useWellnessMemory();
  const { recommendations: allRecommendations } = useRecommendations(memory);
  const { adaptationState } = useAdaptiveProfile();

  // Apply adaptation: cap recs, suppress reflections when affinity is low
  const visibleRecommendations = useMemo(() => {
    let recs = allRecommendations;
    if (!adaptationState.showReflections) {
      recs = recs.filter((r) => r.category !== "reflection");
    }
    return recs.slice(0, adaptationState.maxRecommendations);
  }, [allRecommendations, adaptationState]);

  return (
    <PageLayout title="Overview" subtitle="Your wellness at a glance.">
      <div className="space-y-8">
        {/* Composite wellness score */}
        <WellnessScoreCard composite={intelligence.composite} />

        {/* Behavioral shifts from longitudinal memory — only renders when significant */}
        <RecentChangesCard deltas={memory?.behavioralDeltas ?? []} />

        {/* Module quick-links — ordered by behavioral affinity */}
        <div className="space-y-3">
          {adaptationState.moduleOrder.map((moduleId, idx) => {
            const meta = MODULE_META[moduleId];
            return (
              <QuickLink
                key={moduleId}
                to={meta.to}
                icon={meta.icon}
                label={meta.label}
                description={meta.description}
                accent={idx === 0}
              />
            );
          })}
        </div>

        {/* Contextual guidance — capped and filtered by adaptation state */}
        {visibleRecommendations.length > 0 && (
          <section className="space-y-3">
            <SectionHeader label="Guidance" />
            <div className="space-y-2">
              {visibleRecommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          </section>
        )}

        {/* Cross-module wellness insights — only shown when enough data exists */}
        {relations.length > 0 && (
          <section className="space-y-3">
            <SectionHeader label="Patterns" />
            <div className="space-y-2">
              {relations.map((r) => (
                <RelationCard key={r.id} relation={r} />
              ))}
            </div>
          </section>
        )}

        {/* Weekly comparison */}
        <section className="space-y-3">
          <SectionHeader label="Week in review" />
          <WeeklySummaryCard comparison={intelligence.weeklyComparison} />
        </section>

        {/* Recent activity timeline — omit section entirely when no items */}
        <RecentActivitySection />
      </div>
    </PageLayout>
  );
}
