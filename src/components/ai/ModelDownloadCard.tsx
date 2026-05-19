// Model download UI — "Enable Offline Intelligence" flow.
// Premium, calm, intentional. Not developer-tool-like.
// Manages the full download lifecycle: check → download → store → ready.

import React from "react";
import { Brain, Download, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PHI3_MINI_MANIFEST,
} from "@/ai/providers/local/modelMetadata";
import {
  isModelStored,
  downloadAndStoreModel,
  subscribeToModelLoad,
  getModelLoadState,
} from "@/ai/providers/local/modelLoader";
import { cn } from "@/lib/utils";
import type { ModelLoadState } from "@/ai/providers/local/modelMetadata";

// Local UI state — cleaner than mapping ModelLoadState directly to UI
type CardPhase =
  | "checking"         // async initial check
  | "unavailable"      // no downloadUrl configured (coming soon)
  | "idle"             // file not stored, ready to download
  | "downloading"      // actively downloading
  | "stored"           // file in IndexedDB, ready for inference
  | "error";           // download failed

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export function ModelDownloadCard() {
  const [phase, setPhase] = React.useState<CardPhase>("checking");
  const [progressPct, setProgressPct] = React.useState(0);
  const [errorReason, setErrorReason] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // ── Initial stored-check ──────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    isModelStored(PHI3_MINI_MANIFEST)
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          setPhase("stored");
        } else if (!PHI3_MINI_MANIFEST.downloadUrl) {
          setPhase("unavailable");
        } else {
          setPhase("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setPhase("unavailable");
      });

    // Also sync with any in-progress download from another component
    const currentLoad = getModelLoadState();
    if (currentLoad.phase === "downloading") {
      const { progressBytes, totalBytes } = currentLoad as Extract<ModelLoadState, { phase: "downloading" }>;
      setPhase("downloading");
      setProgressPct(totalBytes > 0 ? Math.round((progressBytes / totalBytes) * 100) : 0);
    }

    return () => { cancelled = true; };
  }, []);

  // ── Live state subscription ───────────────────────────────────────────────
  React.useEffect(() => {
    return subscribeToModelLoad((state) => {
      if (state.phase === "downloading") {
        const { progressBytes, totalBytes } = state as Extract<ModelLoadState, { phase: "downloading" }>;
        setPhase("downloading");
        setProgressPct(totalBytes > 0 ? Math.round((progressBytes / totalBytes) * 100) : 0);
      } else if (state.phase === "verifying") {
        setProgressPct(100);
      } else if (state.phase === "not_loaded") {
        // "not_loaded" after verifying means the file was just stored
        isModelStored(PHI3_MINI_MANIFEST).then((stored) => {
          setPhase(stored ? "stored" : "idle");
        }).catch(() => setPhase("idle"));
      } else if (state.phase === "failed") {
        const { reason } = state as Extract<ModelLoadState, { phase: "failed" }>;
        setErrorReason(reason);
        setPhase("error");
      }
    });
  }, []);

  // ── Download handler ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!PHI3_MINI_MANIFEST.downloadUrl) return;

    setPhase("downloading");
    setProgressPct(0);
    setErrorReason(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await downloadAndStoreModel(PHI3_MINI_MANIFEST, controller.signal);
      setPhase("stored");
    } catch (err) {
      if (controller.signal.aborted) {
        setPhase("idle");
      } else {
        setErrorReason(err instanceof Error ? err.message : "Download failed");
        setPhase("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "checking") return null;

  if (phase === "stored") {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/4">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500/70 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground/70">
              Offline intelligence enabled
            </p>
            <p className="text-[11.5px] text-muted-foreground/55 mt-0.5">
              {PHI3_MINI_MANIFEST.name} · {formatBytes(PHI3_MINI_MANIFEST.sizeBytes)} stored on device
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "unavailable") {
    return (
      <Card className="border-border/25 bg-muted/10">
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-start gap-3">
            <Brain className="h-4 w-4 text-foreground/30 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/60">
                Offline intelligence — coming soon
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                On-device AI will run entirely on your phone without a network connection.
                No data leaves your device.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "downloading") {
    return (
      <Card className="border-primary/15 bg-primary/3">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/70">
                Downloading AI model
              </p>
              <p className="text-[11.5px] text-muted-foreground/50">
                {PHI3_MINI_MANIFEST.name} · {progressPct}%
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel download"
              className="flex-shrink-0 p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-border/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground/40">
            This download happens once and runs fully offline after.
            Keep this screen open.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="border-red-500/20 bg-red-500/3">
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-400/70 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/70">
                Download failed
              </p>
              {errorReason && (
                <p className="text-[11.5px] text-muted-foreground/50 leading-snug">
                  {errorReason}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-[12px] h-8"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // phase === "idle" — main download CTA
  return (
    <Card className={cn("border-border/35")}>
      <CardContent className="py-5 px-5 space-y-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-foreground/35 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-[13.5px] font-medium text-foreground/70">
              Enable offline intelligence
            </p>
            <p className="text-[12px] text-muted-foreground/55 leading-snug">
              Download {PHI3_MINI_MANIFEST.name} ({formatBytes(PHI3_MINI_MANIFEST.sizeBytes)})
              to your device. Runs fully offline — no data leaves your phone.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            size="sm"
            onClick={handleDownload}
            className={cn(
              "gap-2 text-[12.5px]",
              "bg-foreground/8 hover:bg-foreground/12 text-foreground/65",
              "border border-border/50",
            )}
            variant="outline"
          >
            <Download className="h-3.5 w-3.5" />
            Download model · {formatBytes(PHI3_MINI_MANIFEST.sizeBytes)}
          </Button>
          <p className="text-[10.5px] text-muted-foreground/35">
            Requires a Wi-Fi connection. Download once, use offline forever.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
