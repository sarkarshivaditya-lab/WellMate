// Goal Thread Tracker — persistent tracker for long-running wellness goal threads.
//
// Unlike cognitiveStateEngine's active goals (volatile, max 3),
// goal threads are persistent localStorage records of multi-session goal arcs:
//   - burnout recovery
//   - weight management
//   - gym consistency
//   - stress cycles
//   - sleep improvement
//
// Each thread accumulates evidence over time, tracks progress,
// detects abandonment (no evidence > 14 days), and carries emotional weight.
//
// Thread lifecycle:
//   active → progressing → stalled → abandoned | completed

import { emitCognitionEvent } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type GoalThreadCategory =
  | "burnout_recovery"
  | "weight_management"
  | "fitness_consistency"
  | "stress_management"
  | "sleep_improvement"
  | "nutrition_habits"
  | "mental_wellness"
  | "general_wellness";

export type GoalThreadStatus = "active" | "progressing" | "stalled" | "abandoned" | "completed";

export type GoalEvidence = {
  id: string;
  snippet: string;
  direction: "positive" | "negative" | "neutral";
  timestamp: number;
};

export type GoalThread = {
  id: string;
  name: string;
  category: GoalThreadCategory;
  status: GoalThreadStatus;
  salience: number;         // 0-1; decays without evidence
  progress: number;         // 0-1 estimated
  evidence: GoalEvidence[];
  createdAt: number;
  lastEvidenceAt: number;
  emotionalWeight: number;  // 0-1
};

