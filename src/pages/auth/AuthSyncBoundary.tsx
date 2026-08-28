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
    doSync.current();

    return () => {
      cancelledRef.current = true;
    };
  }, [isAuthenticated]);

  React.useEffect(() => {
    const unsub = subscribeToConnectivity((online) => {
      if (online) doSync.current();
    });

    return unsub;
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
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await updateCurrentUser();

        if (cancelled) return;

        try {
          const raw = localStorage.getItem("onboarding_profile");

          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const payload: Record<string, unknown> = {};

            if (typeof parsed.dob === "string" && parsed.dob) payload.dob = parsed.dob;
            if (parsed.sex === "male" || parsed.sex === "female" || parsed.sex === "other") payload.sex = parsed.sex;
            if (typeof parsed.heightCm === "number" && Number.isFinite(parsed.heightCm) && parsed.heightCm > 0) payload.heightCm = parsed.heightCm;
            if (typeof parsed.weightKg === "number" && Number.isFinite(parsed.weightKg) && parsed.weightKg > 0) payload.weightKg = parsed.weightKg;
            if (parsed.activityLevel === "sedentary" || parsed.activityLevel === "light" || parsed.activityLevel === "moderate" || parsed.activityLevel === "active" || parsed.activityLevel === "veryActive") payload.activityLevel = parsed.activityLevel;
            if (parsed.weightGoal === "lose" || parsed.weightGoal === "maintain" || parsed.weightGoal === "gain") {
              payload.weightGoal = parsed.weightGoal;
              payload.goal = parsed.weightGoal;
            }
            if (typeof parsed.dailySteps === "string" && parsed.dailySteps) payload.dailySteps = parsed.dailySteps;
            if (typeof parsed.muscleGoal === "string" && parsed.muscleGoal) payload.muscleGoal = parsed.muscleGoal;
            if (typeof parsed.cycleLength === "number" && Number.isFinite(parsed.cycleLength)) payload.cycleLength = parsed.cycleLength;
            if (typeof parsed.lastPeriod === "string" && parsed.lastPeriod) payload.lastPeriod = parsed.lastPeriod;
            if (typeof parsed.additionalHealthNotes === "string" && parsed.additionalHealthNotes) payload.additionalHealthNotes = parsed.additionalHealthNotes;
            if (typeof parsed.bloodType === "string" && parsed.bloodType) payload.bloodType = parsed.bloodType;
            if (typeof parsed.allergies === "string" && parsed.allergies) payload.allergies = parsed.allergies.split(",").map((item) => item.trim()).filter(Boolean);
            if (typeof parsed.emergencyContactName === "string" && parsed.emergencyContactName.trim()) payload.emergencyContactName = parsed.emergencyContactName.trim();
            if (typeof parsed.emergencyContactPhone === "string" && parsed.emergencyContactPhone.trim()) payload.emergencyContactPhone = parsed.emergencyContactPhone.trim();
            if (typeof parsed.localAmbulanceNumber === "string" && parsed.localAmbulanceNumber.trim()) payload.localAmbulanceNumber = parsed.localAmbulanceNumber.trim();
            if (parsed.trackingMode === "automatic" || parsed.trackingMode === "manual") payload.trackingMode = parsed.trackingMode;

            if (Object.keys(payload).length > 0) {
              await completeOnboarding(payload);
              if (!cancelled) localStorage.setItem("onboarded", "true");
            }
          }
        } catch (promotionError) {
          console.error("[WellMate] Onboarding promotion failed:", promotionError);
        }

        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (err) {
        console.error("[WellMate] User bootstrap failed:", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to initialize your account.",
          );
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [updateCurrentUser, completeOnboarding]);

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
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Preparing WellMate…</div>
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