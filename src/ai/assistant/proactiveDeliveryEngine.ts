// Proactive Delivery Engine — surfaces proactive intelligence in the UI.
//
// Coordinates delivery of proactive content across four channels:
//   overview_card       — insight cards on the Overview page
//   assistant_chat      — injected as assistant-initiated turns
//   contextual_nudge    — lightweight surface-aware prompts
//   post_checkin        — reflections triggered after logging events
//
// Delivery rules:
//   - Only delivers when safetyGovernor allows
//   - Only delivers when interventionTimingEngine says proceed
//   - Deduplication via 6-hour delivery log
//   - Maximum 2 deliveries per day across all channels
//   - Post-checkin deliveries bypass daily cap (they respond to user action)
//
// This module does NOT generate content — it delivers pre-generated insights
// from proactiveInsightSynthesizer and recoveryOpportunityDetector.

import { checkInterventionSafety, recordInterventionDelivered as recordSafetyDelivery } from "@/ai/wellness/wellnessSafetyGovernor";
import { evaluateInterventionTiming, recordInterventionDelivered as recordTimingDelivery } from "@/ai/wellness/interventionTimingEngine";
import { synthesizeProactiveInsights } from "@/ai/wellness/proactiveInsightSynthesizer";
import { detectRecoveryOpportunities } from "@/ai/wellness/recoveryOpportunityDetector";
import { isSurfaceProactiveAllowed, AssistantSurface } from "./contextualBehaviorEngine";
import { markInterventionDelivered } from "./assistantStateModel";
import { ProactiveInsight } from "@/ai/wellness/proactiveInsightSynthesizer";
import { RecoveryOpportunity } from "@/ai/wellness/recoveryOpportunityDetector";

// ── Types ──────────────────────────────────────────────────────────────────────

export type DeliveryChannel =
  | "overview_card"
  | "assistant_chat"
  | "contextual_nudge"
  | "post_checkin";

export type DeliveryPriority = "high" | "normal" | "low";

export type ProactiveDeliveryItem = {
  id: string;
  channel: DeliveryChannel;
  surface: AssistantSurface;
  title: string;
  body: string;
  priority: DeliveryPriority;
  sourceType: "insight" | "recovery_opportunity";
  sourceId: string;
  readyAt: number;
  expiresAt: number;
};

export type DeliveryEngineReport = {
  pendingCount: number;
  deliveredTodayCount: number;
  lastDeliveredAt: number | null;
  blockedCount: number;
  blockedReasons: string[];
};

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai_proactive_delivery_v1";
const DELIVERY_TTL_MS = 24 * 60 * 60 * 1000;  // 1 day
const ITEM_EXPIRY_MS = 6 * 60 * 60 * 1000;    // 6 hours

type DeliveryLog = {
  deliveredIds: string[];
  deliveredAt: number[];
  deliveredTodayCount: number;
  lastDeliveredAt: number | null;
};

function loadLog(): DeliveryLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DeliveryLog;
  } catch { /* ok */ }
  return { deliveredIds: [], deliveredAt: [], deliveredTodayCount: 0, lastDeliveredAt: null };
}

function saveLog(log: DeliveryLog): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); } catch { /* ok */ }
}

function pruneLog(log: DeliveryLog): DeliveryLog {
  const cutoff = Date.now() - DELIVERY_TTL_MS;
  const keep = log.deliveredAt.map((t, i) => t > cutoff ? i : -1).filter((i) => i >= 0);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  return {
    deliveredIds: keep.map((i) => log.deliveredIds[i]),
    deliveredAt: keep.map((i) => log.deliveredAt[i]),
    deliveredTodayCount: keep.filter((i) => log.deliveredAt[i] > dayStart.getTime()).length,
    lastDeliveredAt: log.lastDeliveredAt,
  };
}

// ── Pending queue (in-memory) ─────────────────────────────────────────────────

let _pendingQueue: ProactiveDeliveryItem[] = [];
let _blockedCount = 0;
const _blockedReasons: string[] = [];

function prunePending(): void {
  const now = Date.now();
  _pendingQueue = _pendingQueue.filter((item) => item.expiresAt > now);
}

// ── Build queue from sources ──────────────────────────────────────────────────

