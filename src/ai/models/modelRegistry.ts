// Model version registry — single source of truth for which models are available,
// their versions, and which one to recommend for this device.
//
// Priority: remote manifest (fresh) > remote manifest (cached) > static fallback.
// Static fallback (PHI3_MINI_MANIFEST) ensures the app always has a model to offer.
// Remote manifest is fetched by remoteManifest.ts and written into this registry
// via hydrateFromRemote().

import type { ModelManifest, CapabilityTier, DeviceTier } from "@/ai/providers/local/modelMetadata";
import { PHI3_MINI_MANIFEST } from "@/ai/providers/local/modelMetadata";
import { getAvailableModels } from "./remoteManifest";

export type ModelVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type RegistryEntry = {
  manifest: ModelManifest;
  version: ModelVersion;
  recommended: boolean;
  releasedAt?: string;
};

// Static registry — serves as hardcoded fallback when remote manifest unavailable.
const STATIC_REGISTRY: RegistryEntry[] = [
  {
    manifest: PHI3_MINI_MANIFEST,
    version: { major: 1, minor: 0, patch: 0 },
    recommended: true,
    releasedAt: "2025-05-01",
  },
];

// Runtime-mutable registry — populated from remote manifest when available.
let _registry: RegistryEntry[] = [...STATIC_REGISTRY];

// ── Remote hydration ───────────────────────────────────────────────────────────

// Called by initOrchestrator() after remote manifest fetch.
// Preserves static fallback entries for any model not in remote list.
export function hydrateFromRemote(models: ModelManifest[]): void {
  if (!models.length) return;

  const entries: RegistryEntry[] = models.map((m) => {
    // Reuse version from static entry if IDs match; otherwise infer from manifest
    const existing = STATIC_REGISTRY.find((s) => s.manifest.id === m.id);
    const version = existing?.version ?? inferVersion(m);
    return {
      manifest: m,
      version,
      recommended: false, // will be set below
      releasedAt: m.releasedAt,
    };
  });

  // Mark highest-version stable (or channel-appropriate) non-deprecated model as recommended
  const candidates = entries
    .filter((e) => !e.manifest.deprecated)
    .sort((a, b) => compareVersions(b.version, a.version));

  if (candidates[0]) candidates[0].recommended = true;

  _registry = entries;
}

function inferVersion(m: ModelManifest): ModelVersion {
  // No explicit version in manifest — derive from releasedAt date or default to 1.0.0
  if (m.releasedAt) {
    const d = new Date(m.releasedAt);
    return { major: 1, minor: d.getMonth() + 1, patch: d.getDate() };
  }
  return { major: 1, minor: 0, patch: 0 };
}

// ── Registry queries ───────────────────────────────────────────────────────────

export function getRecommendedEntry(): RegistryEntry {
  // Prefer remote-hydrated registry, fall back to static
  const live = _registry.find((e) => e.recommended);
  const fallback = STATIC_REGISTRY.find((e) => e.recommended);
  const entry = live ?? fallback;
  if (!entry) throw new Error("No recommended model in registry");
  return entry;
}

export function getRecommendedManifest(): ModelManifest {
  return getRecommendedEntry().manifest;
}

// Returns all non-deprecated manifests visible in the current release channel.
export function getAllManifests(): ModelManifest[] {
  const remote = getAvailableModels();
  // If remote has entries, prefer them; else use static
  return remote.length > 0
    ? remote.filter((m) => !m.deprecated)
    : _registry.filter((e) => !e.manifest.deprecated).map((e) => e.manifest);
}

export function getAllRegisteredIds(): string[] {
  return _registry.map((e) => e.manifest.id);
}

export function getEntryById(id: string): RegistryEntry | undefined {
  return _registry.find((e) => e.manifest.id === id)
    ?? STATIC_REGISTRY.find((e) => e.manifest.id === id);
}

// Find the best manifest for a given capability tier.
export function getManifestForTier(tier: CapabilityTier): ModelManifest | null {
  const all = getAllManifests();
  return all.find((m) => m.capabilityTier === tier) ?? null;
}

// Find manifests compatible with a given device tier.
export function getManifestsForDeviceTier(deviceTier: DeviceTier): ModelManifest[] {
  const all = getAllManifests();
  return all.filter(
    (m) => !m.targetDeviceTiers || m.targetDeviceTiers.includes(deviceTier),
  );
}

// ── Version utilities ──────────────────────────────────────────────────────────

// Returns positive if a > b, negative if a < b, 0 if equal.
export function compareVersions(a: ModelVersion, b: ModelVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function versionString(v: ModelVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}
