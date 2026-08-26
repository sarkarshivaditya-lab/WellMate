import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Brain, Repeat, Moon, User, LayoutGrid, UtensilsCrossed, Dumbbell, BookOpen, Heart, Smile, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { searchAll } from "@/search/searchIndex";
import type { SearchResult, SearchModule } from "@/search/searchTypes";
import { haptics } from "@/motion/haptics";
import { QuickAddSheet } from "@/components/quickadd/QuickAddSheet";

type QuickEntity = "mood" | "journal" | "exercise" | "sleep" | "meal" | "habit";

function ModuleIcon({ module, className }: { module: SearchModule; className?: string }) {
  const icons: Record<SearchModule, React.ReactNode> = {
    meal: <UtensilsCrossed className={cn("h-4 w-4", className)} />, exercise: <Dumbbell className={cn("h-4 w-4", className)} />, sleep: <Moon className={cn("h-4 w-4", className)} />,
    mood: <Smile className={cn("h-4 w-4", className)} />, journal: <BookOpen className={cn("h-4 w-4", className)} />, habit: <Repeat className={cn("h-4 w-4", className)} />,
    navigation: <LayoutGrid className={cn("h-4 w-4", className)} />, action: <Plus className={cn("h-4 w-4", className)} />,
  };
  return <>{icons[module]}</>;
}

const MODULE_LABELS: Record<SearchModule, string> = { meal: "Meals", exercise: "Exercise", sleep: "Sleep", mood: "Mood", journal: "Journal", habit: "Habits", navigation: "Navigate", action: "Actions" };
const NAV_ITEMS: SearchResult[] = [
  { id: "nav-physical", module: "navigation", title: "Physical Health", subtitle: "Activity, nutrition, body metrics", route: "/physical", score: 1 },
  { id: "nav-mental", module: "navigation", title: "Mental Wellbeing", subtitle: "Mood, journal, mindfulness", route: "/mental", score: 1 },
  { id: "nav-sleep", module: "navigation", title: "Sleep", subtitle: "Track rest quality and patterns", route: "/sleep", score: 1 },
  { id: "nav-habits", module: "navigation", title: "Habits", subtitle: "Build consistency through daily actions", route: "/habits", score: 1 },
  { id: "nav-profile", module: "navigation", title: "Profile", subtitle: "Account and preferences", route: "/profile", score: 1 },
  { id: "nav-overview", module: "navigation", title: "Overview", subtitle: "Everything in one place", route: "/overview", score: 1 },
];
const NAV_ICONS: Record<string, React.ReactNode> = { "nav-physical": <Activity className="h-4 w-4" />, "nav-mental": <Brain className="h-4 w-4" />, "nav-sleep": <Moon className="h-4 w-4" />, "nav-habits": <Repeat className="h-4 w-4" />, "nav-profile": <User className="h-4 w-4" />, "nav-overview": <LayoutGrid className="h-4 w-4" /> };

type QuickAction = { id: string; label: string; entity: QuickEntity; icon: React.ReactNode };
const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-mood", label: "Log mood", entity: "mood", icon: <Smile className="h-4 w-4" /> },
  { id: "qa-journal", label: "Write journal entry", entity: "journal", icon: <BookOpen className="h-4 w-4" /> },
  { id: "qa-exercise", label: "Log exercise", entity: "exercise", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "qa-sleep", label: "Log sleep", entity: "sleep", icon: <Moon className="h-4 w-4" /> },
  { id: "qa-meal", label: "Log meal", entity: "meal", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "qa-habit", label: "Add habit", entity: "habit", icon: <Repeat className="h-4 w-4" /> },
];

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

function ResultItem({ result, onSelect }: { result: SearchResult; onSelect: (r: SearchResult) => void }) {
  return <CommandItem value={result.id} onSelect={() => onSelect(result)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"><span className="flex-shrink-0 text-muted-foreground"><ModuleIcon module={result.module} /></span><div className="flex-1 min-w-0"><p className="text-sm font-medium leading-tight truncate">{result.title}</p>{result.subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{result.subtitle}</p>}</div>{result.timestamp && <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(result.timestamp)}</span>}</CommandItem>;
}

export function WellmateCommandPalette() {
  const { open, closePalette } = useCommandPalette();
  const navigate = useNavigate();
  const recentItems = useRecentActivity(8);
  const [query, setQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddEntity, setQuickAddEntity] = useState<QuickEntity>("mood");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const searchResults = useMemo(() => (query.trim() ? searchAll(query).slice(0, 20) : []), [query]);
  const groupedResults = useMemo(() => {
    const groups = new Map<SearchModule, SearchResult[]>();
    for (const r of searchResults) {
      const list = groups.get(r.module) ?? [];
      list.push(r);
      groups.set(r.module, list);
    }
    return groups;
  }, [searchResults]);
  const filteredNav = useMemo(() => {
    if (!query.trim()) return NAV_ITEMS;
    const q = query.toLowerCase();
    return NAV_ITEMS.filter((n) => n.title.toLowerCase().includes(q) || (n.subtitle ?? "").toLowerCase().includes(q));
  }, [query]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    haptics.light();
    closePalette();
    if (result.route) navigate(result.route);
    result.action?.();
  }, [closePalette, navigate]);

  const handleQuickAction = useCallback((entity: QuickEntity) => {
    haptics.light();
    closePalette();
    setQuickAddEntity(entity);
    setQuickAddOpen(true);
  }, [closePalette]);

  return <><CommandDialog open={open} onOpenChange={(next) => { if (!next) closePalette(); }}><CommandInput placeholder="Search WellMate..." value={query} onValueChange={setQuery} /><CommandList><CommandEmpty>No results found.</CommandEmpty>{filteredNav.length > 0 && <CommandGroup heading="Navigate">{filteredNav.map((result) => <CommandItem key={result.id} value={result.title} onSelect={() => handleSelectResult(result)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"><span className="flex-shrink-0 text-muted-foreground">{NAV_ICONS[result.id]}</span><div className="flex-1 min-w-0"><p className="text-sm font-medium leading-tight truncate">{result.title}</p><p className="text-[11px] text-muted-foreground truncate mt-0.5">{result.subtitle}</p></div></CommandItem>)}</CommandGroup>}<CommandSeparator /><CommandGroup heading="Quick add">{QUICK_ACTIONS.map((action) => <CommandItem key={action.id} value={action.label} onSelect={() => handleQuickAction(action.entity)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"><span className="flex-shrink-0 text-muted-foreground">{action.icon}</span><span className="text-sm font-medium">{action.label}</span></CommandItem>)}</CommandGroup>{groupedResults.size > 0 && <CommandSeparator />}{[...groupedResults.entries()].map(([module, results]) => <CommandGroup key={module} heading={MODULE_LABELS[module]}>{results.map((result) => <ResultItem key={result.id} result={result} onSelect={handleSelectResult} />)}</CommandGroup>)}{recentItems.length > 0 && !query.trim() && <><CommandSeparator /><CommandGroup heading="Recent">{recentItems.map((result) => <ResultItem key={result.id} result={result} onSelect={handleSelectResult} />)}</CommandGroup></>}</CommandList></CommandDialog><QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} entity={quickAddEntity} /></>;
}
