// src/components/ui/insight-card.tsx
// The standard elevated surface for intelligence, insight, and AI content.
//
// Sits one level above Card — translucent, backdrop-blurred, tighter padding.
// All future AI surfaces should use this as their root container.
//
// Anatomy:
//   <InsightCard>
//     <InsightCardHeader>  — score ring + title + trend (optional)
//     <InsightCardSection> — labelled content block
//   </InsightCard>

import React from "react";
import { cn } from "@/lib/utils";
import { surface } from "@/design/tokens";

// ─── InsightCard ──────────────────────────────────────────────────────────────

type InsightCardProps = React.ComponentProps<"div"> & {
  insufficient?: boolean;
  insufficientLabel?: string;
  insufficientBody?: string;
};

export function InsightCard({
  insufficient,
  insufficientLabel,
  insufficientBody,
  className,
  children,
  ...props
}: InsightCardProps) {
  if (insufficient) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/30 bg-card/60 px-4 py-4",
          className,
        )}
        {...props}
      >
        {insufficientLabel && (
          <p className="text-sm font-medium">{insufficientLabel}</p>
        )}
        {insufficientBody && (
          <p className="mt-1 text-xs text-muted-foreground">{insufficientBody}</p>
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(surface.elevated, "px-4 py-4 space-y-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── InsightCardSection ───────────────────────────────────────────────────────
// A labelled content block within an InsightCard.

type InsightCardSectionProps = React.ComponentProps<"div"> & {
  label?: string;
};

export function InsightCardSection({
  label,
  className,
  children,
  ...props
}: InsightCardSectionProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {label && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── InsightCardHeader ────────────────────────────────────────────────────────
// Standard score ring + title/body row.

type InsightCardHeaderProps = {
  leading?: React.ReactNode;  // ScoreRing or icon slot
  title: string;
  body?: string;
  trailing?: React.ReactNode; // TrendBadge or action slot
  className?: string;
};

export function InsightCardHeader({
  leading,
  title,
  body,
  trailing,
  className,
}: InsightCardHeaderProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {leading}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {trailing}
        </div>
        {body && (
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}
