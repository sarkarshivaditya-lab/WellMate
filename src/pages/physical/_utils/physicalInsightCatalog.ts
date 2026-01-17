// src/pages/physical/_utils/physicalInsightCatalog.ts

import type { PhysicalInsight } from "./types";

export const physicalInsights: PhysicalInsight[] = [
  /* =========================
     ENERGY / CALORIES
     ========================= */

  {
    id: "calorie_balance_stable",
    title: "Energy balance trend",
    body: "Your intake and activity suggest a relatively stable energy balance over recent days.",
    impact: 3,
    requires: { meals: true, exercise: true, profile: true },
  },

  {
    id: "calorie_balance_unclear",
    title: "Energy balance unclear",
    body: "Logging meals and activity more consistently will help clarify your energy balance.",
    impact: 2,
    requires: { meals: true, profile: true },
    action: {
      label: "Log meals today",
      intent: "log",
    },
  },

  /* =========================
     PROTEIN / MACROS
     ========================= */

  {
    id: "protein_below_target",
    title: "Protein intake",
    body: "Your protein intake appears below the recommended range for your body weight.",
    impact: 2,
    requires: { meals: true, profile: true },
    action: {
      label: "Review protein sources",
      intent: "review",
    },
  },

  {
    id: "protein_tracking_sparse",
    title: "Protein tracking opportunity",
    body: "Logging protein intake on more days will help assess whether you're meeting your needs.",
    impact: 1,
    requires: { meals: true },
    action: {
      label: "Log your next meal",
      intent: "log",
    },
  },

  /* =========================
     SLEEP
     ========================= */

  {
    id: "sleep_consistency_low",
    title: "Sleep consistency",
    body: "Your sleep timing varies noticeably from day to day, which can affect recovery.",
    impact: 2,
    requires: { sleep: true },
    action: {
      label: "Aim for a consistent bedtime tonight",
      intent: "adjust",
    },
  },

  {
    id: "sleep_data_sparse",
    title: "Sleep patterns still forming",
    body: "Track sleep on more nights to uncover meaningful sleep patterns.",
    impact: 1,
    requires: { sleep: true },
    action: {
      label: "Log last night’s sleep",
      intent: "log",
    },
  },

  /* =========================
     CONSISTENCY & HABITS
     ========================= */

  {
    id: "logging_consistency_good",
    title: "Consistent logging",
    body: "You've been logging regularly, which makes your insights more reliable.",
    impact: 2,
    requires: { meals: true },
  },

  {
    id: "logging_consistency_low",
    title: "Build logging momentum",
    body: "Even partial daily logs can significantly improve insight accuracy.",
    impact: 1,
    requires: { meals: true },
    action: {
      label: "Log one thing today",
      intent: "log",
    },
  },

  /* =========================
     PROFILE COMPLETENESS
     ========================= */

  {
    id: "profile_incomplete",
    title: "Complete your profile",
    body: "Adding height, weight, and activity level will unlock more personalized insights.",
    impact: 3,
    requires: { profile: false },
    action: {
      label: "Complete profile",
      intent: "adjust",
    },
  },

  /* =========================
     POSITIVE REINFORCEMENT
     ========================= */

  {
    id: "confidence_high",
    title: "Strong data confidence",
    body: "Your recent logs provide a solid foundation for personalized guidance.",
    impact: 2,
    requires: { meals: true, sleep: true },
  },
];
