// src/components/NotificationSettings.tsx

import { useState, useCallback, useEffect } from "react";
import { Bell, Moon, ChevronRight, BellOff, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  setCategoryEnabled,
} from "@/notifications/preferences";
import { isInQuietHours } from "@/notifications/quietHours";
import type { NotificationCategory, NotificationPreferences, QuietWindow } from "@/notifications/types";

/* --------------------------------------------------
   CATEGORY METADATA
   -------------------------------------------------- */

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  wellness_critical:  { label: "Wellness Alerts",       description: "Important alerts that need your attention" },
  streak_support:     { label: "Streak Reminders",      description: "Gentle nudge when your streak is at risk" },
  habit_support:      { label: "Habit Reminders",       description: "Reminders for habits with a set time" },
  sleep_support:      { label: "Sleep Reminders",       description: "Sleep hygiene nudges" },
  gentle_checkin:     { label: "Daily Check-ins",       description: "Evening prompt if nothing logged today" },
  hydration_support:  { label: "Hydration",             description: "Gentle hydration reminders" },
  recovery_prompt:    { label: "Re-engagement",         description: "Warm nudge after time away" },
  journal_reflection: { label: "Journal Prompts",       description: "Prompts to reflect and write" },
  passive_insight:    { label: "Wellness Insights",     description: "Low-pressure informational insights" },
  onboarding_nudge:   { label: "Setup Reminders",       description: "Reminders to finish your profile" },
};

// Sensitivity presets — each maps to a daily cap
const SENSITIVITY_OPTIONS: { value: "low" | "normal" | "high"; label: string; cap: number }[] = [
  { value: "low",    label: "Less",   cap: 2  },
  { value: "normal", label: "Normal", cap: 5  },
  { value: "high",   label: "More",   cap: 10 },
];

/* --------------------------------------------------
   TIME HELPERS
   -------------------------------------------------- */

function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function fromTimeString(str: string): { hour: number; minute: number } {
  const [h, m] = str.split(":").map(Number);
  return { hour: isNaN(h) ? 0 : h, minute: isNaN(m) ? 0 : m };
}

function formatWindowLabel(w: QuietWindow): string {
  const fmt = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  return `${fmt(w.startHour, w.startMinute)} – ${fmt(w.endHour, w.endMinute)}`;
}

/* --------------------------------------------------
   SETTINGS SHEET — all controls in one scrollable pane
   -------------------------------------------------- */

