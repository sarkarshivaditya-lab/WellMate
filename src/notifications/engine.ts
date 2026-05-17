// src/notifications/engine.ts

/* ======================================================
   NOTIFICATION ENGINE — CORE ORCHESTRATION

   Pipeline:
     Wellness Signals → Intent Queue → Priority Sort →
     Quiet Hours Filter → Fatigue/Cooldown Filter →
     Delivery (Sonner toast) → History Record

   Design rules:
   - At most 1 notification per foreground evaluation
   - Quiet hours defer delivery, never discard
   - Fatigue suppression does not remove from queue
   - Fatigue escalation happens on repeated ignore, not delivery
   - Never throws — all errors are swallowed at the boundary
   - Registered via lifecycle coordinator, not polling
====================================================== */

import { toast } from "sonner";
import { subscribeTo } from "@/reliability/lifecycleCoordinator";
import { registerAnalyticsHook } from "@/reliability/mutationPipeline";
import {
  enqueueNotification,
  dequeueNotification,
  getQueue,
  purgeExpired,
  recordDelivery,
} from "./queue";
import { shouldSuppressCategory, recordDeliveryFatigue, recordIgnore } from "./fatigue";
import { isInQuietHours } from "./quietHours";
import { getNotificationPreferences, isCategoryEnabled } from "./preferences";
import {
  habitReminderSignals,
  dailyCheckinSignal,
  streakSupportSignal,
  recoveryPromptSignal,
  onboardingNudgeSignal,
} from "./signals";
import type { NotificationIntent } from "./types";

/* --------------------------------------------------
   PRIORITY MAP
   Lower number = higher priority. Priority never translates
   to urgency in tone — even critical notifications are calm.
   -------------------------------------------------- */

const CATEGORY_PRIORITY: Record<string, number> = {
  wellness_critical:  0,
  streak_support:     2,
  habit_support:      3,
  sleep_support:      3,
  gentle_checkin:     4,
  hydration_support:  4,
  onboarding_nudge:   5,
  recovery_prompt:    6,
  journal_reflection: 6,
  passive_insight:    7,
};

// Minimum time between full evaluations — prevents rapid re-evaluation on
// quick tab switch / focus events. 60 seconds is intentionally generous.
const EVALUATION_DEBOUNCE_MS = 60 * 1000;

let disposeLifecycleSub: (() => void) | null = null;
let lastEvaluatedAt = 0;

function getPriority(intent: NotificationIntent): number {
  return CATEGORY_PRIORITY[intent.category] ?? 5;
}

function deliverToast(intent: NotificationIntent): void {
  // Critical notifications stay longer. All others are calm and unobtrusive.
  const duration = intent.category === "wellness_critical" ? 8000 : 5000;
  toast(intent.title, {
    description: intent.body,
    duration,
  });
}

function collectSignals(): NotificationIntent[] {
  const signals: NotificationIntent[] = [];
  try { signals.push(...habitReminderSignals()); } catch { /* never crash */ }
  try { const s = dailyCheckinSignal();      if (s) signals.push(s); } catch { /* never crash */ }
  try { const s = streakSupportSignal();     if (s) signals.push(s); } catch { /* never crash */ }
  try { const s = recoveryPromptSignal();    if (s) signals.push(s); } catch { /* never crash */ }
  try { const s = onboardingNudgeSignal();   if (s) signals.push(s); } catch { /* never crash */ }
  return signals;
}

function evaluateAndDeliver(): void {
  const now = Date.now();
  if (now - lastEvaluatedAt < EVALUATION_DEBOUNCE_MS) return;
  lastEvaluatedAt = now;

  try {
    const prefs = getNotificationPreferences();
    if (!prefs.enabled) return;

    // Remove stale intents
    purgeExpired();

    // Evaluate signals and enqueue fresh intents (deduplication is in enqueueNotification)
    for (const intent of collectSignals()) {
      enqueueNotification(intent);
    }

    // Quiet hours — defer delivery, keep everything in queue
    if (isInQuietHours(prefs, now)) return;

    // Get due intents, highest priority first
    const pending = getQueue()
      .filter((n) => n.scheduledFor <= now)
      .sort((a, b) => getPriority(a) - getPriority(b));

    // Deliver at most 1 per evaluation — calm is the goal
    for (const intent of pending) {
      if (!isCategoryEnabled(intent.category)) {
        // Category disabled by user — discard silently
        dequeueNotification(intent.id);
        recordDelivery({
          intentId: intent.id,
          category: intent.category,
          deliveredAt: now,
          suppressed: true,
        });
        continue;
      }

      if (shouldSuppressCategory(intent.category, prefs)) {
        // In cooldown or daily cap reached — leave in queue, back off
        recordIgnore(intent.category);
        continue;
      }

      // Deliver
      deliverToast(intent);
      dequeueNotification(intent.id);
      recordDelivery({
        intentId: intent.id,
        category: intent.category,
        deliveredAt: now,
        suppressed: false,
      });
      recordDeliveryFatigue(intent.category);

      // Reschedule recurring intents
      if (intent.recurring) {
        enqueueNotification({
          ...intent,
          id: crypto.randomUUID(),
          scheduledFor: now + intent.recurring.intervalMs,
          expiresAt: now + intent.recurring.intervalMs * 2,
        });
      }

      break; // Only 1 per evaluation
    }
  } catch {
    // The notification engine must never crash the app
  }
}

/* --------------------------------------------------
   WELLNESS LOG LISTENER
   When the user logs something, suppress check-in and
   streak reminders — they're no longer relevant.
   -------------------------------------------------- */

function handleWellnessLogCommitted(): void {
  try {
    const queue = getQueue();
    for (const intent of queue) {
      if (
        intent.category === "gentle_checkin" ||
        intent.category === "streak_support"
      ) {
        dequeueNotification(intent.id);
      }
    }
  } catch {
    // non-fatal
  }
}

/* --------------------------------------------------
   PUBLIC API
   -------------------------------------------------- */

export function initEngine(): void {
  // Subscribe to lifecycle coordinator — evaluate on every foreground return
  disposeLifecycleSub = subscribeTo((event) => {
    if (event.type === "foreground") {
      evaluateAndDeliver();
    }
    // Long absence (24h+): bypass debounce to ensure fresh evaluation
    if (
      event.type === "stale_resume" &&
      event.backgroundDurationMs > 24 * 60 * 60 * 1000
    ) {
      lastEvaluatedAt = 0;
      evaluateAndDeliver();
    }
  });

  // Suppress check-in / streak reminders whenever the user logs something
  registerAnalyticsHook((_entityType, operationType) => {
    if (operationType === "create" || operationType === "update") {
      handleWellnessLogCommitted();
    }
  });

  // Run once on init — lifecycle coordinator doesn't fire "foreground" on startup
  evaluateAndDeliver();
}

export function disposeEngine(): void {
  disposeLifecycleSub?.();
  disposeLifecycleSub = null;
  lastEvaluatedAt = 0;
}

/** Force an immediate evaluation — used in Dev panel and tests */
export function forceEvaluate(): void {
  lastEvaluatedAt = 0;
  evaluateAndDeliver();
}
