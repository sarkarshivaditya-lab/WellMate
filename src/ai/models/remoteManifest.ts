// Remote manifest service — fetches model catalog from server, caches locally,
// falls back to static definitions when offline or endpoint unavailable.
//
// Remote manifest URL: https://wellmate.ai/models/manifest.json
// Refresh interval: 6 hours (with ±30 min jitter to avoid thundering herd).
// If fetch fails for any reason, cached or static manifest is used transparently.
//
// This module is the only place that makes network requests for model metadata.
// All other model code reads from this service.

import type { ModelManifest, ReleaseChannel } from "@/ai/providers/local/modelMetadata";
import { PHI3_MINI_MANIFEST } from "@/ai/providers/local/modelMetadata";

const REMOTE_URL = "https://wellmate.ai/models/manifest.json";
const CACHE_KEY = "ai_remote_manifest_v1";
const CHANNEL_KEY = "ai_release_channel";
const ROLLOUT_SEED_KEY = "ai_rollout_seed";
const TTL_MS = 6 * 60 * 60 * 1000;          // 6 hours
const JITTER_MS = 30 * 60 * 1000;            // ±30 min
const FETCH_TIMEOUT_MS = 8_000;              // 8 s

export type PlatformConfig = {
  emergencyDisable: boolean;
  emergencyReason?: string;
  rolloutPaused: boolean;
  rolloutPausedReason?: string;
  minAppVersion?: string;
};

export type RemoteManifestDocument = {
  schemaVersion: number;
  generatedAt: string;
  platform: PlatformConfig;
  models: ModelManifest[];
};

type CachedRecord = {
  document: RemoteManifestDocument;
  fetchedAt: number;
  etag?: string;
};

export type ManifestSource = "remote" | "cached" | "static_fallback";

export type ManifestResult = {
  models: ModelManifest[];
  platform: PlatformConfig | null;
  source: ManifestSource;
  fetchedAt: number | null;
  error?: string;
};

// ── Static fallback document ───────────────────────────────────────────────────

const STATIC_PLATFORM: PlatformConfig = {
  emergencyDisable: false,
  rolloutPaused: false,
};

const STATIC_FALLBACK: RemoteManifestDocument = {
  schemaVersion: 1,
  generatedAt: "2025-05-01T00:00:00Z",
  platform: STATIC_PLATFORM,
  models: [PHI3_MINI_MANIFEST],
};

// ── Release channel ────────────────────────────────────────────────────────────

export function getReleaseChannel(): ReleaseChannel {
  const stored = localStorage.getItem(CHANNEL_KEY);
  if (stored === "beta" || stored === "experimental" || stored === "internal") return stored;
  return "stable";
}

export function setReleaseChannel(channel: ReleaseChannel): void {
  localStorage.setItem(CHANNEL_KEY, channel);
}

// ── Rollout seed — stable per device, 0–99 ────────────────────────────────────

export function getRolloutSeed(): number {
  const stored = localStorage.getItem(ROLLOUT_SEED_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= 0 && n < 100) return n;
  }
  const seed = Math.floor(Math.random() * 100);
  localStorage.setItem(ROLLOUT_SEED_KEY, String(seed));
  return seed;
}

export function isEligibleForRollout(rolloutPct: number): boolean {
  return getRolloutSeed() < rolloutPct;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readCache(): CachedRecord | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedRecord;
  } catch {
    return null;
  }
}

function writeCache(record: CachedRecord): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch { /* quota exceeded — continue without caching */ }
}

function isCacheFresh(record: CachedRecord): boolean {
  const jitter = Math.floor(Math.random() * JITTER_MS * 2) - JITTER_MS;
  return Date.now() - record.fetchedAt < TTL_MS + jitter;
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidDocument(raw: unknown): raw is RemoteManifestDocument {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Record<string, unknown>;
  return (
    typeof d.schemaVersion === "number" &&
    typeof d.generatedAt === "string" &&
    typeof d.platform === "object" &&
    Array.isArray(d.models) &&
    d.models.length > 0
  );
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

let _current: ManifestResult | null = null;
let _fetchPromise: Promise<ManifestResult> | null = null;

async function fetchRemoteDocument(etag?: string): Promise<RemoteManifestDocument | null> {
  const overrideUrl = localStorage.getItem("ai_manifest_override_url");
  const url = overrideUrl ?? REMOTE_URL;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (etag) headers["If-None-Match"] = etag;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { headers, signal: ac.signal });
    clearTimeout(timer);

    if (res.status === 304) return null; // not modified
    if (!res.ok) return null;

    const json: unknown = await res.json();
    if (!isValidDocument(json)) return null;

    return json;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function fetchManifest(opts?: { force?: boolean }): Promise<ManifestResult> {
  // Deduplicate concurrent fetches
  if (_fetchPromise && !opts?.force) return _fetchPromise;

  _fetchPromise = (async (): Promise<ManifestResult> => {
    const cached = readCache();

    // Return fresh cache immediately
    if (cached && !opts?.force && isCacheFresh(cached)) {
      _current = {
        models: cached.document.models,
        platform: cached.document.platform,
        source: "cached",
        fetchedAt: cached.fetchedAt,
      };
      return _current;
    }

    // Attempt remote fetch
    const doc = await fetchRemoteDocument(cached?.etag);

    if (doc) {
      const record: CachedRecord = { document: doc, fetchedAt: Date.now() };
      writeCache(record);
      _current = {
        models: doc.models,
        platform: doc.platform,
        source: "remote",
        fetchedAt: record.fetchedAt,
      };
      return _current;
    }

    // Remote unavailable — use cache even if stale
    if (cached) {
      _current = {
        models: cached.document.models,
        platform: cached.document.platform,
        source: "cached",
        fetchedAt: cached.fetchedAt,
        error: "Remote unavailable — using cached manifest",
      };
      return _current;
    }

    // Absolute fallback — static built-in manifest
    _current = {
      models: STATIC_FALLBACK.models,
      platform: STATIC_FALLBACK.platform,
      source: "static_fallback",
      fetchedAt: null,
      error: "Remote unavailable — using built-in manifest",
    };
    return _current;
  })().finally(() => { _fetchPromise = null; });

  return _fetchPromise;
}

// Synchronous read of the last resolved manifest — null before first fetch.
export function getManifestResult(): ManifestResult | null {
  return _current;
}

// Returns models from best available source, filtered to the current channel.
export function getAvailableModels(channel?: ReleaseChannel): ModelManifest[] {
  const ch = channel ?? getReleaseChannel();
  const models = _current?.models ?? STATIC_FALLBACK.models;

  // stable channel sees stable only
  // beta sees stable + beta
  // experimental sees all non-internal
  // internal sees everything
  const channelRank: Record<ReleaseChannel, number> = {
    stable: 0,
    beta: 1,
    experimental: 2,
    internal: 3,
  };
  const userRank = channelRank[ch];

  return models.filter((m) => {
    const modelRank = channelRank[m.releaseChannel ?? "stable"];
    return modelRank <= userRank;
  });
}

export function getPlatformConfig(): PlatformConfig | null {
  return _current?.platform ?? null;
}