function NotificationSettingsSheet({
  open,
  onOpenChange,
  prefs,
  onPrefsChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: NotificationPreferences;
  onPrefsChange: (p: NotificationPreferences) => void;
}) {
  const sleepWindow = prefs.quietWindows.find((w) => w.label === "sleep") ?? null;
  const quietEnabled = sleepWindow !== null;

  const handleQuietToggle = (checked: boolean) => {
    const next = checked
      ? [
          ...prefs.quietWindows.filter((w) => w.label !== "sleep"),
          { startHour: 22, startMinute: 0, endHour: 8, endMinute: 0, label: "sleep" as const },
        ]
      : prefs.quietWindows.filter((w) => w.label !== "sleep");
    const updated = { ...prefs, quietWindows: next };
    onPrefsChange(updated);
    patchNotificationPreferences({ quietWindows: next });
  };

  const handleStartChange = (val: string) => {
    const { hour, minute } = fromTimeString(val);
    const next = prefs.quietWindows.map((w) =>
      w.label === "sleep" ? { ...w, startHour: hour, startMinute: minute } : w,
    );
    const updated = { ...prefs, quietWindows: next };
    onPrefsChange(updated);
    patchNotificationPreferences({ quietWindows: next });
  };

  const handleEndChange = (val: string) => {
    const { hour, minute } = fromTimeString(val);
    const next = prefs.quietWindows.map((w) =>
      w.label === "sleep" ? { ...w, endHour: hour, endMinute: minute } : w,
    );
    const updated = { ...prefs, quietWindows: next };
    onPrefsChange(updated);
    patchNotificationPreferences({ quietWindows: next });
  };

  const handleSensitivity = (val: "low" | "normal" | "high") => {
    const cap = SENSITIVITY_OPTIONS.find((o) => o.value === val)?.cap ?? 5;
    const updated = { ...prefs, sensitivityLevel: val, dailyCap: cap };
    onPrefsChange(updated);
    patchNotificationPreferences({ sensitivityLevel: val, dailyCap: cap });
  };

  const handleCategoryToggle = (cat: NotificationCategory, checked: boolean) => {
    setCategoryEnabled(cat, checked);
    const set = new Set(prefs.enabledCategories);
    if (checked) set.add(cat);
    else set.delete(cat);
    onPrefsChange({ ...prefs, enabledCategories: [...set] });
  };

  const enabledCount = prefs.enabledCategories.length;
  const totalCount = Object.keys(CATEGORY_META).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] flex flex-col rounded-t-2xl">
        <SheetHeader className="flex-shrink-0 pb-2">
          <SheetTitle>Notification Settings</SheetTitle>
          <SheetDescription>
            Calm, respectful reminders — always on your terms.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-6">

          {/* ── QUIET HOURS ── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
              Quiet Hours
            </p>

            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">Sleep window</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Silence all notifications during sleep
                  </p>
                </div>
                <Switch checked={quietEnabled} onCheckedChange={handleQuietToggle} />
              </div>

              {quietEnabled && sleepWindow && (
                <div className="px-4 py-3.5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">From</p>
                      <input
                        type="time"
                        value={toTimeString(sleepWindow.startHour, sleepWindow.startMinute)}
                        onChange={(e) => handleStartChange(e.target.value)}
                        className="w-full bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">To</p>
                      <input
                        type="time"
                        value={toTimeString(sleepWindow.endHour, sleepWindow.endMinute)}
                        onChange={(e) => handleEndChange(e.target.value)}
                        className="w-full bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Notifications during this window stay queued and are shown when the window ends.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── FREQUENCY ── */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
              Frequency
            </p>

            <div className="rounded-xl border border-border/60 px-4 py-3.5 space-y-3">
              <div>
                <p className="text-sm font-medium">Reminder frequency</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How often WellMate can nudge you per day
                </p>
              </div>

              <div className="flex gap-2">
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSensitivity(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      prefs.sensitivityLevel === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border/60 hover:border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {prefs.sensitivityLevel === "low"
                  ? "Up to 2 reminders per day. Maximum calm."
                  : prefs.sensitivityLevel === "high"
                  ? "Up to 10 reminders per day. You stay fully aware."
                  : "Up to 5 reminders per day. A balanced default."}
              </p>
            </div>
          </section>

          {/* ── REMINDER TYPES ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Reminder Types
              </p>
              <p className="text-[10px] text-muted-foreground">
                {enabledCount} of {totalCount} on
              </p>
            </div>

            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              {(Object.entries(CATEGORY_META) as [NotificationCategory, { label: string; description: string }][]).map(
                ([cat, meta]) => (
                  <div key={cat} className="flex items-center justify-between px-4 py-3.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                    <Switch
                      checked={prefs.enabledCategories.includes(cat)}
                      onCheckedChange={(v) => handleCategoryToggle(cat, v)}
                    />
                  </div>
                ),
              )}
            </div>

            <p className="text-[11px] text-muted-foreground px-0.5">
              Disabled types are silently dropped. No pressure to keep everything on.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* --------------------------------------------------
   NOTIFICATION SETTINGS CARD — renders in Profile
   -------------------------------------------------- */

type BrowserPermission = "granted" | "denied" | "default" | "unavailable";

function getBrowserPermission(): BrowserPermission {
  if (typeof Notification === "undefined") return "unavailable";
  return Notification.permission;
}

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    () => getNotificationPreferences(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermission>(
    getBrowserPermission,
  );

  // Re-check permission on focus (user may have changed it in browser settings)
  useEffect(() => {
    const onFocus = () => setBrowserPermission(getBrowserPermission());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const inQuiet = isInQuietHours(prefs);

  const handleMasterToggle = useCallback((checked: boolean) => {
    patchNotificationPreferences({ enabled: checked });
    setPrefs((p) => ({ ...p, enabled: checked }));
  }, []);

  const sleepWindow = prefs.quietWindows.find((w) => w.label === "sleep");
  const quietLabel = sleepWindow ? formatWindowLabel(sleepWindow) : "Off";
  const freqLabel = SENSITIVITY_OPTIONS.find((o) => o.value === prefs.sensitivityLevel)?.label ?? "Normal";
  const enabledCount = prefs.enabledCategories.length;
  const totalCount = Object.keys(CATEGORY_META).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {prefs.enabled
                ? <Bell className="h-4 w-4 text-muted-foreground" />
                : <BellOff className="h-4 w-4 text-muted-foreground" />
              }
              <CardTitle>Notifications</CardTitle>
            </div>
            <Switch checked={prefs.enabled} onCheckedChange={handleMasterToggle} />
          </div>

          <CardDescription>
            {prefs.enabled
              ? "Calm reminders from your wellness companion"
              : "Notifications are paused"}
          </CardDescription>
        </CardHeader>

        {/* Browser permission denied — shown when OS/browser has blocked notifications */}
        {browserPermission === "denied" && (
          <CardContent className="pt-0 pb-4 px-6">
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Notifications are blocked</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Your browser is preventing WellMate from sending reminders. To change this, open your browser or device settings and allow notifications for this site.
                </p>
              </div>
            </div>
          </CardContent>
        )}

        {prefs.enabled && (
          <CardContent className="p-0">
            <Separator className="mb-0" />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-b-xl"
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Quiet {quietLabel}
                  {inQuiet && (
                    <span className="ml-2 text-amber-500/80">· active now</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {freqLabel} frequency · {enabledCount}/{totalCount} types on
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </CardContent>
        )}
      </Card>

      <NotificationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        prefs={prefs}
        onPrefsChange={setPrefs}
      />
    </>
  );
}
