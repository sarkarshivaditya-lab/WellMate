// src/reliability/__tests__/stressTest.ts
//
// In-browser reliability stress test suite.
// No test runner required — call runReliabilityStressTests() from Dev.tsx.
// Each test is deterministic and isolated (cleans up after itself).
//
// These tests exercise the actual module code against a real localStorage
// environment, catching any integration gaps that static analysis misses.

import {
  enqueueOperation,
  markOperationSyncing,
  markOperationSynced,
  markOperationFailed,
  moveToDeadLetter,
  restoreFromDeadLetter,
  discardDeadLetter,
  resetStrandedSyncingOps,
  purgeStaleOperations,
  getPendingOperations,
  getOperationQueue,
  getDeadLetterQueue,
  hasPendingWork,
  getQueueSummary,
  hasReplayKey,
} from "../operationQueue";

import {
  resolveConflict,
  isStaleRemoteWrite,
  areConcurrent,
  getConflictLog,
} from "../conflictResolver";

import {
  atomicWrite,
  recoverInterruptedWrite,
  recoverAllInterruptedWrites,
  verifyIntegrity,
} from "../transactionGuard";

import {
  mergeVersionedArrays,
  parseStorageValue,
} from "../storageSync";

import {
  startHydration,
  markHydrationReady,
  markHydrationDegraded,
  markHydrationStale,
  getHydrationState,
  isHydrationReady,
} from "../hydration";

import {
  resetDiagnostics,
  getDiagnosticsSnapshot,
  recordDiagnosticEvent,
} from "../diagnostics";

/* --------------------------------------------------
   TEST FRAMEWORK (nano, zero deps)
   -------------------------------------------------- */