export type GoalThreadReport = {
  activeThreads: number;
  stalledThreads: number;
  abandonedThreads: number;
  completedThreads: number;
  topThreads: Array<{ name: string; category: string; progress: number; salience: number; status: string }>;
  lastUpdatedAt: number | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_goal_threads_v1";
const MAX_THREADS = 12;
const MAX_EVIDENCE_PER_THREAD = 20;
const STALL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;     // 7 days
const ABANDON_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days

// ── Category detection ────────────────────────────────────────────────────────

const CATEGORY_SIGNALS: Array<{ category: GoalThreadCategory; keywords: string[] }> = [
  { category: "burnout_recovery",   keywords: ["burnout", "burnt out", "exhausted", "overworked", "recovery", "rest", "recharge"] },
  { category: "weight_management",  keywords: ["weight", "lbs", "kg", "bmi", "lose weight", "gain weight", "diet"] },
  { category: "fitness_consistency", keywords: ["gym", "workout", "exercise", "run", "jog", "steps", "strength", "consistency"] },
  { category: "stress_management",  keywords: ["stress", "anxious", "anxiety", "overwhelmed", "tension", "calm", "relax"] },
  { category: "sleep_improvement",  keywords: ["sleep", "insomnia", "tired", "rest", "bedtime", "wake up", "night"] },
  { category: "nutrition_habits",   keywords: ["food", "eat", "meal", "calories", "protein", "carbs", "nutrition", "diet"] },
  { category: "mental_wellness",    keywords: ["mental health", "depression", "therapy", "mindfulness", "meditation", "mood"] },
];

function detectCategory(text: string): GoalThreadCategory {
  const lower = text.toLowerCase();
  for (const { category, keywords } of CATEGORY_SIGNALS) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "general_wellness";
}

function buildThreadName(category: GoalThreadCategory, snippet: string): string {
  const base: Record<GoalThreadCategory, string> = {
    burnout_recovery: "Burnout recovery",
    weight_management: "Weight management",
    fitness_consistency: "Fitness consistency",
    stress_management: "Stress management",
    sleep_improvement: "Sleep improvement",
    nutrition_habits: "Nutrition habits",
    mental_wellness: "Mental wellness",
    general_wellness: "Wellness journey",
  };
  return `${base[category]} — ${snippet.slice(0, 30)}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function loadThreads(): GoalThread[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as GoalThread[];
  } catch {
    return [];
  }
}

function saveThreads(threads: GoalThread[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
  } catch { /* storage full */ }
}

// ── Thread lifecycle ──────────────────────────────────────────────────────────

function updateThreadStatus(thread: GoalThread): void {
  const age = Date.now() - thread.lastEvidenceAt;

  if (thread.status === "completed" || thread.status === "abandoned") return;

  if (age > ABANDON_THRESHOLD_MS) {
    thread.status = "abandoned";
    emitCognitionEvent("goal_resolved", { goalId: thread.id, reason: "abandoned" });
    return;
  }

  if (age > STALL_THRESHOLD_MS) {
    thread.status = "stalled";
    return;
  }

  const recentEvidence = thread.evidence.slice(-5);
  const positiveCount = recentEvidence.filter((e) => e.direction === "positive").length;
  const negativeCount = recentEvidence.filter((e) => e.direction === "negative").length;

  if (positiveCount >= 3 && thread.progress > 0.7) {
    thread.status = "progressing";
  } else if (negativeCount >= 3) {
    thread.status = "active";
  } else {
    thread.status = "active";
  }
}

function updateSalience(thread: GoalThread): void {
  const ageMs = Date.now() - thread.lastEvidenceAt;
  const halfLifeMs = 7 * 24 * 60 * 60 * 1000;  // salience halves every 7 days
  thread.salience = thread.salience * Math.exp(-Math.log(2) * ageMs / halfLifeMs);
  thread.salience = Math.max(0.05, Math.min(1, thread.salience));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function upsertGoalThread(opts: {
  snippet: string;
  direction: "positive" | "negative" | "neutral";
  emotionalWeight?: number;
}): void {
  const threads = loadThreads();
  const category = detectCategory(opts.snippet);

  // Find existing thread for this category
  const existing = threads.find(
    (t) => t.category === category && t.status !== "abandoned" && t.status !== "completed",
  );

  const evidenceItem: GoalEvidence = {
    id: `ev-${Date.now()}`,
    snippet: opts.snippet.slice(0, 100),
    direction: opts.direction,
    timestamp: Date.now(),
  };

  if (existing) {
    existing.evidence.push(evidenceItem);
    if (existing.evidence.length > MAX_EVIDENCE_PER_THREAD) {
      existing.evidence = existing.evidence.slice(-MAX_EVIDENCE_PER_THREAD);
    }
    existing.lastEvidenceAt = Date.now();
    existing.emotionalWeight = Math.max(existing.emotionalWeight, opts.emotionalWeight ?? 0);

    // Update progress based on recent evidence direction
    const recent = existing.evidence.slice(-5);
    const posRatio = recent.filter((e) => e.direction === "positive").length / recent.length;
    existing.progress = Math.min(1, Math.max(0, existing.progress * 0.8 + posRatio * 0.2));

    updateSalience(existing);
    updateThreadStatus(existing);
    emitCognitionEvent("goal_added", { goalId: existing.id, category, update: "evidence_added" });
  } else {
    if (threads.length >= MAX_THREADS) {
      // Evict least salient abandoned or stalled thread
      const evictable = threads.filter((t) => t.status === "abandoned" || t.status === "stalled");
      if (evictable.length > 0) {
        const target = evictable.reduce((min, t) => t.salience < min.salience ? t : min);
        const idx = threads.findIndex((t) => t.id === target.id);
        if (idx !== -1) threads.splice(idx, 1);
      }
    }

    const newThread: GoalThread = {
      id: `gt-${Date.now()}`,
      name: buildThreadName(category, opts.snippet),
      category,
      status: "active",
      salience: 0.7,
      progress: opts.direction === "positive" ? 0.2 : 0.1,
      evidence: [evidenceItem],
      createdAt: Date.now(),
      lastEvidenceAt: Date.now(),
      emotionalWeight: opts.emotionalWeight ?? 0.3,
    };
    threads.push(newThread);
    emitCognitionEvent("goal_added", { goalId: newThread.id, category, update: "thread_created" });
  }

  saveThreads(threads);
}

export function detectAbandonedThreads(): GoalThread[] {
  const threads = loadThreads();
  const abandoned: GoalThread[] = [];

  for (const thread of threads) {
    const wasPreviouslyActive = thread.status !== "abandoned" && thread.status !== "completed";
    updateThreadStatus(thread);
    if (wasPreviouslyActive && thread.status === "abandoned") {
      abandoned.push(thread);
    }
  }

  saveThreads(threads);
  return abandoned;
}

export function markThreadCompleted(threadId: string): void {
  const threads = loadThreads();
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    thread.status = "completed";
    thread.progress = 1;
    emitCognitionEvent("goal_resolved", { goalId: threadId, reason: "completed" });
    saveThreads(threads);
  }
}

export function getActiveGoalThreads(): GoalThread[] {
  const threads = loadThreads();
  return threads
    .filter((t) => t.status !== "abandoned")
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 5);
}

export function getAllGoalThreads(): GoalThread[] {
  return loadThreads();
}

export function getGoalThreadReport(): GoalThreadReport {
  const threads = loadThreads();
  const active = threads.filter((t) => t.status === "active" || t.status === "progressing");
  const stalled = threads.filter((t) => t.status === "stalled");
  const abandoned = threads.filter((t) => t.status === "abandoned");
  const completed = threads.filter((t) => t.status === "completed");
  const top = active
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 4)
    .map((t) => ({ name: t.name, category: t.category, progress: t.progress, salience: t.salience, status: t.status }));

  const lastEvidenceAts = threads.map((t) => t.lastEvidenceAt).filter(Boolean);
  return {
    activeThreads: active.length,
    stalledThreads: stalled.length,
    abandonedThreads: abandoned.length,
    completedThreads: completed.length,
    topThreads: top,
    lastUpdatedAt: lastEvidenceAts.length > 0 ? Math.max(...lastEvidenceAts) : null,
  };
}
