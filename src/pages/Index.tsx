import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronRight,
  Activity,
  Brain,
  Repeat,
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/timeline/ActivityTimeline";
import { computeWellnessRelations } from "@/insights/wellnessRelations";
import type { WellnessRelation } from "@/insights/wellnessRelations";
import { WellnessScoreCard } from "@/components/intelligence/WellnessScoreCard";
import { WeeklySummaryCard } from "@/components/intelligence/WeeklySummaryCard";
import { useWellnessIntelligence } from "@/hooks/useWellnessIntelligence";
import { useLocalProfile } from "@/hooks/useLocalProfile";

// ── Quick links ───────────────────────────────────────────────────────────────

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

  return (
    <PageLayout title="Overview" subtitle="Your wellness at a glance.">
      <div className="space-y-8">
        {/* Composite wellness score */}
        <WellnessScoreCard composite={intelligence.composite} />

        {/* Module quick-links */}
        <div className="space-y-3">
          <QuickLink
            to="/physical"
            icon={<Activity className="h-4 w-4" />}
            label="Physical Health"
            description="Activity, nutrition, and body metrics"
            accent
          />
          <QuickLink
            to="/mental"
            icon={<Brain className="h-4 w-4" />}
            label="Mental Wellbeing"
            description="Mood, journal, and mindfulness"
          />
          <QuickLink
            to="/habits"
            icon={<Repeat className="h-4 w-4" />}
            label="Habits"
            description="Build consistency through daily actions"
          />
          <QuickLink
            to="/sleep"
            icon={<Moon className="h-4 w-4" />}
            label="Sleep"
            description="Track rest quality and patterns"
          />
        </div>

        {/* Cross-module wellness insights — only shown when enough data exists */}
        {relations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
              Patterns
            </h2>
            <div className="space-y-2">
              {relations.map((r) => (
                <RelationCard key={r.id} relation={r} />
              ))}
            </div>
          </section>
        )}

        {/* Weekly comparison */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
            Week in review
          </h2>
          <WeeklySummaryCard comparison={intelligence.weeklyComparison} />
        </section>

        {/* Recent activity timeline */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
            Recent activity
          </h2>
          <ActivityTimeline limit={6} />
        </section>
      </div>
    </PageLayout>
  );
}