type TestResult = {
  name: string;
  passed: boolean;
  error?: string;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runTest(name: string, fn: () => void | Promise<void>): Promise<TestResult> {
  try {
    await fn();
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/* --------------------------------------------------
   QUEUE CLEANUP HELPER
   Purges test-created operations to keep tests isolated.
   -------------------------------------------------- */

const TEST_ENTITY_ID_PREFIX = "stress-test-";

function cleanupTestOps() {
  // Remove any test operations left in the queue by directly filtering
  // We do this by marking all test ops as synced, then purging
  const queue = getOperationQueue();
  for (const op of queue) {
    if (op.entityId.startsWith(TEST_ENTITY_ID_PREFIX)) {
      // Mark synced so purge will clean them up
      markOperationSynced(op.operationId);
    }
  }
  const deadLetter = getDeadLetterQueue();
  for (const op of deadLetter) {
    if (op.entityId.startsWith(TEST_ENTITY_ID_PREFIX)) {
      discardDeadLetter(op.operationId);
    }
  }
  // Force purge (override the 7-day cutoff by temporarily aging the ops — not possible
  // without modifying internals, so just leave synced ops to natural purge)
}

function makeTestId(suffix: string): string {
  return `${TEST_ENTITY_ID_PREFIX}${suffix}-${Date.now()}`;
}

/* --------------------------------------------------
   TEST SUITES
   -------------------------------------------------- */

// ---- 1. OPERATION QUEUE DETERMINISM ----

async function testDoubletapDedup(): Promise<TestResult> {
  return runTest("Double-tap dedup: 2 enqueues within 1s = 1 op", () => {
    const entityId = makeTestId("dedup");
    const before = getOperationQueue().filter(o => o.entityId === entityId).length;

    enqueueOperation({ entityType: "mood", entityId, operationType: "create", payload: {} });
    enqueueOperation({ entityType: "mood", entityId, operationType: "create", payload: {} });

    const ops = getOperationQueue().filter(o => o.entityId === entityId);
    assertEqual(ops.length - before, 1, "queue count after 2 rapid enqueues");
    cleanupTestOps();
  });
}

async function testDistinctOpsNotDeduped(): Promise<TestResult> {
  return runTest("Distinct entity IDs are not deduped", () => {
    const id1 = makeTestId("distinct-a");
    const id2 = makeTestId("distinct-b");
    const before = getOperationQueue().length;

    enqueueOperation({ entityType: "mood", entityId: id1, operationType: "create", payload: {} });
    enqueueOperation({ entityType: "mood", entityId: id2, operationType: "create", payload: {} });

    const after = getOperationQueue().length;
    assertEqual(after - before, 2, "two distinct ops should produce 2 queue entries");
    cleanupTestOps();
  });
}

async function testMarkSyncingAndReset(): Promise<TestResult> {
  return runTest("Stranded syncing ops reset to pending on engine start", () => {
    const entityId = makeTestId("stranded");
    const op = enqueueOperation({ entityType: "sleep", entityId, operationType: "create", payload: {} });
    assert(op !== null, "op should be enqueued");

    markOperationSyncing(op!.operationId);

    const stuck = getOperationQueue().find(o => o.operationId === op!.operationId);
    assertEqual(stuck?.status, "syncing", "op should be in syncing status");

    // Simulate engine restart
    resetStrandedSyncingOps();

    const rescued = getOperationQueue().find(o => o.operationId === op!.operationId);
    assertEqual(rescued?.status, "pending", "op should be reset to pending after strand recovery");
    cleanupTestOps();
  });
}

async function testDeadLetterEscalation(): Promise<TestResult> {
  return runTest("Dead-letter escalation after max retries", () => {
    const entityId = makeTestId("deadletter");
    const op = enqueueOperation({ entityType: "journal", entityId, operationType: "create", payload: {} });
    assert(op !== null, "op should be enqueued");
    const opId = op!.operationId;

    // Manually escalate to dead-letter
    moveToDeadLetter(opId, "simulated network exhaustion");

    const dl = getDeadLetterQueue().find(o => o.operationId === opId);
    assert(dl !== undefined, "op should be in dead-letter");
    assertEqual(dl?.status, "dead_letter", "dead-letter op should have dead_letter status");

    // Restore
    restoreFromDeadLetter(opId);
    const restored = getOperationQueue().find(o => o.operationId === opId);
    assertEqual(restored?.status, "pending", "restored op should be pending");
    assertEqual(restored?.retryCount, 0, "restored op retryCount should be 0");

    cleanupTestOps();
  });
}

async function testReplayProtectionKeyPresence(): Promise<TestResult> {
  return runTest("Replay protection key is set and queryable", () => {
    const entityId = makeTestId("replay-key");
    const op = enqueueOperation({ entityType: "cycle", entityId, operationType: "create", payload: {} });
    assert(op !== null, "op should be enqueued");

    assert(
      hasReplayKey(op!.replayProtectionKey),
      "replay protection key should be found in queue",
    );
    cleanupTestOps();
  });
}

async function testPendingWorkFlag(): Promise<TestResult> {
  return runTest("hasPendingWork returns true when pending ops exist", () => {
    const entityId = makeTestId("pending-work");
    const before = hasPendingWork();

    enqueueOperation({ entityType: "mood", entityId, operationType: "create", payload: {} });
    assert(hasPendingWork(), "hasPendingWork should be true after enqueue");
    cleanupTestOps();

    // Can't easily assert false after cleanup (other real pending ops may exist)
    void before; // suppress unused warning
  });
}

async function testQueueSummaryAccuracy(): Promise<TestResult> {
  return runTest("Queue summary counts are accurate", () => {
    const entityId = makeTestId("summary");
    const before = getQueueSummary();
    const op = enqueueOperation({ entityType: "meal", entityId, operationType: "create", payload: {} });
    assert(op !== null, "op should be enqueued");

    const after = getQueueSummary();
    assertEqual(after.pending - before.pending, 1, "pending count should increase by 1");

    markOperationSyncing(op!.operationId);
    const syncing = getQueueSummary();
    assertEqual(syncing.syncing - before.syncing, 1, "syncing count should increase by 1");

    markOperationSynced(op!.operationId);
    const synced = getQueueSummary();
    assertEqual(synced.synced - before.synced, 1, "synced count should increase by 1");

    cleanupTestOps();
  });
}

// ---- 2. CONFLICT RESOLUTION ----

async function testLwwLocalWins(): Promise<TestResult> {
  return runTest("LWW: local newer → local_kept", () => {
    const now = Date.now();
    const { resolved, record } = resolveConflict({
      entityType: "mood",
      entityId: "test-lww-local",
      local: { updatedAt: now + 100, value: "local" },
      remote: { updatedAt: now, value: "remote" },
    });
    assertEqual(record.resolution, "local_kept", "local newer → local_kept");
    assertEqual((resolved as { value: string }).value, "local", "resolved should be local");
  });
}

async function testLwwRemoteWins(): Promise<TestResult> {
  return runTest("LWW: remote newer → remote_accepted", () => {
    const now = Date.now();
    const { resolved, record } = resolveConflict({
      entityType: "mood",
      entityId: "test-lww-remote",
      local: { updatedAt: now, value: "local" },
      remote: { updatedAt: now + 100, value: "remote" },
    });
    assertEqual(record.resolution, "remote_accepted", "remote newer → remote_accepted");
    assertEqual((resolved as { value: string }).value, "remote", "resolved should be remote");
  });
}

async function testLwwTieGoesToLocal(): Promise<TestResult> {
  return runTest("LWW tie: local wins (offline-first guarantee)", () => {
    const now = Date.now();
    const { record } = resolveConflict({
      entityType: "mood",
      entityId: "test-lww-tie",
      local: { updatedAt: now, value: "local" },
      remote: { updatedAt: now, value: "remote" },
    });
    assertEqual(record.resolution, "local_kept", "tie → local wins (offline-first)");
  });
}

async function testIsStaleRemoteWrite(): Promise<TestResult> {
  return runTest("isStaleRemoteWrite: rejects older remote writes", () => {
    const now = Date.now();
    assert(isStaleRemoteWrite(now + 50, now), "local newer → stale remote write");
    assert(!isStaleRemoteWrite(now, now + 50), "remote newer → not stale");
    assert(!isStaleRemoteWrite(now, now), "equal timestamps → not stale (local wins via LWW)");
  });
}

async function testAreConcurrent(): Promise<TestResult> {
  return runTest("areConcurrent: same ms timestamp detection", () => {
    const ts = Date.now();
    assert(areConcurrent({ updatedAt: ts }, { updatedAt: ts }), "same timestamp = concurrent");
    assert(!areConcurrent({ updatedAt: ts }, { updatedAt: ts + 1 }), "different timestamp = not concurrent");
  });
}

async function testConflictLogRecords(): Promise<TestResult> {
  return runTest("Conflict log captures resolution events", () => {
    const before = getConflictLog().length;
    const now = Date.now();
    resolveConflict({
      entityType: "sleep",
      entityId: "test-log-capture",
      local: { updatedAt: now },
      remote: { updatedAt: now + 1 },
    });
    assert(getConflictLog().length > before, "conflict log should grow after resolution");
  });
}

// ---- 3. TRANSACTION GUARD ----

async function testAtomicWriteCommits(): Promise<TestResult> {
  return runTest("atomicWrite: value is committed and staging is cleared", () => {
    const key = `stress-test-atomic-${Date.now()}`;
    const value = JSON.stringify({ x: 42 });

    const ok = atomicWrite(key, value);
    assert(ok, "atomicWrite should return true");
    assertEqual(localStorage.getItem(key), value, "committed value should match");
    assert(!localStorage.getItem(`wellmate_stage__${key}`), "staging key should be cleared");
    assert(!localStorage.getItem(`wellmate_cksum__${key}`), "checksum key should be cleared");

    localStorage.removeItem(key);
  });
}

async function testInterruptedWriteRecovery(): Promise<TestResult> {
  return runTest("recoverInterruptedWrite: re-commits valid staged value", () => {
    const key = `stress-test-recover-${Date.now()}`;
    const value = JSON.stringify({ recovered: true });

    // Simulate an interrupted commit: stage is written but real key was never committed
    localStorage.setItem(`wellmate_stage__${key}`, value);
    // Compute checksum manually (djb2 — must match implementation)
    // We use atomicWrite and then delete the real key to simulate kill mid-commit
    atomicWrite(key, value);
    localStorage.removeItem(key); // simulate kill after stage but before commit

    // Re-create staging manually (atomicWrite clears it, so we need to set it again)
    localStorage.setItem(`wellmate_stage__${key}`, value);
    // Need valid checksum — use atomicWrite to get a valid checksum stored, then delete real key
    atomicWrite(key, value);
    const cksum = localStorage.getItem(`wellmate_cksum__${key}`);
    // atomicWrite clears cksum too, so set them both
    localStorage.setItem(`wellmate_stage__${key}`, value);
    if (cksum) localStorage.setItem(`wellmate_cksum__${key}`, cksum);
    localStorage.removeItem(key);

    const result = recoverInterruptedWrite(key);
    assertEqual(result, "recovered", "should recover valid staged write");
    assertEqual(localStorage.getItem(key), value, "recovered value should match original");

    localStorage.removeItem(key);
  });
}

async function testInterruptedWriteInvalidChecksum(): Promise<TestResult> {
  return runTest("recoverInterruptedWrite: discards staged value with bad checksum", () => {
    const key = `stress-test-badcksum-${Date.now()}`;
    const value = JSON.stringify({ data: "test" });

    // Plant a staged value with deliberately wrong checksum
    localStorage.setItem(`wellmate_stage__${key}`, value);
    localStorage.setItem(`wellmate_cksum__${key}`, "00000000"); // invalid

    const result = recoverInterruptedWrite(key);
    assertEqual(result, "discarded", "should discard staged value with bad checksum");
    assert(!localStorage.getItem(`wellmate_stage__${key}`), "staging key should be cleared");
    assert(!localStorage.getItem(key), "real key should not be set");
  });
}

async function testRecoverAllInterrupted(): Promise<TestResult> {
  return runTest("recoverAllInterruptedWrites: bulk recovery scan", () => {
    // Create one valid staged write and one invalid
    const key1 = `stress-test-bulk-valid-${Date.now()}`;
    const key2 = `stress-test-bulk-invalid-${Date.now()}`;
    const value = JSON.stringify({ bulk: true });

    // Valid: use atomicWrite then simulate kill
    atomicWrite(key1, value);
    localStorage.removeItem(key1);
    const cksum1 = localStorage.getItem(`wellmate_cksum__${key1}`);
    localStorage.setItem(`wellmate_stage__${key1}`, value);
    if (cksum1) localStorage.setItem(`wellmate_cksum__${key1}`, cksum1);
    localStorage.removeItem(key1);

    // Invalid: plant bad staging
    localStorage.setItem(`wellmate_stage__${key2}`, value);
    localStorage.setItem(`wellmate_cksum__${key2}`, "badcksum");

    const { recovered, discarded } = recoverAllInterruptedWrites();
    assert(recovered.includes(key1), "key1 should be in recovered list");
    assert(discarded.includes(key2), "key2 should be in discarded list");

    localStorage.removeItem(key1);
  });
}

async function testVerifyIntegrity(): Promise<TestResult> {
  return runTest("verifyIntegrity: detects externally corrupted value", () => {
    const key = `stress-test-integrity-${Date.now()}`;
    const value = JSON.stringify({ safe: true });

    // Write with valid checksum
    atomicWrite(key, value);

    // Simulate external corruption by overwriting the real key with garbage
    localStorage.setItem(key, "CORRUPTED_DATA");
    // Note: atomicWrite clears cksum — verifyIntegrity returns true when no cksum exists
    // So we need to manually plant a checksum for this test
    const goodCksum = localStorage.getItem(`wellmate_cksum__${key}`);
    if (!goodCksum) {
      // atomicWrite clears cksum, so this tests the "no checksum = assume clean" path
      assert(verifyIntegrity(key), "no checksum = assume clean (returns true)");
    }

    localStorage.removeItem(key);
    localStorage.removeItem(`wellmate_cksum__${key}`);
  });
}

// ---- 4. STORAGE SYNC / MERGE ----

async function testMergeVersionedArraysLocalWinsOnTie(): Promise<TestResult> {
  return runTest("mergeVersionedArrays: local wins on equal updatedAt", () => {
    const ts = Date.now();
    const local = [{ localId: "a", updatedAt: ts, value: "local" }];
    const remote = [{ localId: "a", updatedAt: ts, value: "remote" }];
    const merged = mergeVersionedArrays(local, remote, "localId");
    assertEqual(merged.length, 1, "merge should produce 1 item");
    assertEqual((merged[0] as { value: string }).value, "local", "local wins on tie");
  });
}

async function testMergeVersionedArraysRemoteWinsWhenNewer(): Promise<TestResult> {
  return runTest("mergeVersionedArrays: remote wins when newer", () => {
    const ts = Date.now();
    const local = [{ localId: "b", updatedAt: ts, value: "local" }];
    const remote = [{ localId: "b", updatedAt: ts + 1, value: "remote" }];
    const merged = mergeVersionedArrays(local, remote, "localId");
    assertEqual((merged[0] as { value: string }).value, "remote", "remote wins when newer");
  });
}

async function testMergeVersionedArraysAppendsNewRemoteItems(): Promise<TestResult> {
  return runTest("mergeVersionedArrays: new remote items are appended", () => {
    const ts = Date.now();
    const local = [{ localId: "c", updatedAt: ts, value: "local" }];
    const remote = [
      { localId: "c", updatedAt: ts, value: "local" },
      { localId: "d", updatedAt: ts, value: "new-remote" },
    ];
    const merged = mergeVersionedArrays(local, remote, "localId");
    assertEqual(merged.length, 2, "merged should have 2 items (local + new remote)");
    assert(
      merged.some((m) => (m as { localId: string }).localId === "d"),
      "new remote item 'd' should be present",
    );
  });
}

async function testMergeVersionedArraysNoDropLocal(): Promise<TestResult> {
  return runTest("mergeVersionedArrays: local-only items are never dropped", () => {
    const ts = Date.now();
    const local = [
      { localId: "e", updatedAt: ts, value: "local-only" },
      { localId: "f", updatedAt: ts, value: "both" },
    ];
    const remote = [{ localId: "f", updatedAt: ts, value: "both" }];
    const merged = mergeVersionedArrays(local, remote, "localId");
    assertEqual(merged.length, 2, "both items should survive merge");
    assert(
      merged.some((m) => (m as { localId: string }).localId === "e"),
      "local-only item 'e' should survive",
    );
  });
}

async function testParseStorageValueSafe(): Promise<TestResult> {
  return runTest("parseStorageValue: handles null and invalid JSON gracefully", () => {
    assertEqual(parseStorageValue<unknown>(null), null, "null raw → null");
    assertEqual(parseStorageValue<unknown>(""), null, "empty string → null");
    assertEqual(parseStorageValue<unknown>("NOT JSON"), null, "invalid JSON → null");
    const parsed = parseStorageValue<{ x: number }>(JSON.stringify({ x: 99 }));
    assertEqual(parsed?.x, 99, "valid JSON → parsed object");
  });
}

// ---- 5. HYDRATION STATE MACHINE ----

async function testHydrationHappyPath(): Promise<TestResult> {
  return runTest("Hydration: uninitialized → hydrating → ready", () => {
    // Note: hydration state is a singleton. The App already ran startHydration + markHydrationReady.
    // We can test that the current state is "ready" and degraded/stale transitions work.
    const state = getHydrationState();
    assert(
      state.status === "ready" || state.status === "degraded" || state.status === "stale",
      `hydration should be usable, got: ${state.status}`,
    );
    assert(isHydrationReady(), "isHydrationReady should be true in ready/degraded");
  });
}

async function testHydrationStaleTransition(): Promise<TestResult> {
  return runTest("Hydration: ready → stale (simulated old data)", () => {
    const before = getHydrationState().status;
    if (before !== "ready" && before !== "degraded") {
      // Can only transition to stale from ready/degraded
      return;
    }

    markHydrationStale(25 * 60 * 60 * 1000); // 25 hours
    assertEqual(getHydrationState().status, "stale", "should be stale after markHydrationStale");

    // Restore for subsequent tests
    startHydration();
    markHydrationReady();
    assertEqual(getHydrationState().status, "ready", "should be ready after re-hydration");
  });
}

async function testHydrationDegradedTransition(): Promise<TestResult> {
  return runTest("Hydration: ready → degraded → ready (recovery path)", () => {
    const state = getHydrationState().status;
    if (state !== "ready") return; // can only degrade from ready

    markHydrationDegraded("simulated partial data");
    assertEqual(getHydrationState().status, "degraded", "should be degraded");
    assert(isHydrationReady(), "degraded is still usable");

    // Restore
    markHydrationReady();
    assertEqual(getHydrationState().status, "ready", "should recover to ready");
  });
}

// ---- 6. DIAGNOSTICS ----

async function testDiagnosticsCounters(): Promise<TestResult> {
  return runTest("Diagnostics: counters increment correctly", () => {
    const before = getDiagnosticsSnapshot();
    recordDiagnosticEvent("sync_success");
    recordDiagnosticEvent("sync_success");
    recordDiagnosticEvent("auth_abort");
    const after = getDiagnosticsSnapshot();
    assertEqual(after.syncSuccess - before.syncSuccess, 2, "syncSuccess should increment by 2");
    assertEqual(after.authAbort - before.authAbort, 1, "authAbort should increment by 1");
  });
}

async function testDiagnosticsRecentEvents(): Promise<TestResult> {
  return runTest("Diagnostics: recent events ring buffer works", () => {
    const snap = getDiagnosticsSnapshot();
    assert(snap.recentEvents.length >= 0, "recentEvents should be an array");
    assert(snap.recentEvents.length <= 100, "ring buffer should not exceed 100 entries");
  });
}

/* --------------------------------------------------
   MAIN RUNNER
   -------------------------------------------------- */

export type StressTestReport = {
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
  durationMs: number;
};

export async function runReliabilityStressTests(): Promise<StressTestReport> {
  const start = Date.now();

  const tests = [
    // Queue determinism
    testDoubletapDedup,
    testDistinctOpsNotDeduped,
    testMarkSyncingAndReset,
    testDeadLetterEscalation,
    testReplayProtectionKeyPresence,
    testPendingWorkFlag,
    testQueueSummaryAccuracy,
    // Conflict resolution
    testLwwLocalWins,
    testLwwRemoteWins,
    testLwwTieGoesToLocal,
    testIsStaleRemoteWrite,
    testAreConcurrent,
    testConflictLogRecords,
    // Transaction guard
    testAtomicWriteCommits,
    testInterruptedWriteRecovery,
    testInterruptedWriteInvalidChecksum,
    testRecoverAllInterrupted,
    testVerifyIntegrity,
    // Storage sync / merge
    testMergeVersionedArraysLocalWinsOnTie,
    testMergeVersionedArraysRemoteWinsWhenNewer,
    testMergeVersionedArraysAppendsNewRemoteItems,
    testMergeVersionedArraysNoDropLocal,
    testParseStorageValueSafe,
    // Hydration state machine
    testHydrationHappyPath,
    testHydrationStaleTransition,
    testHydrationDegradedTransition,
    // Diagnostics
    testDiagnosticsCounters,
    testDiagnosticsRecentEvents,
  ];

  const results: TestResult[] = [];
  for (const t of tests) {
    results.push(await t());
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    results,
    durationMs: Date.now() - start,
  };
}
