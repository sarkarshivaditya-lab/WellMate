// Model download UI — "Enable Offline Intelligence" flow.
// Premium, calm, intentional. Handles: not-downloaded, partial, downloading,
// stored, storage-full, and error states.

import React from "react";
import { Brain, Download, CheckCircle2, AlertCircle, X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PHI3_MINI_MANIFEST } from "@/ai/providers/local/modelMetadata";
import {
  isModelStored,
  getPartialDownloadBytes,
  downloadAndStoreModel,
  subscribeToModelLoad,
  getModelLoadState,
  deleteStoredModel,
} from "@/ai/providers/local/modelLoader";
import { checkStorageAvailability } from "@/ai/providers/local/modelStorage";
import { cn } from "@/lib/utils";
import type { ModelLoadState } from "@/ai/providers/local/modelMetadata";

type CardPhase =
  | "checking"
  | "unavailable"        // no downloadUrl
  | "storage_full"       // insufficient storage
  | "idle"               // not downloaded, ready to download
  | "resumable"          // partial download detected
  | "downloading"
  | "stored"
  | "error";

function formatGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function formatPct(received: number, total: number): string {
  return total > 0 ? `${Math.round((received / total) * 100)}%` : "0%";
}

export function ModelDownloadCard() {
  const [phase, setPhase] = React.useState<CardPhase>("checking");
  const [progressPct, setProgressPct] = React.useState(0);
  const [resumeBytes, setResumeBytes] = React.useState(0);
  const [errorReason, setErrorReason] = React.useState<string | null>(null);
  const [availableStorage, setAvailableStorage] = React.useState<number | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // ── Initial state probe ───────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (!PHI3_MINI_MANIFEST.downloadUrl) {
        if (!cancelled) setPhase("unavailable");
        return;
      }

      const [stored, partialBytes, storageCheck] = await Promise.all([
        isModelStored(PHI3_MINI_MANIFEST),
        getPartialDownloadBytes(PHI3_MINI_MANIFEST),
        checkStorageAvailability(PHI3_MINI_MANIFEST.sizeBytes),
      ]);

      if (cancelled) return;

      setAvailableStorage(storageCheck.availableBytes);

      if (stored) {
        setPhase("stored");
        return;
      }

      if (!storageCheck.available) {
        setPhase("storage_full");
        return;
      }

      if (partialBytes > 0 && partialBytes < PHI3_MINI_MANIFEST.sizeBytes) {
        setResumeBytes(partialBytes);
        setProgressPct(Math.round((partialBytes / PHI3_MINI_MANIFEST.sizeBytes) * 100));
        setPhase("resumable");
        return;
      }

      setPhase("idle");
    }

    // Also sync with any in-progress download
    const currentLoad = getModelLoadState();
    if (currentLoad.phase === "downloading") {
      const s = currentLoad as Extract<ModelLoadState, { phase: "downloading" }>;
      setProgressPct(s.totalBytes > 0 ? Math.round((s.progressBytes / s.totalBytes) * 100) : 0);
      setPhase("downloading");
    } else {
      probe().catch(() => { if (!cancelled) setPhase("unavailable"); });
    }

    return () => { cancelled = true; };
  }, []);

  // ── Live load-state subscription ─────────────────────────────────────────
  React.useEffect(() => {
    return subscribeToModelLoad((state) => {
      if (state.phase === "downloading") {
        const s = state as Extract<ModelLoadState, { phase: "downloading" }>;
        setPhase("downloading");
        setProgressPct(
          s.totalBytes > 0 ? Math.round((s.progressBytes / s.totalBytes) * 100) : 0,
        );
      } else if (state.phase === "verifying") {
        setProgressPct(100);
      } else if (state.phase === "not_loaded") {
        isModelStored(PHI3_MINI_MANIFEST)
          .then((stored) => setPhase(stored ? "stored" : "idle"))
          .catch(() => setPhase("idle"));
      } else if (state.phase === "failed") {
        const s = state as Extract<ModelLoadState, { phase: "failed" }>;
        setErrorReason(s.reason);
        setPhase("error");
      }
    });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
        setPhase(resumeBytes > 0 ? "resumable" : "idle");
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

  async function handleDelete() {
    await deleteStoredModel(PHI3_MINI_MANIFEST);
    setPhase("idle");
    setProgressPct(0);
    setResumeBytes(0);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "checking") return null;

  if (phase === "stored") {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/4">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500/60 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground/70">
              Offline intelligence enabled
            </p>
            <p className="text-[11.5px] text-muted-foreground/55 mt-0.5">
              {PHI3_MINI_MANIFEST.name} · {formatGB(PHI3_MINI_MANIFEST.sizeBytes)} · stored on device
            </p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Remove model"
            className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "unavailable") {
    return (
      <Card className="border-border/20 bg-muted/8">
        <CardContent className="py-5 px-5">
          <div className="flex items-start gap-3">
            <Brain className="h-4 w-4 text-foreground/25 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13.5px] font-medium text-foreground/55">
                Offline intelligence — coming soon
              </p>
              <p className="text-[12px] text-muted-foreground/45 leading-snug">
                On-device AI that runs without a network connection is on the roadmap.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "storage_full") {
    const available = availableStorage ?? 0;
    return (
      <Card className="border-amber-500/20 bg-amber-500/3">
        <CardContent className="py-5 px-5 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500/60 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Not enough storage
              </p>
              <p className="text-[12px] text-muted-foreground/55 leading-snug">
                {formatGB(PHI3_MINI_MANIFEST.sizeBytes)} required
                {available > 0 ? ` · ${formatGB(available)} available` : ""}.
                Free up space and try again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "downloading") {
    return (
      <Card className="border-primary/12 bg-primary/3">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/70">
                Downloading AI model
              </p>
              <p className="text-[11.5px] text-muted-foreground/50">
                {PHI3_MINI_MANIFEST.name} · {progressPct}% of {formatGB(PHI3_MINI_MANIFEST.sizeBytes)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Pause download"
              className="flex-shrink-0 p-1 rounded-lg text-muted-foreground/35 hover:text-muted-foreground/65 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-1 w-full bg-border/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/40 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-[10.5px] text-muted-foreground/35">
            Keep this page open. You can pause and resume — progress is saved.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="border-red-500/18 bg-red-500/3">
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-400/60 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/65">
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
            className="text-[12px] h-8 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── resumable — partial download exists ───────────────────────────────────
  if (phase === "resumable") {
    const pct = PHI3_MINI_MANIFEST.sizeBytes > 0
      ? Math.round((resumeBytes / PHI3_MINI_MANIFEST.sizeBytes) * 100)
      : 0;
    return (
      <Card className="border-border/35">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start gap-3">
            <Brain className="h-4 w-4 text-foreground/30 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Resume offline intelligence
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                {pct}% already downloaded ({formatGB(resumeBytes)} of {formatGB(PHI3_MINI_MANIFEST.sizeBytes)})
              </p>
            </div>
          </div>

          <div className="h-0.5 w-full bg-border/25 rounded-full">
            <div
              className="h-full bg-foreground/20 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>

          <Button
            size="sm"
            onClick={handleDownload}
            variant="outline"
            className="gap-1.5 text-[12.5px]"
          >
            <Download className="h-3.5 w-3.5" />
            Resume download
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── idle — ready to download ──────────────────────────────────────────────
  return (
    <Card className="border-border/35">
      <CardContent className="py-5 px-5 space-y-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-foreground/30 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-[13.5px] font-medium text-foreground/65">
              Enable offline intelligence
            </p>
            <p className="text-[12px] text-muted-foreground/50 leading-snug">
              Download {PHI3_MINI_MANIFEST.name} ({formatGB(PHI3_MINI_MANIFEST.sizeBytes)}) to your device.
              Runs fully offline — no data ever leaves your phone.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            size="sm"
            onClick={handleDownload}
            variant="outline"
            className={cn("gap-2 text-[12.5px]")}
          >
            <Download className="h-3.5 w-3.5" />
            Download · {formatGB(PHI3_MINI_MANIFEST.sizeBytes)}
          </Button>
          <p className="text-[10.5px] text-muted-foreground/35">
            Recommended on Wi-Fi. Progress saves automatically — pause any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
