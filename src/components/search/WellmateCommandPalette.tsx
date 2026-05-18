// src/components/search/WellmateCommandPalette.tsx
// Calm command palette — universal search, navigation, and quick-add.
// Uses existing cmdk primitives from src/components/ui/command.tsx.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Brain,
  Repeat,
  Moon,
  User,
  LayoutGrid,
  UtensilsCrossed,
  Dumbbell,
  BookOpen,
  Heart,
  Smile,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/contexts/commandPaletteContext";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { searchAll } from "@/search/searchIndex";
import type { SearchResult, SearchModule } from "@/search/searchTypes";
import { haptics } from "@/motion/haptics";
import { QuickAddSheet } from "@/components/quickadd/QuickAddSheet";
import { emitAnalyticsEvent } from "@/analytics/eventBus";

type QuickEntity = "mood" | "journal" | "exercise" | "sleep" | "meal" | "habit";

// ── Icon mapping ──────────────────────────────────────────────────────────────

function ModuleIcon({ module, className }: { module: SearchModule; className?: string }) {
  const icons: Record<SearchModule, React.ReactNode> = {
    meal: <UtensilsCrossed className={cn("h-4 w-4", className)} />,
    exercise: <Dumbbell className={cn("h-4 w-4", className)} />,
    sleep: <Moon className={cn("h-4 w-4", className)} />,
    mood: <Smile className={cn("h-4 w-4", className)} />,
    journal: <BookOpen className={cn("h-4 w-4", className)} />,
    habit: <Repeat className={cn("h-4 w-4", className)} />,
    navigation: <LayoutGrid className={cn("h-4 w-4", className)} />,
    action: <Plus className={cn("h-4 w-4", className)} />,
  };
  return <>{icons[module]}</>;
}

const MODULE_LABELS: Record<SearchModule, string> = {
  meal: "Meals",
  exercise: "Exercise",
  sleep: "Sleep",
  mood: "Mood",
  journal: "Journal",
  habit: "Habits",
  navigation: "Navigate",
  action: "Actions",
};

// ── Navigation destinations ───────────────────────────────────────────────────

const NAV_ITEMS: SearchResult[] = [
  {
    id: "nav-physical",
    module: "navigation",
    title: "Physical Health",
    subtitle: "Activity, nutrition, body metrics",
    route: "/physical",
    score: 1,
  },
  {
    id: "nav-mental",
    module: "navigation",
    title: "Mental Wellbeing",
    subtitle: "Mood, journal, mindfulness",
    route: "/mental",
    score: 1,
  },
  {
    id: "nav-sleep",
    module: "navigation",
    title: "Sleep",
    subtitle: "Track rest quality and patterns",
    route: "/sleep",
    score: 1,
  },
  {
    id: "nav-habits",
    module: "navigation",
    title: "Habits",
    subtitle: "Build consistency through daily actions",
    route: "/habits",
    score: 1,
  },
  {
    id: "nav-profile",
    module: "navigation",
    title: "Profile",
    subtitle: "Account and preferences",
    route: "/profile",
    score: 1,
  },
  {
    id: "nav-overview",
    module: "navigation",
    title: "Overview",
    subtitle: "Everything in one place",
    route: "/overview",
    score: 1,
  },
];

const NAV_ICONS: Record<string, React.ReactNode> = {
  "nav-physical": <Activity className="h-4 w-4" />,
  "nav-mental": <Brain className="h-4 w-4" />,
  "nav-sleep": <Moon className="h-4 w-4" />,
  "nav-habits": <Repeat className="h-4 w-4" />,
  "nav-profile": <User className="h-4 w-4" />,
  "nav-overview": <LayoutGrid className="h-4 w-4" />,
};

// ── Quick actions ─────────────────────────────────────────────────────────────

type QuickAction = {
  id: string;
  label: string;
  entity: QuickEntity;
  icon: React.ReactNode;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-mood", label: "Log mood", entity: "mood", icon: <Smile className="h-4 w-4" /> },
  { id: "qa-journal", label: "Write journal entry", entity: "journal", icon: <BookOpen className="h-4 w-4" /> },
  { id: "qa-exercise", label: "Log exercise", entity: "exercise", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "qa-sleep", label: "Log sleep", entity: "sleep", icon: <Moon className="h-4 w-4" /> },
  { id: "qa-meal", label: "Log meal", entity: "meal", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "qa-habit", label: "Add habit", entity: "habit", icon: <Repeat className="h-4 w-4" /> },
];

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(ts: number | undefined): string {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── Result item ───────────────────────────────────────────────────────────────

function ResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (r: SearchResult) => void;
}) {
  return (
    <CommandItem
      key={result.id}
      value={result.id}
      onSelect={() => onSelect(result)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
    >
      <span className="flex-shrink-0 text-muted-foreground">
        <ModuleIcon module={result.module} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {result.subtitle}
          </p>
        )}
      </div>
      {result.timestamp && (
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {relativeTime(result.timestamp)}
        </span>
      )}
    </CommandItem>
  );
}

