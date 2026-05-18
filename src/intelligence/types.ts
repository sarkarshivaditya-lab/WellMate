// src/intelligence/types.ts
// Shared contract for all WellMate intelligence modules.
// Every score is explainable — no black boxes.

export type ScoreLevel = "high" | "medium" | "low";
export type TrendDirection = "up" | "down" | "stable";
export type DataQuality = "sufficient" | "partial" | "insufficient";

// A single contributing factor to a score.
export type SignalItem = {
  label: string;
  value: string;       // human-readable (e.g. "7h 20m", "4/5 days", "82%")
  positive: boolean;   // does this signal contribute positively to the score?
};

// The universal output shape for any intelligence domain score.
export type WellnessScore = {
  score: number;              // 0–100 integer
  level: ScoreLevel;
  headline: string;           // one-line takeaway (e.g. "Good sleep consistency")
  explanation: string;        // 2-3 sentences explaining why
  signals: SignalItem[];      // up to 4 key factors
  trend: TrendDirection;      // improving / declining / stable vs recent past
  dataQuality: DataQuality;
};

// Composite score combining all domain scores.
export type CompositeWellnessScore = {
  score: number;
  level: ScoreLevel;
  headline: string;
  domains: {
    sleep: WellnessScore | null;
    activity: WellnessScore | null;
    nutrition: WellnessScore | null;
    habits: WellnessScore | null;
  };
  dataQuality: DataQuality;
};

// Weekly summary — used in longitudinal engine.
export type WeeklySummary = {
  weekStart: string;          // ISO date (YYYY-MM-DD)
  mealsLogged: number;
  exerciseSessions: number;
  exerciseCaloriesBurned: number;
  sleepNights: number;
  sleepAvgQuality: number;    // 0 if no data
  sleepAvgDurationMin: number;
  moodsLogged: number;
  moodAvg: number;            // 0 if no data
  journalEntries: number;
  habitsCompleted: number;
  habitsPossible: number;     // total habit × days (for %)
};

export type WeeklyComparison = {
  thisWeek: WeeklySummary;
  lastWeek: WeeklySummary;
  trends: {
    sleep: TrendDirection;
    nutrition: TrendDirection;
    activity: TrendDirection;
    habits: TrendDirection;
    mood: TrendDirection;
  };
};

// Sleep-specific outputs.
export type SleepDebt = {
  hoursDebt: number;          // cumulative 7-day deficit vs 7.5h target
  context: string;            // human-readable interpretation
};

export type OvertrainingSignal = {
  detected: boolean;
  consecutiveWorkoutDays: number;
  reason?: string;            // only set if detected
};
