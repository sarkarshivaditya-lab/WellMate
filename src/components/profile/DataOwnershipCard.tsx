// src/components/profile/DataOwnershipCard.tsx
// Privacy dashboard — export, storage transparency, and deletion transparency.
// Reinforces the "your data belongs to you" principle of WellMate's local-first architecture.

import React, { useState, useCallback } from "react";
import {
  Download,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportAsJSON, exportAsText } from "@/export/exportEngine";
import { getStorageBreakdown } from "@/export/exportSerializer";
import {
  clearDomain,
  clearAllWellnessData,
  DOMAIN_LABELS,
  type DeletableDomain,
} from "@/export/dataDeletion";

// ─── Storage breakdown ────────────────────────────────────────────────────────

const DOMAIN_ORDER: DeletableDomain[] = [
  "sleep", "exercise", "meals", "moods", "journal", "hydration", "habits",
];

const WHAT_WE_STORE_ITEMS = [
  { label: "Sleep logs", detail: "Start/end time, duration, quality rating, optional notes" },
  { label: "Exercise sessions", detail: "Date, activity type, duration, estimated calories, optional notes" },
  { label: "Meal logs", detail: "Food name, calories, protein, carbs, fat" },
  { label: "Mood entries", detail: "Date, mood level (1–5), optional note" },
  { label: "Journal entries", detail: "Date, title, text content" },
  { label: "Hydration logs", detail: "Date, cups consumed" },
  { label: "Habits", detail: "Habit name, cadence, completion history" },
  { label: "Wellness profile", detail: "Height, weight, activity level, wellness goal — set during onboarding. Always device-resident." },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StorageBreakdown() {
  const breakdown = getStorageBreakdown();
  const domainLabels: Record<DeletableDomain, string> = {
    sleep: "Sleep nights",
    exercise: "Exercise sessions",
    meals: "Meals",
    moods: "Mood entries",
    journal: "Journal entries",
    hydration: "Hydration logs",
    habits: "Active habits",
  };
  const extraLabels: Record<string, string> = {
    habitEntries: "Habit completions",
  };

  const allKeys: Array<[string, string]> = [
    ...DOMAIN_ORDER.map((d): [string, string] => [d, domainLabels[d]]),
    ...Object.entries(extraLabels),
  ];

  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "No wellness data stored yet."
          : `${total.toLocaleString()} total entries stored on this device.`}
      </p>
      <div role="list" aria-label="Storage breakdown by category" className="space-y-1">
        {allKeys.map(([key, label]) => {
          const count = breakdown[key] ?? 0;
          return (
            <div
              key={key}
              role="listitem"
              aria-label={`${label}: ${count}`}
              className="flex items-center justify-between text-xs py-0.5"
            >
              <span aria-hidden className="text-muted-foreground">{label}</span>
              <span aria-hidden className="font-medium tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatWeStoreSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="what-we-store-list"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between text-xs font-medium py-1",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded",
        )}
      >
        <span>What WellMate stores</span>
        {expanded
          ? <ChevronUp aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div id="what-we-store-list" className="mt-2 space-y-2">
          {WHAT_WE_STORE_ITEMS.map((item) => (
            <div key={item.label} className="text-[11px]">
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground leading-snug">{item.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/20">
            Nothing is shared with third parties. Signing in enables optional cloud backup — your data stays yours.
          </p>
        </div>
      )}
    </div>
  );
}

type DeleteConfirmState =
  | { type: "idle" }
  | { type: "confirm-domain"; domain: DeletableDomain }
  | { type: "confirm-all" };

function DeletionSection({ onDeleted }: { onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmState, setConfirmState] = useState<DeleteConfirmState>({ type: "idle" });

  const handleDomainDelete = useCallback((domain: DeletableDomain) => {
    clearDomain(domain);
    setConfirmState({ type: "idle" });
    onDeleted();
  }, [onDeleted]);

  const handleDeleteAll = useCallback(() => {
    clearAllWellnessData();
    setConfirmState({ type: "idle" });
    onDeleted();
  }, [onDeleted]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="deletion-section-body"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between text-xs font-medium py-1",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Trash2 aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          Clear data
        </span>
        {expanded
          ? <ChevronUp aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div id="deletion-section-body" className="mt-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Clear individual categories below. Your wellness profile (height, weight, goals) is never deleted here.
          </p>

          {/* Per-domain deletion */}
          <div role="list" aria-label="Clear data by category" className="space-y-1.5">
            {DOMAIN_ORDER.map((domain) => {
              const isConfirming =
                confirmState.type === "confirm-domain" && confirmState.domain === domain;
              return (
                <div
                  key={domain}
                  role="listitem"
                  className="flex items-center justify-between gap-2"
                >
                  <span aria-hidden className="text-xs text-muted-foreground flex-1">
                    {DOMAIN_LABELS[domain]}
                  </span>
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Confirm clearing ${DOMAIN_LABELS[domain]}`}
                        onClick={() => handleDomainDelete(domain)}
                        className={cn(
                          "text-[11px] font-medium text-red-600 px-2 py-1 rounded-lg",
                          "bg-red-50 dark:bg-red-950/30",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
                        )}
                      >
                        Yes, clear
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel"
                        onClick={() => setConfirmState({ type: "idle" })}
                        className={cn(
                          "text-[11px] text-muted-foreground px-2 py-1 rounded-lg",
                          "bg-muted/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Clear ${DOMAIN_LABELS[domain]}`}
                      onClick={() => setConfirmState({ type: "confirm-domain", domain })}
                      className={cn(
                        "text-[11px] text-muted-foreground hover:text-destructive",
                        "px-2 py-1 rounded-lg hover:bg-destructive/5",
                        "transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      )}
                    >
                      Clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Clear all */}
          <div className="border-t border-border/20 pt-3">
            {confirmState.type === "confirm-all" ? (
              <div className="rounded-xl border border-red-200/60 bg-red-50/60 dark:bg-red-950/20 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle aria-hidden className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-snug">
                    This will permanently delete all wellness logs from this device. Your profile (height, weight, goals) will be kept.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Confirm clearing all wellness data"
                    onClick={handleDeleteAll}
                    className={cn(
                      "flex-1 text-[11px] font-medium text-red-600 py-1.5 rounded-lg",
                      "bg-red-100/80 dark:bg-red-900/30",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
                    )}
                  >
                    Yes, clear everything
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel clearing all data"
                    onClick={() => setConfirmState({ type: "idle" })}
                    className={cn(
                      "flex-1 text-[11px] text-muted-foreground py-1.5 rounded-lg",
                      "bg-muted/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Clear all wellness data"
                onClick={() => setConfirmState({ type: "confirm-all" })}
                className={cn(
                  "w-full text-xs font-medium text-destructive py-2 rounded-xl",
                  "border border-destructive/20 hover:bg-destructive/5",
                  "transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40",
                )}
              >
                Clear all wellness data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type ExportState = "idle" | "exporting";

export function DataOwnershipCard() {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExport = useCallback((format: "json" | "text") => {
    setExportState("exporting");
    try {
      if (format === "json") exportAsJSON();
      else exportAsText();
    } finally {
      // brief visual confirmation
      setTimeout(() => setExportState("idle"), 1200);
    }
  }, []);

  const handleDeleted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-4 w-4 text-primary" />
          <span>Your Data</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Privacy statement */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Everything WellMate knows about you lives on this device.
          No wellness data is sent anywhere without your action.
        </p>

        {/* Storage breakdown */}
        <div className="rounded-xl border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Database aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Stored on this device</p>
          </div>
          <StorageBreakdown key={refreshKey} />
        </div>

        {/* What we store */}
        <WhatWeStoreSection />

        {/* Export */}
        <div className="space-y-2">
          <p className="text-xs font-medium">Export your data</p>
          <p className="text-[11px] text-muted-foreground">
            Download a complete copy anytime. No account required.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exportState === "exporting"}
              aria-label="Export data as JSON file"
              onClick={() => handleExport("json")}
              className="flex-1 gap-1.5 text-xs h-9"
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              {exportState === "exporting" ? "Exporting…" : "JSON"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportState === "exporting"}
              aria-label="Export data as readable text summary"
              onClick={() => handleExport("text")}
              className="flex-1 gap-1.5 text-xs h-9"
            >
              <FileText aria-hidden className="h-3.5 w-3.5" />
              {exportState === "exporting" ? "Exporting…" : "Text summary"}
            </Button>
          </div>
        </div>

        {/* Deletion */}
        <div className="border-t border-border/20 pt-2">
          <DeletionSection onDeleted={handleDeleted} />
        </div>
      </CardContent>
    </Card>
  );
}
