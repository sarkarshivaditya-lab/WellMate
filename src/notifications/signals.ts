// src/notifications/signals.ts

/* ======================================================
   WELLNESS SIGNAL GENERATORS

   Each signal reads current app state and produces a
   NotificationIntent when a calm, relevant nudge is warranted.

   Design rules:
   - Signals are pure evaluation — no side effects
   - Each signal is self-aware: it only fires when relevant
   - Missing data always means "no signal" (not an error)
   - The engine decides priority, delivery, and suppression
====================================================== */

import type { NotificationIntent } from "./types";
import { getTodaySummary } from "@/analytics/dailySummaryStore";
import { getAggregates } from "@/analytics/aggregateStore";
import { getRetentionMetrics } from "@/analytics/retentionEngine";
import { listHabits, listEntriesByDate } from "@/data/local/habitsStore";

const DAY_MS = 24 * 60 * 60 * 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* --------------------------------------------------
   HABIT REMINDER SIGNALS
   For habits with remindersEnabled + a reminderTime set,
   fire after that time if the habit isn't yet completed today.
   -------------------------------------------------- */

export function habitReminderSignals(): NotificationIntent[] {
  const habits = listHabits().filter((h) => h.remindersEnabled && h.reminderTime);
  if (!habits.length) return [];

  const today = todayIso();
  const todayEntries = listEntriesByDate(today);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const intents: NotificationIntent[] = [];

  for (const habit of habits) {
    if (!habit.reminderTime) continue;

    const [hStr, mStr] = habit.reminderTime.split(":");
    const hh = parseInt(hStr, 10);
    const mm = parseInt(mStr, 10);
    if (isNaN(hh) || isNaN(mm)) continue;

    // Only fire after the reminder time has passed today
    if (nowMinutes < hh * 60 + mm) continue;

    const completedToday = todayEntries.some(
      (e) => e.habitLocalId === habit.localId && e.completed,
    );
    if (completedToday) continue;

    const scheduledAt = new Date();
    scheduledAt.setHours(hh, mm, 0, 0);

    intents.push({
      id: `habit_${habit.localId}_${today}`,
      category: "habit_support",
      tone: "gentle",
      title: habit.title,
      body: "A gentle reminder to check in with your habit today.",
      scheduledFor: scheduledAt.getTime(),
      expiresAt: new Date(`${today}T23:59:59`).getTime(),
      metadata: { habitLocalId: habit.localId },
    });
  }

  return intents;
}

/* --------------------------------------------------
   DAILY CHECK-IN SIGNAL
   If nothing has been logged today and it's past 7 PM,
   offer a single gentle prompt.
   -------------------------------------------------- */

export function dailyCheckinSignal(): NotificationIntent | null {
  try {
    const now = new Date();
    // Only after 7 PM
    if (now.getHours() < 19) return null;

    const todaySummary = getTodaySummary();
    if (todaySummary && todaySummary.totalActions > 0) return null;

    const today = todayIso();
    return {
      id: `checkin_${today}`,
      category: "gentle_checkin",
      tone: "warm",
      title: "How's your day going?",
      body: "Take a moment to check in. Even one small log keeps your picture complete.",
      scheduledFor: Date.now(),
      expiresAt: new Date(`${today}T23:59:59`).getTime(),
    };
  } catch {
    return null;
  }
}

/* --------------------------------------------------
   RHYTHM SUPPORT SIGNAL
   If user has been active multiple days in a row and
   hasn't logged anything today, offer a calm, optional reminder.
   Only after midday. No streak-loss framing.
   -------------------------------------------------- */

export function streakSupportSignal(): NotificationIntent | null {
  try {
    const now = new Date();
    if (now.getHours() < 12) return null;

    const agg = getAggregates();
    if (agg.currentStreak < 2) return null;

    const todaySummary = getTodaySummary();
    if (todaySummary && todaySummary.totalActions > 0) return null;

    const today = todayIso();
    return {
      id: `streak_${today}`,
      category: "streak_support",
      tone: "warm",
      title: "Keeping the rhythm",
      body: "You've been showing up consistently. Whenever you're ready today.",
      scheduledFor: Date.now(),
      expiresAt: new Date(`${today}T23:59:59`).getTime(),
      metadata: { streak: agg.currentStreak },
    };
  } catch {
    return null;
  }
}

/* --------------------------------------------------
   RECOVERY PROMPT SIGNAL
   If the user was fairly active last week but hasn't logged
   anything this week, send a warm, non-judgmental re-entry nudge.
   Only between 10 AM and 6 PM — never guilt-inducing.
   -------------------------------------------------- */

export function recoveryPromptSignal(): NotificationIntent | null {
  try {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 10 || hour >= 18) return null;

    const retention = getRetentionMetrics();
    // Was meaningfully active last week but not at all this week
    if (retention.activeDaysLastWeek < 3 || retention.activeDaysThisWeek > 0) return null;

    const today = todayIso();
    return {
      id: `recovery_${today}`,
      category: "recovery_prompt",
      tone: "supportive",
      title: "Welcome back",
      body: "No pressure. Wellness is a practice, not a performance. Start wherever feels right.",
      scheduledFor: Date.now(),
      expiresAt: Date.now() + DAY_MS,
    };
  } catch {
    return null;
  }
}

/* --------------------------------------------------
   ONBOARDING NUDGE SIGNAL
   If onboarding was started but not finished, nudge gently
   after 24 hours. Once. Not repeatedly.
   -------------------------------------------------- */

export function onboardingNudgeSignal(): NotificationIntent | null {
  try {
    if (localStorage.getItem("onboarded") === "true") return null;

    const agg = getAggregates();
    if (!agg.firstSeenDate) return null;

    const firstSeenMs = new Date(agg.firstSeenDate).getTime();
    if (Date.now() - firstSeenMs < DAY_MS) return null;

    const today = todayIso();
    return {
      id: `onboarding_${today}`,
      category: "onboarding_nudge",
      tone: "gentle",
      title: "Finish setting up WellMate",
      body: "Your profile is waiting. It takes about 2 minutes.",
      scheduledFor: Date.now(),
      expiresAt: Date.now() + 7 * DAY_MS,
    };
  } catch {
    return null;
  }
}
