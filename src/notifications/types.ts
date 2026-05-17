// src/notifications/types.ts

/* ======================================================
   CALM NOTIFICATION ARCHITECTURE — TYPES

   Philosophy: a thoughtful wellness companion, not an app
   fighting for attention. The type system encodes this.
====================================================== */

export type NotificationCategory =
  | "wellness_critical"   // rare — highest importance only
  | "streak_support"      // streak at risk of breaking
  | "habit_support"       // user-set habit reminder
  | "sleep_support"       // sleep hygiene nudge
  | "gentle_checkin"      // daily check-in
  | "hydration_support"   // hydration reminder
  | "recovery_prompt"     // gentle re-engagement after absence
  | "journal_reflection"  // journaling prompt
  | "passive_insight"     // low-pressure informational insight
  | "onboarding_nudge";   // onboarding completion prompt

export type NotificationTone =
  | "warm"        // encouraging, positive
  | "gentle"      // soft, low-pressure
  | "neutral"     // factual, calm
  | "supportive"; // empathetic, recovery-oriented

export type NotificationIntent = {
  id: string;
  category: NotificationCategory;
  tone: NotificationTone;
  title: string;
  body: string;
  /** Deliver at or after this unix timestamp */
  scheduledFor: number;
  /** Drop silently if not delivered by this timestamp */
  expiresAt: number;
  /** If present, auto-reschedule after delivery */
  recurring?: { intervalMs: number };
  metadata?: Record<string, unknown>;
};

export type DeliveredRecord = {
  intentId: string;
  category: NotificationCategory;
  deliveredAt: number;
  suppressed: boolean; // true = silently dropped (quiet hours, fatigue, etc.)
};

export type QuietWindow = {
  startHour: number;   // 0–23
  startMinute: number; // 0–59
  endHour: number;
  endMinute: number;
  label: "sleep" | "focus" | "custom";
};

export type NotificationPreferences = {
  enabled: boolean;
  enabledCategories: NotificationCategory[];
  quietWindows: QuietWindow[];
  sensitivityLevel: "low" | "normal" | "high";
  /** Max notifications delivered per day */
  dailyCap: number;
  updatedAt: number;
};

export type FatigueState = {
  /** Last delivery timestamp per category */
  lastDelivered: Partial<Record<NotificationCategory, number>>;
  /** Times app was foregrounded with a pending notification but it stayed suppressed */
  ignoreCount: Partial<Record<NotificationCategory, number>>;
  todayCount: number;
  todayDate: string; // YYYY-MM-DD — resets daily
  updatedAt: number;
};

export type NotificationSnapshot = {
  enabled: boolean;
  queueLength: number;
  recentHistory: DeliveredRecord[];
  fatigueState: FatigueState;
  preferences: NotificationPreferences;
  isInQuietHours: boolean;
};
