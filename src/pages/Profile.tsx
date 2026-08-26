import { useEffect, useMemo, useState } from "react";
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
import { ChevronRight, ShieldAlert, Sparkles, Plus, Trash2 } from "lucide-react";
import { PolicyContent } from "@/components/PolicyContent";
import NotificationSettings from "@/components/NotificationSettings";
import { DataOwnershipCard } from "@/components/profile/DataOwnershipCard";
import { HealthProfileSection } from "@/components/profile/HealthProfileSection";
import { AiPrivacyCard } from "@/components/profile/AiPrivacyCard";
import { readOnboardingPayload, type EmergencyContactPayload } from "@/data/local/onboardingPayload";

const PROFILE_STORAGE_KEY = "onboarding_profile";

function readCanonicalProfile(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function saveCanonicalProfile(patch: Record<string, unknown>): boolean {
  try {
    const current = readCanonicalProfile() ?? {};
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
    return true;
  } catch {
    return false;
  }
}

function makeContact(): EmergencyContactPayload {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    phone: "",
  };
}

function EmergencyProfileEditor() {
  const initial = useMemo(() => {
    const payload = readOnboardingPayload();
    const canonical = readCanonicalProfile();
    const contacts = (canonical?.emergencyContacts ?? payload?.emergencyContacts) as EmergencyContactPayload[] | undefined;
    return {
      bloodType: String(canonical?.bloodType ?? payload?.bloodType ?? ""),
      allergies: Array.isArray(canonical?.allergies)
        ? (canonical?.allergies as string[]).join(", ")
        : Array.isArray(payload?.allergies)
          ? payload.allergies.join(", ")
          : "",
      contacts: contacts?.length ? contacts.map((contact) => ({ ...contact })) : [makeContact()],
    };
  }, []);

  const [bloodType, setBloodType] = useState(initial.bloodType);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [contacts, setContacts] = useState<EmergencyContactPayload[]>(initial.contacts);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  const valid =
    bloodType.trim().length > 0 &&
    contacts.length > 0 &&
    contacts.every((contact) => contact.name.trim().length > 0 && contact.phone.trim().length >= 7);

  const updateContact = (id: string, patch: Partial<EmergencyContactPayload>) => {
    setContacts((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const save = () => {
    if (!valid) {
      setStatus("error");
      return;
    }

    const ok = saveCanonicalProfile({
      bloodType: bloodType.trim(),
      allergies: allergies.split(",").map((value) => value.trim()).filter(Boolean),
      emergencyContacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
      })),
    });

    setStatus(ok ? "saved" : "error");
  };

  return (
    <Card className="border-primary/15">
      <CardHeader>
        <CardTitle>Emergency Profile</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Stored in the same local profile that powers onboarding. Used only when the emergency workflow requires it.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="profile-blood-type">Blood type</label>
          <select
            id="profile-blood-type"
            value={bloodType}
            onChange={(event) => setBloodType(event.target.value)}
            className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"].map((value) => (
              <option key={value} value={value}>{value || "Select"}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="profile-allergies">Allergies</label>
          <input
            id="profile-allergies"
            value={allergies}
            onChange={(event) => setAllergies(event.target.value)}
            placeholder="e.g. peanuts, penicillin"
            className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Emergency contacts</p>
              <p className="mt-1 text-xs text-muted-foreground">Keep at least one complete contact.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setContacts((items) => [...items, makeContact()])}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {contacts.map((contact) => (
            <div key={contact.id} className="rounded-2xl border border-border p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={contact.name} onChange={(event) => updateContact(contact.id, { name: event.target.value })} placeholder="Name" className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
                <input value={contact.phone} onChange={(event) => updateContact(contact.id, { phone: event.target.value })} placeholder="Phone" type="tel" className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
              </div>
              {contacts.length > 1 && (
                <button type="button" onClick={() => setContacts((items) => items.filter((item) => item.id !== contact.id))} className="inline-flex items-center gap-1.5 text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {status === "error" && <p className="text-xs text-destructive">Enter a blood type and at least one complete emergency contact.</p>}
        {status === "saved" && <p className="text-xs text-emerald-600">Emergency profile updated.</p>}

        <Button type="button" onClick={save} disabled={!valid} className="w-full">Save emergency profile</Button>
      </CardContent>
    </Card>
  );
}

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

  let pendingCount = 0;
  let errorCount = 0;

  try {
    const exercises = getAllLocalExercises();
    pendingCount += exercises.filter((e) => e.syncStatus === "pending").length;
    errorCount += exercises.filter((e) => e.syncStatus === "error").length;
  } catch {
    // best effort only
  }

  try {
    pendingCount += getPendingMeals().length;
  } catch {
    // best effort only
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
        <HealthProfileSection />
        <EmergencyProfileEditor />

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading && <div className="space-y-3"><Skeleton className="h-4 w-48 rounded-md" /><Skeleton className="h-10 w-full rounded-xl" /></div>}
            {!isLoading && !isAuthenticated && (
              <>
                <div className="text-sm text-muted-foreground">You're currently using WellMate without an account.</div>
                <div className="rounded-xl border border-border/60 p-4 space-y-2"><div className="text-sm font-medium">Sign in to enable sync &amp; backup</div><div className="text-xs text-muted-foreground">Signing in lets you back up your data and access it on other devices. Your app works fully offline even without signing in.</div></div>
                <Button className="w-full" onClick={() => loginWithRedirect()}>Sign in</Button>
              </>
            )}
            {!isLoading && isAuthenticated && (
              <>
                <div className="text-sm text-muted-foreground">You're signed in{user?.email ? ` as ${user.email}` : ""}.</div>
                <div className="rounded-xl border border-border/60 p-4 space-y-2"><div className="text-sm font-medium">Account connected</div><div className="text-xs text-muted-foreground">Your data can now be securely synced and backed up.</div></div>
                <Button className="w-full" variant="secondary" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Sign out</Button>
                <p className="text-[11px] text-muted-foreground text-center">Signing out will not delete any local data on this device.</p>
              </>
            )}
          </CardContent>
        </Card>

        {isAuthenticated && !isLoading && (
          <Card>
            <CardHeader><CardTitle>Sync Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className={cn("text-sm", syncTone === "emerald" && "text-emerald-600", syncTone === "amber" && "text-amber-600", syncTone === "red" && "text-red-600", syncTone === "muted" && "text-muted-foreground")}>{syncLabel}</div>
              <div className="text-xs text-muted-foreground">Sync runs automatically when you're online and signed in.</div>
            </CardContent>
          </Card>
        )}

        <DataOwnershipCard />
        <AiPrivacyCard />
        <NotificationSettings />

        <button type="button" onClick={() => navigate("/roadmap")} className="w-full text-left">
          <Card className="border-primary/20 hover:border-primary/40 hover:bg-primary/[0.02] transition-premium"><CardContent className="pt-4 pb-4 flex items-center justify-between gap-3"><div className="space-y-0.5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">What's Next</p></div><p className="text-xs text-muted-foreground pl-6">Roadmap, vision, and future integrations</p></div><ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" /></CardContent></Card>
        </button>

        <Card className="border-amber-200/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-600" /><span>Health &amp; Safety</span></CardTitle></CardHeader>
          <CardContent className="space-y-3"><p className="text-xs text-muted-foreground">Non-clinical, educational, and advisory platform. Please read the full Terms of Service and Privacy Policy.</p><Button variant="outline" size="sm" className="w-full" onClick={() => setSafetySheetOpen(true)}>Read Terms &amp; Privacy Policy</Button></CardContent>
        </Card>

        <Sheet open={safetySheetOpen} onOpenChange={setSafetySheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] flex flex-col rounded-t-2xl gap-0 overflow-hidden">
            <SheetHeader className="flex-shrink-0 pb-3"><SheetTitle>Terms &amp; Privacy Policy</SheetTitle><SheetDescription>For Dr Anuradha Palta's consultancy.</SheetDescription></SheetHeader>
            <div className="relative flex-1 min-h-0"><div className="absolute inset-0 overflow-y-auto py-4 overscroll-contain"><PolicyContent /><div className="h-4" /></div><div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" /></div>
          </SheetContent>
        </Sheet>
      </div>
    </PageLayout>
  );
}
