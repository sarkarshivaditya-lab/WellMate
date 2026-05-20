// Memory Hierarchy — 5-tier cognitive memory system.
//
// Tier 1: Working Memory    — volatile, in-process only (seconds/minutes)
// Tier 2: Session Memory    — sessionStorage, current session (hours)
// Tier 3: Episodic Memory   — localStorage, notable events (7-90 days)
// Tier 4: Semantic Memory   — localStorage, stable user facts (months)
// Tier 5: Reflective Memory — localStorage, high-level syntheses (permanent, compressed)
//
// Each tier has: capacity, TTL, decay, promotion threshold, retrieval cost.
//
// Critical invariant: memory is NOT infinite prompt stuffing.
// When a tier fills, the oldest/least-salient items are summarized or evicted.
// Promotion happens when an episodic item is referenced many times (→ semantic).
// Demotion: semantic items decay if no longer supported by evidence.

import { emitCognitionEvent } from "../cognition/cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MemoryTier = 1 | 2 | 3 | 4 | 5;

export type MemoryDomain =
  | "wellness_goal" | "emotional_pattern" | "behavioral_observation"
  | "coaching_insight" | "user_preference" | "milestone" | "struggle" | "synthesis";

export type MemoryEntry = {
  id: string;
  tier: MemoryTier;
  domain: MemoryDomain;
  content: string;
  semanticTags: string[];
  salience: number;       // 0-1
  confidence: number;     // 0-1
  source: string;         // which module created this
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  promotionEligible: boolean;
  compressedFrom?: string[]; // IDs compressed into this entry
};

export type TierReport = {
  tier: MemoryTier;
  name: string;
  itemCount: number;
  maxItems: number;
  fillPct: number;
  oldestItemAgeMs: number | null;
  newestItemAgeMs: number | null;
  estimatedSizeBytes: number;
};

export type MemoryHierarchyReport = {
  tiers: TierReport[];
  totalItems: number;
  totalEstimatedSizeBytes: number;
  evictionsThisSession: number;
  promotionsThisSession: number;
  topSalientItems: Array<{ content: string; tier: MemoryTier; salience: number }>;
};

// ── Tier configuration ────────────────────────────────────────────────────────

const TIER_CONFIG: Record<MemoryTier, { name: string; maxItems: number; ttlMs: number; promotionThreshold: number; retrievalCost: number }> = {
  1: { name: "Working",    maxItems: 10,  ttlMs: 2 * 60 * 1000,               promotionThreshold: 5, retrievalCost: 1 },
  2: { name: "Session",    maxItems: 50,  ttlMs: 8 * 60 * 60 * 1000,          promotionThreshold: 3, retrievalCost: 2 },
  3: { name: "Episodic",   maxItems: 200, ttlMs: 90 * 24 * 60 * 60 * 1000,   promotionThreshold: 8, retrievalCost: 3 },
  4: { name: "Semantic",   maxItems: 100, ttlMs: 365 * 24 * 60 * 60 * 1000,  promotionThreshold: 20, retrievalCost: 4 },
  5: { name: "Reflective", maxItems: 20,  ttlMs: Infinity,                     promotionThreshold: Infinity, retrievalCost: 5 },
};

const STORAGE_KEYS: Record<MemoryTier, string> = {
  1: "", // volatile — not stored
  2: "ai_memory_session_v1",
  3: "ai_memory_episodic_v1",
  4: "ai_memory_semantic_v1",
  5: "ai_memory_reflective_v1",
};

// ── Tier 1: volatile working memory ──────────────────────────────────────────

const _workingMemory: MemoryEntry[] = [];

// ── Persistent tier helpers ────────────────────────────────────────────────────

function loadTier(tier: Exclude<MemoryTier, 1>): MemoryEntry[] {
  const storage = tier === 2 ? sessionStorage : localStorage;
  try { return JSON.parse(storage.getItem(STORAGE_KEYS[tier]) ?? "[]") as MemoryEntry[]; }
  catch { return []; }
}

function saveTier(tier: Exclude<MemoryTier, 1>, entries: MemoryEntry[]): void {
  const storage = tier === 2 ? sessionStorage : localStorage;
  try { storage.setItem(STORAGE_KEYS[tier], JSON.stringify(entries)); } catch { /* full */ }
}

function getTierEntries(tier: MemoryTier): MemoryEntry[] {
  if (tier === 1) return _workingMemory;
  return loadTier(tier);
}

function setTierEntries(tier: MemoryTier, entries: MemoryEntry[]): void {
  if (tier === 1) { _workingMemory.length = 0; _workingMemory.push(...entries); return; }
  saveTier(tier, entries);
}

