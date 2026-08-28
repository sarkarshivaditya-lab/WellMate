import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ChevronRight, ShieldAlert, Sparkles, Siren } from "lucide-react";
import { PolicyContent } from "@/components/PolicyContent";
import NotificationSettings from "@/components/NotificationSettings";
import { DataOwnershipCard } from "@/components/profile/DataOwnershipCard";
import { HealthProfileSection } from "@/components/profile/HealthProfileSection";
import { AiPrivacyCard } from "@/components/profile/AiPrivacyCard";
import { useEditableProfile } from "@/hooks/useEditableProfile";

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
  const [sosOpen, setSosOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, updateProfile } = useEditableProfile();

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
          HEALTH PROFILE
         ========================= */}
      <HealthProfileSection />

      <Card className="glass-brand border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Golden Hour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Tracking mode</p>
            <p className="text-xs text-muted-foreground mt-1">
              Change how WellMate monitors for suspicious movement.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={(profile?.trackingMode ?? "automatic") === "automatic"}
              onClick={() => updateProfile({ trackingMode: "automatic" })}
              className={cn(
                "min-h-12 rounded-2xl border px-3 text-sm font-semibold transition-premium",
                (profile?.trackingMode ?? "automatic") === "automatic"
                  ? "glass-brand border-primary/35 text-primary"
                  : "glass-subtle border-white/40 text-foreground/70",
              )}
            >
              Automatic
            </button>
            <button
              type="button"
              aria-pressed={profile?.trackingMode === "manual"}
              onClick={() => updateProfile({ trackingMode: "manual" })}
              className={cn(
                "min-h-12 rounded-2xl border px-3 text-sm font-semibold transition-premium",
                profile?.trackingMode === "manual"
                  ? "glass-brand border-primary/35 text-primary"
                  : "glass-subtle border-white/40 text-foreground/70",
              )}
            >
              Manual
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Current: <span className="font-semibold text-foreground">{profile?.trackingMode === "manual" ? "Manual" : "Automatic"}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="glass-emergency rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Siren className="h-5 w-5" aria-hidden />
            Emergency SOS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-white/85">
            Need help immediately? Use the emergency profile and contact flow.
          </p>
          <Button
            variant="destructive"
            className="w-full min-h-14 bg-white text-destructive hover:bg-white/90"
            onClick={() => setSosOpen(true)}
          >
            Open Emergency SOS
          </Button>
        </CardContent>
      </Card>

      {sosOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-sos-title"
        >
          <div className="w-full max-w-md rounded-3xl glass-elevated border-white/50 p-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-destructive">Emergency SOS</p>
              <h2 id="profile-sos-title" className="mt-2 text-2xl font-bold">Act during the Golden Hour.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This action uses your configured emergency contact and current location where the platform allows it.
              </p>
            </div>

            <div className="rounded-2xl border border-destructive/25 bg-background p-4 space-y-2">
              <p className="text-sm font-semibold">{profile?.emergencyContactName || "No emergency contact"}</p>
              <p className="text-sm text-muted-foreground">{profile?.emergencyContactPhone || "Add a contact in your emergency profile."}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="destructive"
                className="min-h-14 text-base font-bold"
                onClick={() => {
                  window.location.href = profile?.emergencyContactPhone ? `tel:${profile.emergencyContactPhone}` : "#";
                }}
                disabled={!profile?.emergencyContactPhone}
              >
                CALL EMERGENCY CONTACT
              </Button>
              <Button
                variant="outline"
                className="min-h-12"
                onClick={() => setSosOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          ACCOUNT
         ========================= */}
      <Card className="glass-secondary">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* AUTH RESTORING */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          )}

          {/* SIGNED OUT */}
          {!isLoading && !isAuthenticated && (
            <>
              <div className="text-sm text-muted-foreground">
                You're currently using WellMate without an account.
              </div>

              <div className="rounded-xl border border-border/60 p-4 space-y-2">
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

              <div className="rounded-xl border border-border/60 p-4 space-y-2">
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
        <Card className="glass-secondary">
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            <div
              className={cn(
                "text-sm",
                syncTone === "emerald" && "text-emerald-600",
                syncTone === "amber" && "text-amber-600",
                syncTone === "red" && "text-red-600",
                syncTone === "muted" && "text-muted-foreground",
              )}
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
      <DataOwnershipCard />

      {/* =========================
          AI & PRIVACY
         ========================= */}
      <AiPrivacyCard />

      {/* =========================
          NOTIFICATIONS
         ========================= */}
      <NotificationSettings />

      {/* =========================
          WHAT'S NEXT
         ========================= */}
      <button
        type="button"
        onClick={() => navigate("/roadmap")}
        className="w-full text-left"
      >
        <Card className="glass-secondary border-primary/25 hover:border-primary/40 hover:bg-primary/[0.04] transition-premium">
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
      <Card className="glass-subtle border-amber-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span>Health &amp; Safety</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Non-clinical, educational, and advisory platform. Please read the full Terms of Service and Privacy Policy.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setSafetySheetOpen(true)}
          >
            Read Terms &amp; Privacy Policy
          </Button>
        </CardContent>
      </Card>

      {/* Terms & Privacy bottom sheet */}
      <Sheet open={safetySheetOpen} onOpenChange={setSafetySheetOpen}>
        <SheetContent
          side="bottom"
          className="h-[90vh] flex flex-col rounded-t-2xl gap-0 overflow-hidden"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Terms &amp; Privacy Policy</SheetTitle>
            <SheetDescription>
              For Dr Anuradha Palta's consultancy.
            </SheetDescription>
          </SheetHeader>

          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 overflow-y-auto py-4 overscroll-contain">
              <PolicyContent />
              <div className="h-4" />
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </PageLayout>
  );
}
