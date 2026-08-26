import { useState, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { X, Dumbbell, ChevronDown, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

import { EmergencyTrackingPanel } from "@/components/emergency/EmergencyTrackingPanel";
import Progress from "./Progress";
import ExerciseLog from "./ExerciseLog";
import FoodLog from "./FoodLog";
import PeriodTracker from "./PeriodTracker";
import PhysicalInsightsCard from "./PhysicalInsightsCard";
import PhysicalGoalAdvisor from "./PhysicalGoalAdvisor";
import PhysicalConfidenceCard from "./PhysicalConfidenceCard";
import { SleepTabContent } from "../Sleep";
import { useExercisesByDate } from "@/hooks/useExercisesByDate";
import { useAllExercises } from "@/hooks/useAllExercises";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { useFirstWeek } from "@/hooks/useFirstWeek";
import { useFeatureTracker } from "@/analytics";
import { localDateIso } from "@/services/dateUtils";

function getLast7Days() {
  const days: { dateIso: string; label: string; fullLabel: string }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ dateIso: localDateIso(d), label: d.toLocaleDateString(undefined, { weekday: "short" }), fullLabel: d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) });
  }
  return days;
}

function useWeeklyActivity() {
  const allExercises = useAllExercises();
  return useMemo(() => {
    const days = getLast7Days();
    return days.map((day) => ({ label: day.label, fullLabel: day.fullLabel, totalDuration: allExercises.filter((e) => e.dateIso === day.dateIso).reduce((sum, e) => sum + e.durationMinutes, 0) }));
  }, [allExercises]);
}

function TodayActivitySummary() {
  const today = localDateIso();
  const { exercises } = useExercisesByDate(today);
  if (!exercises || exercises.length === 0) return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today’s Activity</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground/70">Nothing logged yet today.</p></CardContent></Card>;
  const totalDuration = exercises.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalCalories = exercises.reduce((sum, e) => sum + e.caloriesBurnedEst, 0);
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today’s Activity</CardTitle></CardHeader><CardContent><div className="grid grid-cols-3 gap-4"><div><div className="text-xs text-muted-foreground">Exercises</div><div className="text-lg font-semibold tabular-nums">{exercises.length}</div></div><div><div className="text-xs text-muted-foreground">Duration</div><div className="text-lg font-semibold tabular-nums">{totalDuration} min</div></div><div><div className="text-xs text-muted-foreground">Calories</div><div className="text-lg font-semibold tabular-nums">{totalCalories} cal</div></div></div></CardContent></Card>;
}

function WeeklyActivityTrend() {
  const data = useWeeklyActivity();
  const CHART_HEIGHT = 112;
  const DAILY_GOAL_MIN = 30;
  const goalHitDays = data.filter((d) => d.totalDuration >= DAILY_GOAL_MIN).length;
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].totalDuration >= DAILY_GOAL_MIN) streak++;
    else break;
  }
  const maxDuration = Math.max(DAILY_GOAL_MIN, ...data.map((d) => d.totalDuration));
  const goalHeightPx = (DAILY_GOAL_MIN / maxDuration) * CHART_HEIGHT;
  return <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Weekly Activity</CardTitle></CardHeader><CardContent><div className="relative flex items-end gap-3 h-28"><div className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40" style={{ bottom: `${goalHeightPx}px` }} />{data.map((day, idx) => { const heightPx = (day.totalDuration / maxDuration) * CHART_HEIGHT; return <div key={idx} className="group flex-1 flex flex-col items-center gap-1"><div className="w-full h-28 flex items-end"><div className="w-full rounded bg-primary/60 transition-premium group-hover:bg-primary" style={{ height: `${Math.max(2, heightPx)}px` }} title={`${day.fullLabel}: ${day.totalDuration} min`} /></div><div className="text-[10px] text-muted-foreground">{day.label}</div></div>; })}</div><div className="mt-3"><span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{streak > 0 ? `${streak}-day streak` : "No active streak"}</span></div><div className="mt-4 rounded-xl bg-muted/40 px-4 py-3"><div className="text-xs text-muted-foreground">Weekly Summary</div><div className="mt-1 text-sm">You reached your daily activity goal on <span className="font-medium">{goalHitDays} of the last 7 days</span>.</div></div></CardContent></Card>;
}

