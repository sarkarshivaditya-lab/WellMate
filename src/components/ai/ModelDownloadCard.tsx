// Model download UI — "Enable Offline Intelligence" flow.
// Premium, calm, intentional. Handles: not-downloaded, partial, downloading,
// stored, activating, active, storage-full, and error states.

import React from "react";
import { Sparkles, Brain, CheckCircle2, AlertCircle, X, RefreshCw, Zap } from "lucide-react";
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
import { tryActivateLocalProvider } from "@/ai/orchestration/orchestrator";
import { useAIRuntime } from "@/ai/hooks/useAIRuntime";
import { cn } from "@/lib/utils";
import type { ModelLoadState } from "@/ai/providers/local/modelMetadata";

type CardPhase =
  | "checking"
  | "unavailable"        // no downloadUrl
  | "storage_full"       // insufficient storage
  | "idle"               // not downloaded, ready to download
  | "resumable"          // partial download detected
  | "downloading"
  | "stored"             // downloaded, not yet loaded into memory
  | "activating"         // loading model into WASM runtime
  | "active"             // model loaded and running
  | "error";

function formatGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}


export function ModelDownloadCard() {
  const [phase, setPhase] = React.useState<CardPhase>("checking");
  const [progressPct, setProgressPct] = React.useState(0);
  const [resumeBytes, setResumeBytes] = React.useState(0);
  const [errorReason, setErrorReason] = React.useState<string | null>(null);
  const [availableStorage, setAvailableStorage] = React.useState<number | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const runtime = useAIRuntime();

  // Sync with runtime — if local provider becomes active externally, reflect it
  React.useEffect(() => {
    if (runtime.provider === "local" && runtime.modelLoad === "ready") {
      setPhase("active");
    }
  }, [runtime.provider, runtime.modelLoad]);

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

  async function handleActivate() {
    setPhase("activating");
    try {
      const ok = await tryActivateLocalProvider(PHI3_MINI_MANIFEST);
      setPhase(ok ? "active" : "stored");
      if (!ok) setErrorReason("Model failed to load — try again or restart the app");
    } catch (err) {
      setPhase("stored");
      setErrorReason(err instanceof Error ? err.message : "Failed to load model");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "checking") return null;

  // ── Active — companion running ────────────────────────────────────────────
  if (phase === "active") {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/4">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <Zap className="h-3.5 w-3.5 text-emerald-500/55 flex-shrink-0" />
          <p className="flex-1 text-[13px] font-medium text-foreground/70">
            Offline support active
          </p>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Remove offline support"
            className="text-muted-foreground/25 hover:text-muted-foreground/55 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </CardContent>
      </Card>
    );
  }

  // ── Activating — loading into runtime ────────────────────────────────────
  if (phase === "activating") {
    return (
      <Card className="border-border/20">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <Brain className="h-3.5 w-3.5 text-foreground/25 flex-shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground/65">
              Getting ready…
            </p>
            <p className="text-[11.5px] text-muted-foreground/40 mt-0.5">
              This takes about a minute.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Stored — downloaded, awaiting activation ──────────────────────────────
  if (phase === "stored") {
    return (
      <Card className="border-border/25">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Offline support ready
              </p>
              <p className="text-[12px] text-muted-foreground/45 leading-snug">
                Your wellness companion is saved to this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Remove offline support"
              className="flex-shrink-0 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors mt-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {errorReason && (
            <p className="text-[11.5px] text-red-400/60">
              Something went wrong. Please try again.
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleActivate}
            className="gap-1.5 text-[12.5px]"
          >
            <Zap className="h-3.5 w-3.5" />
            Turn On
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Unavailable — no download URL configured ──────────────────────────────
  if (phase === "unavailable") {
    return (
      <Card className="border-border/15 bg-muted/6">
        <CardContent className="py-5 px-5">
          <div className="space-y-1">
            <p className="text-[13.5px] font-medium text-foreground/50">
              Offline support — coming soon
            </p>
            <p className="text-[12px] text-muted-foreground/40 leading-snug">
              Personalised support without an internet connection is in the works.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Storage full ──────────────────────────────────────────────────────────
  if (phase === "storage_full") {
    const available = availableStorage ?? 0;
    return (
      <Card className="border-amber-500/18 bg-amber-500/3">
        <CardContent className="py-5 px-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-500/55 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Not enough space
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                {available > 0
                  ? `${formatGB(available)} available — free up a bit more space to continue.`
                  : "Free up some space on your device and try again."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Downloading ───────────────────────────────────────────────────────────
  if (phase === "downloading") {
    return (
      <Card className="border-border/20">
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-foreground/65">
              Enabling offline support
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11.5px] text-muted-foreground/40 tabular-nums">
                {progressPct}%
              </span>
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Pause"
                className="text-muted-foreground/25 hover:text-muted-foreground/55 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="h-0.5 w-full bg-border/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground/20 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <Card className="border-border/20">
        <CardContent className="py-5 px-5 space-y-3">
          <p className="text-[13.5px] font-medium text-foreground/60">
            Something went wrong
          </p>
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

  // ── Resumable — partial download saved ────────────────────────────────────
  if (phase === "resumable") {
    const pct = PHI3_MINI_MANIFEST.sizeBytes > 0
      ? Math.round((resumeBytes / PHI3_MINI_MANIFEST.sizeBytes) * 100)
      : 0;
    return (
      <Card className="border-border/25">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[13.5px] font-medium text-foreground/65">
              Continue setup
            </p>
            <p className="text-[12px] text-muted-foreground/45 leading-snug">
              {pct > 0 ? `${pct}% complete — ` : ""}Pick up right where you left off.
            </p>
          </div>

          <div className="h-0.5 w-full bg-border/20 rounded-full">
            <div
              className="h-full bg-foreground/20 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>

          <Button
            size="sm"
            onClick={handleDownload}
            variant="outline"
            className="text-[12.5px]"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Idle — ready to set up ────────────────────────────────────────────────
  return (
    <Card className="border-border/25">
      <CardContent className="py-5 px-5 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-foreground/25 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-[13.5px] font-medium text-foreground/65">
              Your companion, everywhere
            </p>
            <p className="text-[12px] text-muted-foreground/50 leading-snug">
              Thoughtful reflections and support — available offline, fully private,
              running directly on your device.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            size="sm"
            onClick={handleDownload}
            variant="outline"
            className={cn("text-[12.5px]")}
          >
            Enable Offline Support
          </Button>
          <p className="text-[10.5px] text-muted-foreground/30">
            {formatGB(PHI3_MINI_MANIFEST.sizeBytes)} · Best on Wi-Fi · Resumes if interrupted
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
