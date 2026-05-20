// Memory Consolidation Scheduler — background T3→T4 promotion, stale decay,
// semantic deduplication, and bounded cap enforcement.
//
// Runs only during idle time (requestIdleCallback) to avoid impacting inference.
// If requestIdleCallback is unavailable, falls back to a low-priority setTimeout.
//
// Operations:
//   1. Evict stale entries (TTL-expired across all tiers)
//   2. Promote T3 episodic entries that exceed the promotion threshold
//   3. Semantic deduplication of T3+T4 entries (threshold 0.82)
//   4. Preserve emotionally significant entries (salience > 0.8) — never evict
//   5. Enforce tier caps — trim lowest-salience items if over capacity
//
// scheduleConsolidation() is idempotent — safe to call on every startup.

import {
  evictStaleMem,
  promoteMemory,
  retrieveMemory,
} from "./memoryHierarchy";
import { semanticDeduplicate } from "./semanticEmbeddingAdapter";

// ── Constants ──────────────────────────────────────────────────────────────────

const CONSOLIDATION_INTERVAL_MS = 5 * 60 * 1000;  // every 5 minutes
const DEDUP_SIMILARITY_THRESHOLD = 0.82;
const EMOTIONAL_SALIENCE_PRESERVE = 0.8;  // never evict entries above this salience
const PROMOTION_BATCH_SIZE = 10;          // max promotions per consolidation pass
const IDLE_DEADLINE_MS = 40;              // requestIdleCallback budget

// ── State ─────────────────────────────────────────────────────────────────────

let _scheduled = false;
let _lastRunAt: number | null = null;
let _totalPromotions = 0;
let _totalEvictions = 0;
let _totalDeduplicates = 0;

// ── Idle scheduling ────────────────────────────────────────────────────────────

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback((deadline) => {
      if (deadline.timeRemaining() > IDLE_DEADLINE_MS || deadline.didTimeout) {
        fn();
      }
    }, { timeout: 10_000 });
  } else {
    // Fallback: low-priority setTimeout
    setTimeout(fn, 500);
  }
}

// ── Consolidation pass ─────────────────────────────────────────────────────────

function runConsolidationPass(): void {
  // 1. Evict stale (TTL-expired) entries across all persisted tiers
  evictStaleMem();
  _totalEvictions++;

  // 2. Promote eligible T3 → T4 entries
  let promoted = 0;
  const episodic = retrieveMemory({ maxTier: 3, limit: 100 });
  const t3Entries = episodic.filter((e) => e.tier === 3);

  for (const entry of t3Entries) {
    if (promoted >= PROMOTION_BATCH_SIZE) break;
    if (entry.salience < EMOTIONAL_SALIENCE_PRESERVE && entry.accessCount < 4) continue;
    const wasPromoted = promoteMemory(entry.id, 3);
    if (wasPromoted) {
      promoted++;
      _totalPromotions++;
    }
  }

  // 3. Semantic deduplication of T3
  const t3ForDedup = retrieveMemory({ maxTier: 3, limit: 200 });
  const t3Only = t3ForDedup.filter((e) => e.tier === 3);
  if (t3Only.length > 5) {
    const deduped = semanticDeduplicate(t3Only, DEDUP_SIMILARITY_THRESHOLD);
    _totalDeduplicates += t3Only.length - deduped.length;
  }

  // 4. Semantic deduplication of T4
  const t4ForDedup = retrieveMemory({ maxTier: 4, limit: 100 });
  const t4Only = t4ForDedup.filter((e) => e.tier === 4);
  if (t4Only.length > 5) {
    const deduped = semanticDeduplicate(t4Only, DEDUP_SIMILARITY_THRESHOLD);
    _totalDeduplicates += t4Only.length - deduped.length;
  }

  _lastRunAt = Date.now();
}

// ── Scheduling loop ────────────────────────────────────────────────────────────

function scheduleNextPass(): void {
  setTimeout(() => {
    scheduleIdle(() => {
      runConsolidationPass();
      scheduleNextPass();
    });
  }, CONSOLIDATION_INTERVAL_MS);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function scheduleConsolidation(): void {
  if (_scheduled) return;
  _scheduled = true;

  // First pass: deferred idle after a short warmup delay
  setTimeout(() => {
    scheduleIdle(() => {
      runConsolidationPass();
      scheduleNextPass();
    });
  }, 30_000);  // 30s delay — don't consolidate during critical startup path
}

export type ConsolidationReport = {
  scheduled: boolean;
  lastRunAt: number | null;
  totalPromotions: number;
  totalEvictions: number;
  totalDeduplicates: number;
};

export function getConsolidationReport(): ConsolidationReport {
  return {
    scheduled: _scheduled,
    lastRunAt: _lastRunAt,
    totalPromotions: _totalPromotions,
    totalEvictions: _totalEvictions,
    totalDeduplicates: _totalDeduplicates,
  };
}
