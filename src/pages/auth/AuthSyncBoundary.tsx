import React from "react";
import {
  Authenticated,
  useConvex,
  useConvexAuth,
  useMutation,
} from "convex/react";
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

const RETRY_INTERVAL_MS = 5 * 60 * 1000;

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

function SyncWorker() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const isAuthRef = React.useRef(false);
  isAuthRef.current = isAuthenticated;

  const cancelledRef = React.useRef(false);
  const isSyncingRef = React.useRef(false);

  const doSync = React.useRef<() => void>(() => {});

  doSync.current = () => {
    if (cancelledRef.current) return;
    if (!isOnline()) return;
    if (!isAuthRef.current) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    const checkAuth = () =>
      isAuthRef.current && !cancelledRef.current;

    void (async () => {
      try {
        try {
          await updateCurrentUser();
        } catch {
          // User bootstrap is handled by UserBootstrapGate.
        }

        try {
          await runSyncEngine({
            convex,
            checkAuth,
            legacySyncFn: () => runOfflineSync(convex, checkAuth),
          });
        } catch {
          // Sync must never destabilize the app.
        }
      } finally {
        isSyncingRef.current = false;
      }
    })();
  };

  React.useEffect(() => {
    cancelledRef.current = false;

    if (isOnline()) {
      doSync.current();
    }

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const connectivityDebounceRef =
    React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const unsub = subscribeToConnectivity((state) => {
      if (state === "online" && hasPendingWork()) {
        if (connectivityDebounceRef.current) {
          clearTimeout(connectivityDebounceRef.current);
        }

        connectivityDebounceRef.current = setTimeout(() => {
          connectivityDebounceRef.current = null;
          doSync.current();
        }, 2000);
      }
    });

    return () => {
      unsub();

      if (connectivityDebounceRef.current) {
        clearTimeout(connectivityDebounceRef.current);
        connectivityDebounceRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (hasPendingWork()) {
        doSync.current();
      }
    }, RETRY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const unsub = subscribeToLifecycle((event) => {
      if (event.type === "sync_requested" && hasPendingWork()) {
        doSync.current();
      }
    });

    return unsub;
  }, []);

  React.useEffect(() => {
    notifyAuthChange(isAuthenticated);
  }, [isAuthenticated]);

  return null;
}

function UserBootstrapGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void updateCurrentUser()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      })
      .catch((err) => {
        console.error("[WellMate] User bootstrap failed:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to initialize your account.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [updateCurrentUser]);

  if (ready) {
    return (
      <>
        <SyncWorker />
        {children}
      </>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          WellMate
        </p>

        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn't initialize your account. Please try again.
        </p>

        <button
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            setError(null);
            setReady(false);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        WellMate
      </p>

      <p className="text-sm text-muted-foreground">
        Preparing your account…
      </p>
    </div>
  );
}

export default function AuthSyncBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Authenticated>
      <UserBootstrapGate>{children}</UserBootstrapGate>
    </Authenticated>
  );
}