// ── ID and tracking ───────────────────────────────────────────────────────────

let _idCounter = 0;
let _evictions = 0;
let _promotions = 0;

function nextMemoryId(tier: MemoryTier): string {
  return `mem-t${tier}-${Date.now()}-${_idCounter++}`;
}

// ── Write ──────────────────────────────────────────────────────────────────────

export function writeMemory(
  tier: MemoryTier,
  content: string,
  opts: {
    domain?: MemoryDomain;
    semanticTags?: string[];
    salience?: number;
    confidence?: number;
    source?: string;
  } = {},
): string {
  const entries = getTierEntries(tier);
  const config = TIER_CONFIG[tier];

  // Deduplication: don't write near-identical content to same tier
  const duplicate = entries.find((e) => e.content.slice(0, 60) === content.slice(0, 60));
  if (duplicate) {
    duplicate.accessCount++;
    duplicate.lastAccessedAt = Date.now();
    if (opts.salience && opts.salience > duplicate.salience) duplicate.salience = opts.salience;
    setTierEntries(tier, entries);
    return duplicate.id;
  }

  // Evict if at capacity
  if (entries.length >= config.maxItems) {
    evictFromTier(tier, entries);
  }

  const entry: MemoryEntry = {
    id: nextMemoryId(tier),
    tier,
    domain: opts.domain ?? "behavioral_observation",
    content,
    semanticTags: opts.semanticTags ?? [],
    salience: opts.salience ?? 0.5,
    confidence: opts.confidence ?? 0.7,
    source: opts.source ?? "unknown",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 1,
    promotionEligible: false,
  };

  entries.push(entry);
  setTierEntries(tier, entries);
  return entry.id;
}

// ── Eviction ──────────────────────────────────────────────────────────────────

function evictFromTier(tier: MemoryTier, entries: MemoryEntry[]): void {
  const now = Date.now();
  const config = TIER_CONFIG[tier];

  // First: evict expired
  const expired = entries.filter((e) => config.ttlMs !== Infinity && now - e.createdAt > config.ttlMs);
  if (expired.length > 0) {
    const updated = entries.filter((e) => !expired.map((ex) => ex.id).includes(e.id));
    setTierEntries(tier, updated);
    _evictions += expired.length;
    emitCognitionEvent("memory_evicted", { tier, count: expired.length, reason: "ttl_expired" });
    return;
  }

  // Then: evict lowest salience × confidence composite
  const scored = entries.map((e) => ({ e, score: e.salience * e.confidence * (1 + Math.log(e.accessCount + 1) * 0.1) }));
  const toEvict = scored.sort((a, b) => a.score - b.score).slice(0, Math.ceil(entries.length * 0.1))[0];
  if (toEvict) {
    const updated = entries.filter((e) => e.id !== toEvict.e.id);
    setTierEntries(tier, updated);
    _evictions++;
    emitCognitionEvent("memory_evicted", { tier, id: toEvict.e.id, reason: "capacity" });
  }
}

// ── Evict stale across all tiers ──────────────────────────────────────────────

export function evictStaleMem(): void {
  for (const tier of [2, 3, 4, 5] as Exclude<MemoryTier, 1>[]) {
    const entries = loadTier(tier);
    const config = TIER_CONFIG[tier];
    const now = Date.now();
    if (config.ttlMs === Infinity) continue;
    const fresh = entries.filter((e) => now - e.createdAt <= config.ttlMs);
    if (fresh.length < entries.length) {
      saveTier(tier, fresh);
      _evictions += entries.length - fresh.length;
    }
  }
}

// ── Promotion ─────────────────────────────────────────────────────────────────

