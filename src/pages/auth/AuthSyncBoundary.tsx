import { useEffect, useRef } from "react";
import { Authenticated, useConvex, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";
import { runSyncEngine } from "@/reliability/syncEngine";
import { getSyncQueue } from "@/sync/syncQueue";
import { listPendingMoods } from "@/data/local/moodsStore";
import { listPendingJournalEntries } from "@/data/local/journalStore";
import { listPendingCycles } from "@/data/local/cycleStore";
import { listPendingSleep } from "@/data/local/sleepStore";
import { isOnline, subscribeToConnectivity } from "@/reliability/connectivity";
import {
  subscribeTo as subscribeToLifecycle,
  notifyAuthChange,
} from "@/reliability/lifecycleCoordinator";
import { hasPendingWork as opQueueHasPendingWork } from "@/reliability/operationQueue";

/* ======================================================
   CONSTANTS
   ====================================================== */

/** Periodic retry interval when there are pending items */
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/* ======================================================
   HELPERS
   ====================================================== */

/** Returns true if any local entity has pending items that need syncing */
function hasPendingWork(): boolean {
  try {
    if (getSyncQueue().length > 0) return true;
    if (listPendingMoods().length > 0) return true;
    if (listPendingJournalEntries().length > 0) return true;
    if (listPendingCycles().length > 0) return true;
    if (listPendingSleep().length > 0) return true;
    if (opQueueHasPendingWork()) return true;
    return false;
  } catch {
    return false;
  }
}

/* ======================================================
   SYNC WORKER
   ====================================================== */

/**
 * SyncWorker — only mounts when Convex confirms auth.
 *
 * Three-layer auth safety:
 *
 * 1. <Authenticated> (outer component) — structurally prevents this component
 *    from mounting until useConvexAuth().isAuthenticated is true.
 *
 * 2. cancelledRef — set to true in the startup useEffect cleanup (runs on
 *    unmount). Any async sync closure that outlives the component reads this
 *    before every worker call and stops immediately.
 *
 * 3. checkAuth passed to runOfflineSync — tested before each sync worker so
 *    auth loss mid-sync stops further mutations without waiting for React.
 *
 * Online-resume fix:
 *    Previously hasRunRef=true after initial sync blocked ALL future syncs,
 *    including when the user adds new data offline then comes back online.
 *    This version separates "has run at least once" from "should run on
 *    reconnect". The connectivity subscription triggers a new sync whenever
 *    the device comes back online AND there is pending work.
 *
 * Periodic retry:
 *    A 5-minute interval fires while mounted, triggering sync if there is
 *    pending work and the device is online. This catches cases where an
 *    online-event was missed (e.g., airplane mode → background → foreground).
 */
function SyncWorker() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const isAuthRef = useRef(false);
  isAuthRef.current = isAuthenticated;

  const cancelledRef = useRef(false);
  const hasRunInitialRef = useRef(false);
  const isSyncingRef = useRef(false);

  // Stable ref to the sync function — reassigned on every render so it
  // always closes over fresh ref values without stale-closure risk.
  const doSync = useRef<() => void>(() => {});
  doSync.current = () => {
    if (cancelledRef.current) return;
    if (!isOnline()) return;
    if (!isAuthRef.current) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    const checkAuth = () => isAuthRef.current && !cancelledRef.current;

    (async () => {
      try {
        // Identity bootstrap — best effort only
        try {
          await updateCurrentUser();
        } catch {
          // swallow — identity may already exist
        }

        // Unified sync engine: drains new operation queue first,
        // then runs legacy entity-specific sync via legacySyncFn.
        try {
          await runSyncEngine({
            convex,
            checkAuth,
            legacySyncFn: () => runOfflineSync(convex, checkAuth),
          });
        } catch {
          // swallow — sync must never destabilize app
        }
      } finally {
        isSyncingRef.current = false;
      }
    })();
  };

  // Startup trigger — runs once on mount (inside <Authenticated> so auth is confirmed)
  useEffect(() => {
    cancelledRef.current = false;

    if (!hasRunInitialRef.current) {
      hasRunInitialRef.current = true;
      doSync.current();
    }

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Connectivity-aware online-resume trigger.
  // Unlike the old approach, this runs on EVERY reconnect (not just the first),
  // and only if there is actually pending work — avoiding no-op syncs.
  useEffect(() => {
    const unsub = subscribeToConnectivity((state) => {
      if (state === "online" && hasPendingWork()) {
        doSync.current();
      }
    });
    return unsub;
  }, []);

  // Periodic retry — catches missed online events and long-running pending queues.
  // Only fires a sync if there is pending work; no-ops otherwise.
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasPendingWork()) {
        doSync.current();
      }
    }, RETRY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Lifecycle coordinator bridge — trigger sync on any sync_requested event
  // (foreground resume, connectivity restore, auth acquired).
  useEffect(() => {
    const unsub = subscribeToLifecycle((event) => {
      if (event.type === "sync_requested" && hasPendingWork()) {
        doSync.current();
      }
    });
    return unsub;
  }, []);

  // Notify lifecycle coordinator of auth state changes so other subscribers
  // (future AI sync, background recovery) can react to auth transitions.
  useEffect(() => {
    notifyAuthChange(isAuthenticated);
  }, [isAuthenticated]);

  return null;
}

/* ======================================================
   AUTH SYNC BOUNDARY
   ====================================================== */

/**
 * AuthSyncBoundary
 *
 * Renders SyncWorker exclusively inside <Authenticated>. Convex's
 * <Authenticated> returns null until useConvexAuth().isAuthenticated is true
 * (backend-confirmed, not Auth0 optimistic state). SyncWorker cannot mount,
 * register effects, or fire mutations until that guarantee holds.
 *
 * HARD GUARANTEES:
 * - NEVER redirects
 * - NEVER blocks rendering
 * - NEVER throws
 * - Safe offline
 * - Safe unauthenticated
 */
export default function AuthSyncBoundary() {
  return (
    <Authenticated>
      <SyncWorker />
    </Authenticated>
  );
}