export function refreshDeliveryQueue(surface: AssistantSurface = "overview"): void {
  prunePending();
  _blockedCount = 0;
  _blockedReasons.length = 0;

  if (!isSurfaceProactiveAllowed(surface)) {
    _blockedCount++;
    _blockedReasons.push(`Surface ${surface} does not allow proactive content`);
    return;
  }

  const safetyCheck = checkInterventionSafety({ contentType: "insight", urgency: "low" });
  if (safetyCheck.verdict === "block") {
    _blockedCount++;
    _blockedReasons.push(`Safety governor blocked: ${safetyCheck.reason}`);
    return;
  }

  const timingCheck = evaluateInterventionTiming("low");
  if (timingCheck.decision === "suppress") {
    _blockedCount++;
    _blockedReasons.push(`Timing engine suppressed: ${timingCheck.reason}`);
    return;
  }

  const log = pruneLog(loadLog());
  if (log.deliveredTodayCount >= 2) {
    _blockedCount++;
    _blockedReasons.push("Daily delivery cap reached (2/day)");
    return;
  }

  const insightReport = synthesizeProactiveInsights();
  const recoveryReport = detectRecoveryOpportunities();

  const now = Date.now();

  for (const insight of insightReport.freshInsights) {
    if (log.deliveredIds.includes(insight.id)) continue;
    if (_pendingQueue.some((q) => q.sourceId === insight.id)) continue;

    _pendingQueue.push({
      id: `del-${insight.id}-${now}`,
      channel: "overview_card",
      surface,
      title: categoryToTitle(insight.category),
      body: insight.text,
      priority: insight.confidence > 0.7 ? "normal" : "low",
      sourceType: "insight",
      sourceId: insight.id,
      readyAt: now,
      expiresAt: now + ITEM_EXPIRY_MS,
    });
  }

  for (const opp of recoveryReport.opportunities.slice(0, 2)) {
    if (log.deliveredIds.includes(opp.id)) continue;
    if (_pendingQueue.some((q) => q.sourceId === opp.id)) continue;

    _pendingQueue.push({
      id: `del-${opp.id}-${now}`,
      channel: opp.window === "now" ? "contextual_nudge" : "overview_card",
      surface,
      title: opp.headline,
      body: opp.suggestion,
      priority: opp.confidence > 0.7 ? "high" : "normal",
      sourceType: "recovery_opportunity",
      sourceId: opp.id,
      readyAt: now,
      expiresAt: now + ITEM_EXPIRY_MS,
    });
  }

  // Sort by priority
  _pendingQueue.sort((a, b) => {
    const order = { high: 0, normal: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export function getNextDeliveryItem(channel?: DeliveryChannel): ProactiveDeliveryItem | null {
  prunePending();
  return _pendingQueue.find((item) => !channel || item.channel === channel) ?? null;
}

export function getPendingItems(channel?: DeliveryChannel): ProactiveDeliveryItem[] {
  prunePending();
  return _pendingQueue.filter((item) => !channel || item.channel === channel);
}

export function markDelivered(itemId: string): void {
  const item = _pendingQueue.find((i) => i.id === itemId);
  _pendingQueue = _pendingQueue.filter((i) => i.id !== itemId);

  if (!item) return;

  const log = pruneLog(loadLog());
  if (!log.deliveredIds.includes(item.sourceId)) {
    log.deliveredIds.push(item.sourceId);
    log.deliveredAt.push(Date.now());
    log.deliveredTodayCount++;
    log.lastDeliveredAt = Date.now();
    saveLog(log);
  }

  // Non-post-checkin deliveries update state + safety/timing counters
  if (item.channel !== "post_checkin") {
    markInterventionDelivered();
    recordSafetyDelivery();
    recordTimingDelivery();
  }
}

export function buildPostCheckinContent(
  checkinType: "sleep" | "activity" | "mood" | "nutrition" | "habit",
): ProactiveDeliveryItem | null {
  const safetyCheck = checkInterventionSafety({ contentType: "post_checkin", urgency: "low" });
  if (safetyCheck.verdict === "block") return null;

  const recovery = detectRecoveryOpportunities();
  const relevant = recovery.opportunities.find(
    (o) => mapCheckinToCategory(checkinType, o),
  );

  if (!relevant) return null;

  const now = Date.now();
  return {
    id: `checkin-${checkinType}-${now}`,
    channel: "post_checkin",
    surface: checkinType === "mood" ? "mental" : checkinType as AssistantSurface,
    title: relevant.headline,
    body: relevant.suggestion,
    priority: "normal",
    sourceType: "recovery_opportunity",
    sourceId: relevant.id,
    readyAt: now,
    expiresAt: now + 30 * 60 * 1000,  // 30 min TTL for post-checkin
  };
}

export function getDeliveryEngineReport(): DeliveryEngineReport {
  prunePending();
  const log = pruneLog(loadLog());
  return {
    pendingCount: _pendingQueue.length,
    deliveredTodayCount: log.deliveredTodayCount,
    lastDeliveredAt: log.lastDeliveredAt,
    blockedCount: _blockedCount,
    blockedReasons: [..._blockedReasons],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function categoryToTitle(category: ProactiveInsight["category"]): string {
  const titles: Record<ProactiveInsight["category"], string> = {
    sleep_trend: "Sleep pattern",
    activity_trend: "Activity trend",
    habit_consistency: "Habit consistency",
    stress_pattern: "Stress pattern",
    recovery_pattern: "Recovery signal",
    emotional_trajectory: "Emotional trend",
    cross_domain_correlation: "Wellness connection",
    motivation_pattern: "Motivation pattern",
    burnout_signal: "Burnout signal",
    positive_momentum: "Positive momentum",
  };
  return titles[category] ?? "Wellness insight";
}

function mapCheckinToCategory(
  type: string,
  opp: RecoveryOpportunity,
): boolean {
  if (type === "sleep" && opp.category === "physical_recovery") return true;
  if (type === "activity" && opp.category === "physical_recovery") return true;
  if (type === "mood" && opp.category === "emotional_stabilization") return true;
  if (type === "habit" && opp.category === "habit_restart") return true;
  return false;
}
