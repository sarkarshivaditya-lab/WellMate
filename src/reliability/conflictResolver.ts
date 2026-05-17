// src/reliability/conflictResolver.ts

/* ======================================================
   CONFLICT RESOLVER — PHASE 2

   Infrastructure for detecting and resolving conflicts
   between local and remote state.

   Current strategy: Last-Write-Wins by updatedAt timestamp.
   Future: vector clocks / CRDTs for multi-device.

   Conflict types:
   1. STALE_LOCAL  — remote is newer than local → accept remote
   2. STALE_REMOTE — local is newer than remote → keep local, re-sync
   3. CONCURRENT   — same timestamp, same field → merge or pick local
   4. DELETED_REMOTE — remote record no longer exists → local wins or accept delete
   5. SCHEMA_MISMATCH — remote shape doesn't match expected → log and quarantine

   Resolution policies:
   - "local_wins"  : always keep local (offline-first)
   - "remote_wins" : always accept remote (server-authoritative)
   - "lww"         : last-write-wins by updatedAt (default for most entities)
   - "merge"       : field-level merge (future)

   Rules for WellMate:
   - Local is ALWAYS the source of truth for new entries
   - Remote can ONLY overwrite local if remote.updatedAt > local.updatedAt
   - Deletions from remote are only accepted after explicit confirmation
   - All conflicts are recorded for diagnostics

====================================================== */

import { recordDiagnosticEvent } from "./diagnostics";
import { track } from "@/telemetry/telemetry";

/* --------------------------------------------------
   TYPES
   -------------------------------------------------- */

export type ConflictType =
  | "stale_local"
  | "stale_remote"
  | "concurrent"
  | "deleted_remote"
  | "schema_mismatch";

export type ResolutionPolicy =
  | "local_wins"
  | "remote_wins"
  | "lww"
  | "merge";

export type ConflictRecord = {
  id: string;               // conflict UUID
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  policy: ResolutionPolicy;
  localUpdatedAt: number;
  remoteUpdatedAt?: number;
  resolvedAt: number;
  resolution: "local_kept" | "remote_accepted" | "merged" | "deferred";
};

type ConflictResolution<T> = {
  resolved: T;
  record: ConflictRecord;
};

/* --------------------------------------------------
   CONFLICT LOG (IN-MEMORY RING BUFFER)
   -------------------------------------------------- */

const MAX_LOG = 50;
const conflictLog: ConflictRecord[] = [];

export function getConflictLog(): readonly ConflictRecord[] {
  return conflictLog;
}

function logConflict(record: ConflictRecord) {
  conflictLog.push(record);
  if (conflictLog.length > MAX_LOG) conflictLog.shift();
  recordDiagnosticEvent("conflict_detected", {
    entityType: record.entityType,
    conflictType: record.conflictType,
  });
}

/* --------------------------------------------------
   CORE RESOLUTION
   -------------------------------------------------- */

type Versioned = {
  updatedAt?: number;
  [key: string]: unknown;
};

/**
 * Resolve a conflict between a local and remote version of a record.
 *
 * Default policy: LWW (last-write-wins by updatedAt).
 * Local wins on tie (offline-first guarantee).
 */
export function resolveConflict<T extends Versioned>(opts: {
  entityType: string;
  entityId: string;
  local: T;
  remote: T;
  policy?: ResolutionPolicy;
}): ConflictResolution<T> {
  const { entityType, entityId, local, remote, policy = "lww" } = opts;

  const localTs = local.updatedAt ?? 0;
  const remoteTs = remote.updatedAt ?? 0;

  let conflictType: ConflictType;
  let resolution: ConflictRecord["resolution"];
  let resolved: T;

  if (policy === "local_wins") {
    conflictType = localTs > remoteTs ? "stale_remote" : "concurrent";
    resolution = "local_kept";
    resolved = local;
  } else if (policy === "remote_wins") {
    conflictType = remoteTs > localTs ? "stale_local" : "concurrent";
    resolution = "remote_accepted";
    resolved = remote;
  } else {
    // LWW — local wins on tie
    if (localTs >= remoteTs) {
      conflictType = "stale_remote";
      resolution = "local_kept";
      resolved = local;
    } else {
      conflictType = "stale_local";
      resolution = "remote_accepted";
      resolved = remote;
    }
  }

  const record: ConflictRecord = {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    conflictType,
    policy,
    localUpdatedAt: localTs,
    remoteUpdatedAt: remoteTs,
    resolvedAt: Date.now(),
    resolution,
  };

  logConflict(record);

  if (resolution === "remote_accepted") {
    track("sync_error", { note: `conflict resolved: ${conflictType}` });
    recordDiagnosticEvent("conflict_resolved");
  }

  return { resolved, record };
}

/* --------------------------------------------------
   STALE WRITE GUARD
   Prevents remote overwrites of fresher local state.
   -------------------------------------------------- */

/**
 * Returns true if the remote write should be REJECTED because
 * the local version is newer.
 *
 * Use this before applying any remote data to local storage.
 */
export function isStaleRemoteWrite(
  localUpdatedAt: number,
  remoteUpdatedAt: number,
): boolean {
  return localUpdatedAt > remoteUpdatedAt;
}

/* --------------------------------------------------
   VERSION TRACKING HELPERS
   -------------------------------------------------- */

/**
 * Bump the conflict version for an entity.
 * Call this before enqueueing a local mutation.
 */
export function nextConflictVersion(currentVersion: number): number {
  return currentVersion + 1;
}

/**
 * Check whether two records are considered concurrent
 * (within the same millisecond — practically impossible but guards edge cases).
 */
export function areConcurrent(a: Versioned, b: Versioned): boolean {
  return (a.updatedAt ?? 0) === (b.updatedAt ?? 0);
}
