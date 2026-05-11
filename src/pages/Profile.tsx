import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAuth0 } from "@auth0/auth0-react";
import { getAllLocalExercises } from "@/data/local/exercises";
import { getPendingMeals } from "@/data/local/mealsStore";
import { ChevronRight, ShieldAlert, Sparkles } from "lucide-react";
import { DISCLAIMER_SECTIONS, EMERGENCY_COPY } from "@/content/disclaimerCopy";

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

  const [safetySheetOpen, setSafetySheetOpen] = useState(false);
  const navigate = useNavigate();

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
    <PageLayout title="Profile" subtitle="Account and preferences">
    <div className="space-y-6">
      {/* =========================
          ACCOUNT
         ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* AUTH RESTORING */}
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

          {/* SIGNED OUT */}
          {!isLoading && !isAuthenticated && (
            <>
              <div className="text-sm text-muted-foreground">
                You're currently using WellMate without an account.
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

          {/* SIGNED IN */}
          {!isLoading && isAuthenticated && (
            <>
              <div className="text-sm text-muted-foreground">
                You're signed in{user?.email ? ` as ${user.email}` : ""}.
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
              Sync runs automatically when you're online and signed in.
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

      {/* =========================
          WHAT'S NEXT
         ========================= */}
      <button
        type="button"
        onClick={() => navigate("/roadmap")}
        className="w-full text-left"
      >
        <Card className="border-primary/20 hover:border-primary/40 hover:bg-primary/[0.02] transition-colors duration-150">
          <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">What's Next</p>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Roadmap, vision, and future integrations
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardContent>
        </Card>
      </button>

      {/* =========================
          HEALTH & SAFETY
         ========================= */}
      <Card className="border-amber-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>Health &amp; Safety</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            WellMate is a wellness companion, not a medical device. AI content is for
            general informational purposes only and is not medical advice.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setSafetySheetOpen(true)}
          >
            Read health disclaimer
          </Button>
        </CardContent>
      </Card>

      {/* Health & Safety bottom sheet */}
      <Sheet open={safetySheetOpen} onOpenChange={setSafetySheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] flex flex-col rounded-t-2xl">
          <SheetHeader className="flex-shrink-0 pb-2">
            <SheetTitle>Health &amp; Safety</SheetTitle>
            <SheetDescription>
              Please read before making any health decisions.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">
            {/* Emergency resources — always at the top */}
            <div className="rounded-xl border border-amber-200/50 bg-amber-50/60 p-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {EMERGENCY_COPY.title}
              </p>
              <p className="text-[12px] text-amber-800/80">{EMERGENCY_COPY.body}</p>
              <div className="space-y-1.5 mt-2">
                {EMERGENCY_COPY.resources.map((r) => (
                  <div key={r.label} className="text-[13px]">
                    <span className="font-semibold">{r.label}</span>
                    {" "}— {r.description}
                  </div>
                ))}
              </div>
            </div>

            {/* Full disclaimer sections */}
            {DISCLAIMER_SECTIONS.map((section, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                <p className="text-[13px] leading-relaxed text-foreground/80">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </PageLayout>
  );
}