const WELCOME_DISMISSED_KEY = "wellmate_welcome_dismissed";
function WelcomeCard() {
  const { isFirstWeek } = useFirstWeek();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(WELCOME_DISMISSED_KEY) === "true");
  if (!isFirstWeek || dismissed) return null;
  return <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent"><CardContent className="pt-4 pb-4"><div className="flex items-start gap-3"><div className="flex-1 space-y-1"><p className="text-sm font-semibold">Welcome to WellMate</p><p className="text-xs text-muted-foreground leading-relaxed">Start wherever feels natural — one sleep entry, one habit, one meal. You don't need to use everything at once.</p></div><button type="button" aria-label="Dismiss welcome message" onClick={() => { localStorage.setItem(WELCOME_DISMISSED_KEY, "true"); setDismissed(true); }} className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0 mt-0.5 transition-colors"><X className="h-3.5 w-3.5" /></button></div></CardContent></Card>;
}

const NUTRITION_AI_FEATURES = ["Photograph a meal to identify foods and estimate macronutrients", "Automatic portion size recognition from image context", "Meal composition breakdown without manual entry", "Ingredient-level recognition for mixed dishes", "Meal history organisation and pattern detection"];
const BARCODE_FEATURES = ["Scan packaged food labels for exact nutritional values", "Serving-size-aware macro extraction", "Faster logging with significantly lower friction", "Comprehensive packaged food database integration"];
const NUTRITION_INTELLIGENCE = ["Longitudinal nutrition trend analysis across weeks and months", "Correlation of dietary patterns with sleep, energy, and mood", "Personalised macro guidance grounded in your wellness data", "AI-assisted food understanding tailored to your health context"];
function NutritionAINotice() {
  const [expanded, setExpanded] = useState(false);
  return <div className="rounded-2xl border border-border/20 bg-muted/15 px-4 py-3.5"><div className="flex items-start gap-3"><div className="mt-0.5 flex-shrink-0 rounded-lg bg-primary/8 p-1.5"><Camera className="h-3.5 w-3.5 text-primary/50" /></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground/75 leading-snug">AI-powered nutrition logging is in preparation</p><p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">Current tracking prioritises simplicity and reliability. Photo-based meal recognition and barcode scanning are being built into the platform.</p></div><button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-label={expanded ? "Collapse details" : "Expand details"} className="mt-0.5 flex-shrink-0 rounded-md p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors touch-manipulation"><ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} /></button></div>{expanded && <div className="mt-4 space-y-5 border-t border-border/15 pt-4">{[["AI meal recognition", NUTRITION_AI_FEATURES], ["Barcode scanning", BARCODE_FEATURES], ["Longitudinal nutrition intelligence", NUTRITION_INTELLIGENCE]].map(([title, items]) => <div key={title} className="space-y-2"><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p><ul className="space-y-1.5">{(items as string[]).map((feature) => <li key={feature} className="flex items-start gap-2 text-[12px] text-muted-foreground/80 leading-snug"><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary/30" />{feature}</li>)}</ul></div>)}</div>}</div>;
}

const FITNESS_SPLITS = ["Push / Pull / Legs", "Upper / Lower", "Strength", "Hypertrophy", "CrossFit-style", "Bro Split", "Beginner", "Recovery-aware"];
const FITNESS_FEATURES = ["Structured exercise database with muscle-group targeting", "Equipment filtering and guided exercise flows", "Set, rep, and weight logging with history", "Progressive overload tracking and weekly volume visibility", "Personal record detection and strength trend analysis", "Recovery-aware workout analysis grounded in biometric signals"];
const ACTIVITY_PLATFORMS = ["Apple Health", "Google Health Connect", "Fitbit", "Garmin", "Samsung Health", "WHOOP", "Oura", "& others"];
const WEARABLE_SIGNALS = ["Automatic workout detection and activity imports", "Heart-rate-aware training intensity analysis", "Recovery-aware readiness signals before each session", "Calorie synchronization from device sensors", "Passive activity tracking without manual logging"];
function FitnessEcosystemNotice() {
  const [expanded, setExpanded] = useState(false);
  return <div className="rounded-2xl border border-border/20 bg-muted/15 px-4 py-3.5"><div className="flex items-start gap-3"><div className="mt-0.5 flex-shrink-0 rounded-lg bg-primary/8 p-1.5"><Dumbbell className="h-3.5 w-3.5 text-primary/50" /></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground/75 leading-snug">Building toward a complete fitness platform</p><p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">Current activity logging is intentionally lightweight. The system it will evolve into is significantly more comprehensive.</p></div><button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-label={expanded ? "Collapse details" : "Expand details"} className="mt-0.5 flex-shrink-0 rounded-md p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors touch-manipulation"><ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} /></button></div>{expanded && <div className="mt-4 space-y-5 border-t border-border/15 pt-4">{[["Structured training systems", FITNESS_SPLITS], ["Exercise library & progression tracking", FITNESS_FEATURES], ["Connected activity intelligence", WEARABLE_SIGNALS], ["Supported activity platforms", ACTIVITY_PLATFORMS]].map(([title, items]) => <div key={title} className="space-y-2"><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p><ul className="space-y-1.5">{(items as string[]).map((feature) => <li key={feature} className="flex items-start gap-2 text-[12px] text-muted-foreground/80 leading-snug"><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary/30" />{feature}</li>)}</ul></div>)}</div>}</div>;
}

function PhysicalSummaryCard() {
  const profile = useLocalProfile();
  const heightCm = profile?.heightCm ?? null;
  const weightKg = profile?.weightKg ?? null;
  let bmiDisplay = "—";
  if (heightCm && weightKg) { const hM = heightCm / 100; const bmi = weightKg / (hM * hM); if (Number.isFinite(bmi)) bmiDisplay = bmi.toFixed(1); }
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Profile</CardTitle></CardHeader><CardContent><div className="grid grid-cols-3 gap-4"><div><div className="text-xs text-muted-foreground">Height</div><div className="text-sm font-medium tabular-nums">{heightCm ? `${heightCm} cm` : "—"}</div></div><div><div className="text-xs text-muted-foreground">Weight</div><div className="text-sm font-medium tabular-nums">{weightKg ? `${weightKg} kg` : "—"}</div></div><div><div className="text-xs text-muted-foreground">BMI</div><div className="text-sm font-medium tabular-nums">{bmiDisplay}</div></div></div></CardContent></Card>;
}

export default function PhysicalDashboard() {
  useFeatureTracker("physical");
  const [tab, setTab] = useState<"overview" | "nutrition" | "activity" | "sleep">(() => {
    const saved = sessionStorage.getItem("physical_tab");
    if (saved === "nutrition" || saved === "activity" || saved === "sleep") return saved;
    return "overview";
  });
  return <PageLayout title="Physical Health" subtitle="Golden Hour emergency response first, wellness tracking alongside it." tabs={[{ label: "Emergency", value: "overview" }, { label: "Nutrition", value: "nutrition" }, { label: "Activity", value: "activity" }, { label: "Sleep", value: "sleep" }]} activeTab={tab} onTabChange={(v) => { const next = v as "overview" | "nutrition" | "activity" | "sleep"; sessionStorage.setItem("physical_tab", next); setTab(next); }}>
    {tab === "overview" && <div key="overview" className="space-y-6 animate-wm-tab-in"><EmergencyTrackingPanel /><WelcomeCard /><PhysicalConfidenceCard /><TodayActivitySummary /><WeeklyActivityTrend /><PhysicalInsightsCard /><PhysicalGoalAdvisor /><PhysicalSummaryCard /></div>}
    {tab === "nutrition" && <div key="nutrition" className="space-y-6 animate-wm-tab-in"><NutritionAINotice /><Progress /><FoodLog /></div>}
    {tab === "activity" && <div key="activity" className="space-y-6 animate-wm-tab-in"><FitnessEcosystemNotice /><ExerciseLog /><PeriodTracker /></div>}
    {tab === "sleep" && <div key="sleep" className="space-y-6 animate-wm-tab-in"><SleepTabContent /></div>}
  </PageLayout>;
}
