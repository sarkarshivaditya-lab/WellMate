// src/intelligence/memory/wellnessMemoryEngine.ts
// Main orchestrator for the longitudinal wellness memory system.
// Composes all sub-systems into a single WellnessMemoryContext.
// Caches to localStorage with a 4-hour TTL — safe to call frequently.

import { buildRecentMonthlySnapshots } from "./snapshotBuilder";
import { detectRecentMemoryEvents } from "./memoryEventDetector";
import { computeBehavioralDeltas } from "./behavioralEvolution";
import { computeLongitudinalCorrelations } from "./correlationEngine";
import { detectMilestones } from "./milestoneDetector";
import {
  loadMemoryContext,
  saveMemoryContext,
  getCachedMemoryContext,
} from "./memoryStore";
import { computeDataSpanDays } from "./temporalAnalysis";
import type { WellnessMemoryContext, WellnessMilestone } from "./types";

export function buildWellnessMemoryContext(forceRefresh = false): WellnessMemoryContext {
  if (!forceRefresh) {
    const cached = getCachedMemoryContext();
    if (cached) return cached;
  }

  // Monthly snapshots — the backbone of longitudinal history
  const snapshots = buildRecentMonthlySnapshots(12);

  // Recent behavioral events (last 30 days, comparing to prior 60)
  const recentEvents = detectRecentMemoryEvents();

  // Milestones are cumulative — previously detected ones are always kept
  const existing = loadMemoryContext();
  const existingMilestones: WellnessMilestone[] = existing?.milestones ?? [];
  const existingIds = new Set(existingMilestones.map((m) => m.id));
  const newMilestones = detectMilestones(existingIds);
  const milestones = [...existingMilestones, ...newMilestones];

  // Cross-domain correlations over 90-day window
  const correlations = computeLongitudinalCorrelations();

  // Behavioral deltas: 30d recent vs 30-90d baseline
  const behavioralDeltas = computeBehavioralDeltas();

  const context: WellnessMemoryContext = {
    generatedAt: Date.now(),
    snapshots,
    recentEvents,
    milestones,
    correlations,
    behavioralDeltas,
    dataSpanDays: computeDataSpanDays(),
  };

  saveMemoryContext(context);
  return context;
}
