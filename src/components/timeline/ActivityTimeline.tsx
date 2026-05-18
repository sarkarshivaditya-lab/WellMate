// src/components/timeline/ActivityTimeline.tsx
// Unified recent activity feed across all wellness modules.
// Reinforces continuity — the app feeling alive and connected.

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  Dumbbell,
  Moon,
  Smile,
  BookOpen,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { moduleColors } from "@/design/tokens";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import type { SearchModule } from "@/search/searchTypes";
import { haptics } from "@/motion/haptics";

const MODULE_ICONS: Partial<Record<SearchModule, React.ReactNode>> = {
  meal:     <UtensilsCrossed className="h-3.5 w-3.5" />,
  exercise: <Dumbbell className="h-3.5 w-3.5" />,
  sleep:    <Moon className="h-3.5 w-3.5" />,
  mood:     <Smile className="h-3.5 w-3.5" />,
  journal:  <BookOpen className="h-3.5 w-3.5" />,
  habit:    <Repeat className="h-3.5 w-3.5" />,
};

function relativeTime(ts: number | undefined): string {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}

type Props = {
  limit?: number;
  className?: string;
};

export function ActivityTimeline({ limit = 6, className }: Props) {
  const navigate = useNavigate();
  const items = useRecentActivity(limit);

  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, i) => {
        const colors = moduleColors[item.module] ?? moduleColors.action;
        const icon = MODULE_ICONS[item.module] ?? null;

        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.route) {
                haptics.light();
                navigate(item.route);
              }
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
              "bg-card/60 border border-border/30",
              "hover:bg-card/90 hover:border-border/50",
              "transition-premium active:scale-[0.98]",
              "text-left",
              item.route ? "cursor-pointer" : "cursor-default",
              i === 0 && "animate-wm-fade-1",
              i === 1 && "animate-wm-fade-2",
              i === 2 && "animate-wm-fade-3",
              i >= 3 && "animate-wm-fade-4",
            )}
          >
            {/* Module icon */}
            <span
              className={cn(
                "flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg",
                colors.bg,
                colors.text,
              )}
            >
              {icon}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {item.subtitle}
                </p>
              )}
            </div>

            {/* Time */}
            {item.timestamp && (
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {relativeTime(item.timestamp)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
