// src/intelligence/memory/summaryComposer.ts
// Generates human-readable summaries from longitudinal data.
// Tone: calm, observational, mature. No hype, no therapy.

import {
  computeWindowMetrics,
  classifyTrend,
  dateIsoNDaysAgo,
  todayIso,
} from "./temporalAnalysis";
import type { LongitudinalSnapshot, BehavioralDelta } from "./types";

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

// One to three sentences summarizing a single month snapshot.
export function composeMonthlySummary(snapshot: LongitudinalSnapshot): string {
  const hasData =
    snapshot.sleep.nightsLogged > 0 ||
    snapshot.activity.sessionsLogged > 0 ||
    snapshot.nutrition.daysLogged > 0 ||
    snapshot.habits.totalCompleted > 0;

  if (!hasData) return "No data logged this month.";

  const parts: string[] = [];

  if (snapshot.sleep.nightsLogged >= 5) {
    parts.push(
      `Sleep: ${snapshot.sleep.nightsLogged} nights logged, averaging ${fmtMins(snapshot.sleep.avgDurationMin)}.`
    );
  }

  if (snapshot.activity.activeDays > 0) {
    const calStr =
      snapshot.activity.totalCaloriesBurned > 0
        ? `, ~${snapshot.activity.totalCaloriesBurned} kcal.`
        : ".";
    parts.push(
      `Activity: ${snapshot.activity.activeDays} active day${snapshot.activity.activeDays !== 1 ? "s" : ""}${calStr}`
    );
  }

  if (snapshot.habits.completionRate > 0 && snapshot.habits.totalCompleted > 0) {
    parts.push(`Habits: ${snapshot.habits.completionRate}% completion.`);
  }

  if (snapshot.mood.entriesLogged >= 5) {
    parts.push(
      `Mood: avg ${snapshot.mood.avgMood}/5 across ${snapshot.mood.entriesLogged} entries.`
    );
  }

  return parts.join(" ");
}

// One to two sentences describing behavioral direction from deltas.
export function composeBehavioralEvolutionSummary(deltas: BehavioralDelta[]): string {
  if (deltas.length === 0) {
    return "Not enough history yet to describe behavioral changes.";
  }

  const positive = deltas.filter((d) => d.direction === "up");
  const negative = deltas.filter((d) => d.direction === "down");
  const parts: string[] = [];

  if (positive.length > 0) {
    const top = positive
      .slice(0, 2)
      .map((d) => d.observation.toLowerCase().replace(/\.$/, ""));
    parts.push(`Recently: ${top.join(", ")}.`);
  }

  if (negative.length > 0) {
    const top = negative
      .slice(0, 1)
      .map((d) => d.observation.toLowerCase().replace(/\.$/, ""));
    parts.push(`Lower than baseline: ${top.join(", ")}.`);
  }

  return parts.join(" ");
}

// Compact 30-day trend recap sentence.
export function compose30dTrendRecap(): string {
  const today = todayIso();
  const recent = computeWindowMetrics(dateIsoNDaysAgo(29), today);
  const prior = computeWindowMetrics(dateIsoNDaysAgo(59), dateIsoNDaysAgo(30));

  const observations: string[] = [];

  if (recent.sleep.nightsLogged >= 5) {
    const t = classifyTrend(recent.sleep.avgDurationMin, prior.sleep.avgDurationMin, 0.08);
    if (t === "up") observations.push("sleep duration up");
    else if (t === "down") observations.push("sleep duration slightly lower");
  }

  if (recent.activity.activeDays >= 2) {
    const t = classifyTrend(recent.activity.activeDays, prior.activity.activeDays, 0.2);
    if (t === "up") observations.push("more active days");
    else if (t === "down") observations.push("fewer active days");
  }

  if (recent.habits.totalCompleted >= 5) {
    const t = classifyTrend(
      recent.habits.completionRate,
      prior.habits.completionRate,
      0.15
    );
    if (t === "up") observations.push("habit follow-through improved");
    else if (t === "down") observations.push("habit completion slightly lower");
  }

  if (recent.mood.entriesLogged >= 5) {
    const t = classifyTrend(recent.mood.avgMood, prior.mood.avgMood, 0.08);
    if (t === "up") observations.push("mood trending higher");
    else if (t === "down") observations.push("mood slightly lower");
  }

  if (observations.length === 0) {
    return "Activity is broadly consistent with the previous period.";
  }

  return observations
    .map((o, i) => (i === 0 ? o.charAt(0).toUpperCase() + o.slice(1) : o))
    .join(", ") + ".";
}
