import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth0 } from "@auth0/auth0-react";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getPendingMeals } from "@/data/local/mealsStore";

/**
 * Profile / Settings
 *
 * - Auth0 sign-in + sign-out wired
 * - Correctly handles Auth0 loading lifecycle
 * - Shows sync status (read-only)
 * - No forced redirects
 * - Safe offline
 * - Logout NEVER deletes local data
 */
export default function Profile() {
  const {
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  // ---------- Sync status (best-effort, read-only) ----------
  let pendingCount = 0;
  let errorCount = 0;

  try {
    const exercises = getAllLocalExercises();
    pendingCount += exercises.filter(
      (e) => e.syncStatus === "pending",
    ).length;
    errorCount += exercises.filter(
      (e) => e.syncStatus === "error",
    ).length;
  } catch {
    /* swallow */
  }

  try {
    pendingCount += getPendingMeals().length;
  } catch {
    /* swallow */
  }

  const isOffline = !navigator.onLine;

  let syncLabel = "All data synced";
  let syncTone: "emerald" | "amber" | "red" | "muted" = "emerald";

  if (isOffline) {
    syncLabel = "Offline — sync will resume automatically";
    syncTone = "muted";
  } else if (errorCount > 0) {
    syncLabel = "Some items failed to sync";
    syncTone = "red";
  } else if (pendingCount > 0) {
    syncLabel = "Sync pending";
    syncTone = "amber";
  }

  return (
    <div className="p-6 space-y-6">
      {/* =========================
          ACCOUNT
         ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 🔵 AUTH RESTORING */}
          {isLoading && (
            <>
              <div className="text-sm text-muted-foreground">
                Checking sign-in status…
              </div>

              <Button className="w-full" disabled>
                Please wait
              </Button>
            </>
          )}

          {/* 🔴 SIGNED OUT */}
          {!isLoading && !isAuthenticated && (
            <>
              <div className="text-sm text-muted-foreground">
                You’re currently using WellMate without an account.
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">
                  Sign in to enable sync & backup
                </div>
                <div className="text-xs text-muted-foreground">
                  Signing in lets you back up your data and access it on other
                  devices. Your app works fully offline even without signing in.
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => loginWithRedirect()}
              >
                Sign in
              </Button>
            </>
          )}

          {/* 🟢 SIGNED IN */}
          {!isLoading && isAuthenticated && (
            <>
              <div className="text-sm text-muted-foreground">
                You’re signed in{user?.email ? ` as ${user.email}` : ""}.
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">
                  Account connected
                </div>
                <div className="text-xs text-muted-foreground">
                  Your data can now be securely synced and backed up.
                </div>
              </div>

              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  logout({
                    logoutParams: {
                      returnTo: window.location.origin,
                    },
                  })
                }
              >
                Sign out
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                Signing out will not delete any local data on this device.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* =========================
          SYNC STATUS
         ========================= */}
      {isAuthenticated && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Sync status</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            <div
              className={
                syncTone === "emerald"
                  ? "text-sm text-emerald-600"
                  : syncTone === "amber"
                  ? "text-sm text-amber-600"
                  : syncTone === "red"
                  ? "text-sm text-red-600"
                  : "text-sm text-muted-foreground"
              }
            >
              {syncLabel}
            </div>

            <div className="text-xs text-muted-foreground">
              Sync runs automatically when you’re online and signed in.
            </div>
          </CardContent>
        </Card>
      )}

      {/* =========================
          DATA & PRIVACY
         ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
        </CardHeader>

        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>Your data is stored locally on this device by default.</p>
          <p>
            Signing in enables secure cloud backup and syncing across devices.
          </p>
          <p>
            You stay in control — signing out will never delete local data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