// ── Main palette ──────────────────────────────────────────────────────────────

export function WellmateCommandPalette() {
  const { open, closePalette } = useCommandPalette();
  const navigate = useNavigate();
  const recentItems = useRecentActivity(8);

  const [query, setQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddEntity, setQuickAddEntity] = useState<QuickEntity>("mood");

  // Reset query on open/close
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Search results (only computed when query is non-empty)
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchAll(query).slice(0, 20);
  }, [query]);

  // Group search results by module
  const groupedResults = useMemo(() => {
    const groups = new Map<SearchModule, SearchResult[]>();
    for (const r of searchResults) {
      if (!groups.has(r.module)) groups.set(r.module, []);
      groups.get(r.module)!.push(r);
    }
    return groups;
  }, [searchResults]);

  // Filter navigation by query
  const filteredNav = useMemo(() => {
    if (!query.trim()) return NAV_ITEMS;
    const q = query.toLowerCase();
    return NAV_ITEMS.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.subtitle ?? "").toLowerCase().includes(q),
    );
  }, [query]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      haptics.light();
      closePalette();
      if (result.route) {
        navigate(result.route);
      }
      if (result.action) {
        result.action();
      }
    },
    [closePalette, navigate],
  );

  const handleQuickAction = useCallback(
    (entity: QuickEntity) => {
      haptics.light();
      closePalette();
      setQuickAddEntity(entity);
      setQuickAddOpen(true);
    },
    [closePalette],
  );

  const isSearching = query.trim().length > 0;

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={(v) => { if (!v) closePalette(); }}
        title="WellMate Search"
        description="Search your wellness data, navigate, or capture quickly."
        showCloseButton={false}
        className="sm:max-w-[540px] top-[10%] translate-y-0"
      >
        <CommandInput
          placeholder="Search or type a command…"
          value={query}
          onValueChange={setQuery}
        />

        <CommandList className="max-h-[60vh]">
          <CommandEmpty>
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          </CommandEmpty>

          {/* When searching — show grouped data results */}
          {isSearching && (
            <>
              {Array.from(groupedResults.entries()).map(([module, results]) => (
                <CommandGroup key={module} heading={MODULE_LABELS[module]}>
                  {results.slice(0, 4).map((r) => (
                    <ResultItem key={r.id} result={r} onSelect={handleSelectResult} />
                  ))}
                </CommandGroup>
              ))}

              {/* Navigation always shown during search */}
              {filteredNav.length > 0 && (
                <>
                  {groupedResults.size > 0 && <CommandSeparator />}
                  <CommandGroup heading="Navigate">
                    {filteredNav.map((n) => (
                      <CommandItem
                        key={n.id}
                        value={n.id}
                        onSelect={() => handleSelectResult(n)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                      >
                        <span className="flex-shrink-0 text-muted-foreground">
                          {NAV_ICONS[n.id]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          {n.subtitle && (
                            <p className="text-[11px] text-muted-foreground">{n.subtitle}</p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}

          {/* When idle — show quick actions + recent activity + navigation */}
          {!isSearching && (
            <>
              <CommandGroup heading="Quick capture">
                {QUICK_ACTIONS.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.id}
                    onSelect={() => handleQuickAction(action.entity)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                  >
                    <span className="flex-shrink-0 text-primary/70">{action.icon}</span>
                    <p className="text-sm font-medium">{action.label}</p>
                  </CommandItem>
                ))}
              </CommandGroup>

              {recentItems.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recent activity">
                    {recentItems.map((r) => (
                      <ResultItem key={r.id} result={r} onSelect={handleSelectResult} />
                    ))}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup heading="Navigate">
                {NAV_ITEMS.map((n) => (
                  <CommandItem
                    key={n.id}
                    value={n.id}
                    onSelect={() => handleSelectResult(n)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                  >
                    <span className="flex-shrink-0 text-muted-foreground">
                      {NAV_ICONS[n.id]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
          <span className="text-[10px] text-muted-foreground">
            ↑↓ navigate · ↵ select · esc close
          </span>
          <span className="text-[10px] text-muted-foreground">
            <Heart className="inline h-2.5 w-2.5 mr-0.5 opacity-50" />
            WellMate
          </span>
        </div>
      </CommandDialog>

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        defaultEntity={quickAddEntity}
      />
    </>
  );
}
