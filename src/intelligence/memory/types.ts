// src/intelligence/memory/types.ts
// Shared type contract for the longitudinal wellness memory system.
// All memory is deterministic, explainable, and local-first.

export type MemoryDomain =
  | "sleep"
  | "activity"
  | "nutrition"
  | "habits"
  | "mood"
  | "hydration"
  | "journal"
  | "composite";

export type MemoryEventType =
  | "sleep_stabilization"
  | "sleep_duration_improvement"
  | "sleep_quality_trend"
  | "recovery_improvement"
  | "recovery_strain_signal"
  | "habit_streak_milestone"
  | "habit_consistency_shift"
  | "nutrition_logging_consistency"
  | "mood_stabilization"
  | "mood_elevation_period"
  | "hydration_consistency"
  | "activity_increase"
  | "activity_decrease"
  | "behavioral_shift"
  | "wellness_milestone";

export type ConfidenceLevel = "low" | "medium" | "high";

export type SupportingSignal = {
  label: string;
  value: string;
};

// A discrete wellness memory event — a meaningful observed change over a time window.
// Every event is traceable: its headline, signals, and confidence all point back to data.
export type MemoryEvent = {
  id: string;                          // deterministic: "{domain}_{type}_{windowStart}"
  domain: MemoryDomain;
  type: MemoryEventType;
  windowStart: string;                 // ISO date YYYY-MM-DD
  windowEnd: string;
  headline: string;                    // one observational sentence, no causal claims
  detail?: string;                     // 1-2 additional sentences (optional)
  confidence: ConfidenceLevel;
  supportingSignals: SupportingSignal[];
  trend: "positive" | "negative" | "neutral";
  relatedDomains: MemoryDomain[];
};

// A sparse, meaningful milestone — not a gamified achievement.
// Milestones are calm observations about notable thresholds crossed.
export type WellnessMilestone = {
  id: string;                          // deterministic
  domain: MemoryDomain;
  detectedAt: string;                  // ISO date when first computed
  headline: string;
  detail?: string;
  confidence: ConfidenceLevel;
  relatedDomains: MemoryDomain[];
};

// An explainable cross-domain correlation observation.
// Language is deliberately observational — never causal.
export type LongitudinalCorrelation = {
  id: string;
  domainA: MemoryDomain;
  domainB: MemoryDomain;
  insight: string;                     // "tends to", "often aligned with", "coincided with"
  confidence: ConfidenceLevel;
  trend: "positive" | "negative" | "neutral";
  windowDays: number;
  sampleSize: number;
};

// Monthly snapshot — the atomic unit of longitudinal memory.
export type LongitudinalSnapshot = {
  monthKey: string;                    // "YYYY-MM"
  monthStart: string;
  monthEnd: string;
  sleep: {
    nightsLogged: number;
    avgDurationMin: number;
    avgQuality: number;
    bedtimeConsistencyScore: number;   // 0-100, higher = more consistent bedtime
  };
  activity: {
    sessionsLogged: number;
    totalDurationMin: number;
    totalCaloriesBurned: number;
    activeDays: number;
  };
  nutrition: {
    daysLogged: number;
    avgDailyCalories: number;
    avgDailyProteinG: number;
  };
  habits: {
    completionRate: number;            // 0-100
    bestStreak: number;
    totalCompleted: number;
  };
  mood: {
    entriesLogged: number;
    avgMood: number;                   // 0 if no data
    volatility: number;               // stdDev — lower means more stable
  };
  hydration: {
    daysLogged: number;
    avgCupsPerDay: number;
  };
  journal: {
    entriesWritten: number;
  };
};

// A behavioral shift detected by comparing recent (30d) to baseline (90d).
export type BehavioralDelta = {
  domain: MemoryDomain;
  metric: string;
  recentValue: number;
  baselineValue: number;
  changePercent: number;
  direction: "up" | "down" | "stable";
  observation: string;                 // calm, observational language
  confidence: ConfidenceLevel;
};

// Timeline entry — one per day, records which domains had any activity.
export type TimelineEntry = {
  dateIso: string;
  domainActivity: Partial<Record<MemoryDomain, boolean>>;
};

// The full memory context — the substrate for future AI surfaces.
export type WellnessMemoryContext = {
  generatedAt: number;                 // Unix ms timestamp
  snapshots: LongitudinalSnapshot[];   // chronological monthly history, oldest first
  recentEvents: MemoryEvent[];         // meaningful events from the last 30 days
  milestones: WellnessMilestone[];     // all detected milestones
  correlations: LongitudinalCorrelation[];
  behavioralDeltas: BehavioralDelta[];
  dataSpanDays: number;               // total days of data history across all domains
};
