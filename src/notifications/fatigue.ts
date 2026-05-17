// src/notifications/fatigue.ts

/* ======================================================
   INTERRUPTION SENSITIVITY — FATIGUE TRACKING

   Most apps increase pressure when ignored.
   WellMate backs off.

   This is a core trust differentiator. The system tracks:
   - Per-category cooldowns (minimum time between deliveries)
   - Ignore escalation (extend cooldown after repeated non-response)
   - Daily delivery cap (global ceiling)
====================================================== */

import type { FatigueState, NotificationCategory, NotificationPreferences } from "./types";
import { getNotificationPreferences } from "./preferences";

const FATIGUE_KEY = "wellmate_notif_fatigue";

// Minimum time between deliveries of the same category.
// These are intentionally long — WellMate prefers silence to noise.
const CATEGORY_COOLDOWN_MS: Record<NotificationCategory, number> = {
  wellness_critical:   4 * 60 * 60 * 1000,  //  4 hours
  streak_support:     24 * 60 * 60 * 1000,  // 24 hours
  habit_support:      24 * 60 * 60 * 1000,  // 24 hours
  sleep_support:      24 * 60 * 60 * 1000,  // 24 hours
  gentle_checkin:     12 * 60 * 60 * 1000,  // 12 hours
  hydration_support:   4 * 60 * 60 * 1000,  //  4 hours
  recovery_prompt:    48 * 60 * 60 * 1000,  // 48 hours
  journal_reflection: 48 * 60 * 60 * 1000,  // 48 hours
  passive_insight:    72 * 60 * 60 * 1000,  // 72 hours
  onboarding_nudge:   48 * 60 * 60 * 1000,  // 48 hours
};

// After this many consecutive ignores, cooldown is doubled.
// "Backed off" users get substantially more peace and quiet.
const IGNORE_ESCALATION_THRESHOLD = 5;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyFatigue(): FatigueState {
  return {
    lastDelivered: {},
    ignoreCount: {},
    todayCount: 0,
    todayDate: todayIso(),
    updatedAt: 0,
  };
}

function loadFatigue(): FatigueState {
  try {
    const raw = localStorage.getItem(FATIGUE_KEY);
    if (!raw) return emptyFatigue();
    const stored = JSON.parse(raw) as FatigueState;
    // Reset daily count when the calendar day changes
    if (stored.todayDate !== todayIso()) {
      return { ...stored, todayCount: 0, todayDate: todayIso() };
    }
    return stored;
  } catch {
    return emptyFatigue();
  }
}

function saveFatigue(state: FatigueState): void {
  try {
    localStorage.setItem(FATIGUE_KEY, JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch {
    // non-fatal
  }
}

export function getFatigueState(): FatigueState {
  return loadFatigue();
}

export function recordDeliveryFatigue(category: NotificationCategory): void {
  const state = loadFatigue();
  state.lastDelivered[category] = Date.now();
  state.todayCount++;
  // Reset ignore count — user got a notification, fresh slate
  state.ignoreCount[category] = 0;
  saveFatigue(state);
}

export function recordIgnore(category: NotificationCategory): void {
  const state = loadFatigue();
  state.ignoreCount[category] = (state.ignoreCount[category] ?? 0) + 1;
  saveFatigue(state);
}

export function resetFatigue(): void {
  saveFatigue(emptyFatigue());
}

/**
 * Returns true if this category should be suppressed.
 *
 * Suppression reasons:
 * 1. Global daily cap reached
 * 2. Category cooldown not yet elapsed
 * 3. Ignore-escalated cooldown not yet elapsed
 */
export function shouldSuppressCategory(
  category: NotificationCategory,
  prefs?: NotificationPreferences,
): boolean {
  const p = prefs ?? getNotificationPreferences();
  const state = loadFatigue();
  const now = Date.now();

  if (state.todayCount >= p.dailyCap) return true;

  const baseCooldown = CATEGORY_COOLDOWN_MS[category];
  const ignores = state.ignoreCount[category] ?? 0;
  const effectiveCooldown =
    ignores >= IGNORE_ESCALATION_THRESHOLD ? baseCooldown * 2 : baseCooldown;

  const lastDelivered = state.lastDelivered[category];
  if (lastDelivered !== undefined && now - lastDelivered < effectiveCooldown) return true;

  return false;
}
