// src/components/ui/trend-badge.tsx
// Trend direction indicator — TrendingUp / TrendingDown / Minus with semantic color.
// Extracted from WeeklySummaryCard and WellnessScore cards.
//
// Usage:
//   <TrendBadge trend="up" />
//   <TrendBadge trend="down" size="sm" />

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendDirection } from "@/intelligence/types";

type Props = {
  trend: TrendDirection | "up" | "down" | "stable";
  size?: "sm" | "md";
  className?: string;
};

const ICON_SIZE = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
} as const;

export function TrendBadge({ trend, size = "md", className }: Props) {
  const iconCls = cn(ICON_SIZE[size], className);

  if (trend === "up") {
    return <TrendingUp className={cn(iconCls, "text-emerald-500")} />;
  }
  if (trend === "down") {
    return <TrendingDown className={cn(iconCls, "text-amber-500")} />;
  }
  return <Minus className={cn(iconCls, "text-muted-foreground/60")} />;
}
