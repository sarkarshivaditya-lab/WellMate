// src/export/dataDeletion.ts
// Per-domain deletion with explicit localStorage keys.
// onboarding_profile is intentionally never deletable here — it is permanent device-resident data.
// Sync metadata and caches are cleared alongside their primary data.

export type DeletableDomain =
  | "sleep"
  | "exercise"
  | "meals"
  | "moods"
  | "journal"
  | "hydration"
  | "habits";

export const DOMAIN_LABELS: Record<DeletableDomain, string> = {
  sleep: "Sleep logs",
  exercise: "Exercise sessions",
  meals: "Meal logs",
  moods: "Mood entries",
  journal: "Journal entries",
  hydration: "Hydration logs",
  habits: "Habits & completions",
};

const DOMAIN_KEYS: Record<DeletableDomain, string[]> = {
  sleep: ["local_sleep_logs"],
  exercise: ["physical.exercises"],
  meals: ["nutrition.meals"],
  moods: ["local_moods", "mental.moods"],
  journal: ["local_journal_entries", "wellmate_journal_draft"],
  hydration: ["local_hydration_logs"],
  habits: ["local_habits", "local_habit_entries"],
};

// Cache + intelligence keys to invalidate after deletion
const DEPENDENT_CACHE_KEYS = [
  "wellmate_memory_context_v1",
  "wellmate_recommendations_v1",
  "wellmate_rec_fatigue_v1",
  "wellmate_adaptive_profile_v1",
  "wellmate_analytics_agg_v1",
  "wellmate_daily_summaries_v1",
];

export function clearDomain(domain: DeletableDomain): void {
  const keys = DOMAIN_KEYS[domain];
  keys.forEach((k) => localStorage.removeItem(k));

  // Bust intelligence caches so stale data doesn't persist
  DEPENDENT_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
}

export function clearAllWellnessData(): void {
  const allDomains: DeletableDomain[] = [
    "sleep", "exercise", "meals", "moods", "journal", "hydration", "habits",
  ];
  allDomains.forEach(clearDomain);

  // Also clear op/sync queues — no point replaying deleted data
  [
    "wellmate_op_queue_v2",
    "wellmate_op_deadletter_v2",
    "wellmate_sync_queue_v1",
    "wellmate_sync_deadletter_v1",
    "wellmate_notif_fatigue",
    "wellmate_notif_queue",
    "wellmate_notif_history",
    "wellmate_replay_log_v1",
    "wellmate_conflict_log_v1",
    "wellmate_quarantine_v1",
  ].forEach((k) => localStorage.removeItem(k));

  // Intentionally preserved: onboarding_profile, onboarding_draft, onboarded,
  // postOnboardingTransitionShown, wellmate_device_id, wellmate_notif_prefs
  // These belong to the user's device identity and preferences, not wellness logs.
}