export function promoteMemory(entryId: string, fromTier: MemoryTier): boolean {
  const toTier = (fromTier + 1) as MemoryTier;
  if (toTier > 5) return false;

  const entries = getTierEntries(fromTier);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return false;
  if (entry.accessCount < TIER_CONFIG[fromTier].promotionThreshold) return false;

  // Write to next tier
  writeMemory(toTier, entry.content, {
    domain: entry.domain,
    semanticTags: entry.semanticTags,
    salience: Math.min(1, entry.salience + 0.1),
    confidence: entry.confidence,
    source: entry.source,
  });

  // Remove from current tier
  setTierEntries(fromTier, entries.filter((e) => e.id !== entryId));
  _promotions++;
  emitCognitionEvent("memory_promoted", { from: fromTier, to: toTier, content: entry.content.slice(0, 80) });
  return true;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

export function retrieveMemory(opts: {
  maxTier?: MemoryTier;
  minSalience?: number;
  domain?: MemoryDomain;
  tags?: string[];
  limit?: number;
}): MemoryEntry[] {
  const maxTier = opts.maxTier ?? 5;
  const minSalience = opts.minSalience ?? 0;
  const limit = opts.limit ?? 10;
  const results: MemoryEntry[] = [];
  const now = Date.now();

  for (let tier = 1; tier <= maxTier; tier++) {
    const config = TIER_CONFIG[tier as MemoryTier];
    const entries = getTierEntries(tier as MemoryTier);

    for (const e of entries) {
      // TTL check
      if (config.ttlMs !== Infinity && now - e.createdAt > config.ttlMs) continue;
      // Salience filter
      if (e.salience < minSalience) continue;
      // Domain filter
      if (opts.domain && e.domain !== opts.domain) continue;
      // Tag filter
      if (opts.tags && opts.tags.length > 0 && !opts.tags.some((t) => e.semanticTags.includes(t))) continue;

      results.push(e);
      // Update access
      e.lastAccessedAt = now;
      e.accessCount++;
      e.promotionEligible = e.accessCount >= config.promotionThreshold;
    }
  }

  return results
    .sort((a, b) => b.salience * b.confidence - a.salience * a.confidence)
    .slice(0, limit);
}

// ── Compress tier ─────────────────────────────────────────────────────────────

export function compressTier(tier: MemoryTier): number {
  const entries = getTierEntries(tier);
  if (entries.length < 5) return 0;

  // Group by domain
  const byDomain = new Map<MemoryDomain, MemoryEntry[]>();
  for (const e of entries) {
    const arr = byDomain.get(e.domain) ?? [];
    arr.push(e);
    byDomain.set(e.domain, arr);
  }

  let compressed = 0;
  for (const [domain, domainEntries] of byDomain) {
    if (domainEntries.length < 3) continue;
    // Keep top 2 by salience; summarize the rest into one entry
    const sorted = [...domainEntries].sort((a, b) => b.salience - a.salience);
    const keep = sorted.slice(0, 2);
    const compress = sorted.slice(2);
    if (!compress.length) continue;

    const compressedContent = `[Compressed ${compress.length} ${domain} observations]`;
    const avgSalience = compress.reduce((s, e) => s + e.salience, 0) / compress.length;
    const avgConf = compress.reduce((s, e) => s + e.confidence, 0) / compress.length;
    const allTags = [...new Set(compress.flatMap((e) => e.semanticTags))];

    const compressedId = nextMemoryId(tier);
    const compressedEntry: MemoryEntry = {
      id: compressedId, tier, domain,
      content: compressedContent,
      semanticTags: allTags,
      salience: avgSalience, confidence: avgConf,
      source: "compression",
      createdAt: Date.now(), lastAccessedAt: Date.now(),
      accessCount: 1, promotionEligible: false,
      compressedFrom: compress.map((e) => e.id),
    };

    const compressIds = new Set(compress.map((e) => e.id));
    const newEntries = getTierEntries(tier).filter((e) => !compressIds.has(e.id));
    newEntries.push(...keep.filter((k) => !newEntries.find((e) => e.id === k.id)));
    newEntries.push(compressedEntry);
    setTierEntries(tier, newEntries);
    compressed += compress.length;
  }

  return compressed;
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getMemoryHierarchyReport(): MemoryHierarchyReport {
  const now = Date.now();
  const tierReports: TierReport[] = [];
  const allItems: MemoryEntry[] = [];

  for (let t = 1; t <= 5; t++) {
    const tier = t as MemoryTier;
    const config = TIER_CONFIG[tier];
    const entries = getTierEntries(tier);
    allItems.push(...entries);

    const ages = entries.map((e) => now - e.createdAt);
    tierReports.push({
      tier,
      name: config.name,
      itemCount: entries.length,
      maxItems: config.maxItems,
      fillPct: Math.round((entries.length / config.maxItems) * 100),
      oldestItemAgeMs: ages.length ? Math.max(...ages) : null,
      newestItemAgeMs: ages.length ? Math.min(...ages) : null,
      estimatedSizeBytes: entries.reduce((s, e) => s + e.content.length * 2, 0),
    });
  }

  const topSalient = [...allItems]
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 5)
    .map((e) => ({ content: e.content.slice(0, 80), tier: e.tier, salience: Math.round(e.salience * 100) / 100 }));

  return {
    tiers: tierReports,
    totalItems: allItems.length,
    totalEstimatedSizeBytes: tierReports.reduce((s, t) => s + t.estimatedSizeBytes, 0),
    evictionsThisSession: _evictions,
    promotionsThisSession: _promotions,
    topSalientItems: topSalient,
  };
}
