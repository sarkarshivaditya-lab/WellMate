// Offline Intelligence setup card.
// Driven by modelLifecycle.ts — invisible once installed and current.
// Handles all Phase 9 states: install, update, upgrade required, migration,
// emergency disable, Wi-Fi advisory, and error/recovery flows.

import React from "react";
import { Sparkles, Brain, AlertCircle, X, RefreshCw, ArrowUp, WifiOff, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRecommendedManifest } from "@/ai/models/modelRegistry";
import {
  checkLifecycleState,
  subscribeToLifecycle,
  deleteCorruptedModel,
  type InstallState,
} from "@/ai/models/modelLifecycle";
import { evaluateModelUpdate } from "@/ai/models/modelUpdateService";
import {
  performMigration,
  subscribeToMigration,
  type MigrationState,
} from "@/ai/models/migrationEngine";
import {
  downloadAndStoreModel,
  getPartialDownloadBytes,
  subscribeToModelLoad,
  getModelLoadState,
  deleteStoredModel,
} from "@/ai/providers/local/modelLoader";
import { checkStorageAvailability } from "@/ai/providers/local/modelStorage";
import { checkDownloadEligibility } from "@/ai/downloads/downloadManager";
import { tryActivateLocalProvider } from "@/ai/orchestration/orchestrator";
import { useAIRuntime } from "@/ai/hooks/useAIRuntime";
import type { ModelManifest, ModelLoadState } from "@/ai/providers/local/modelMetadata";

type CardPhase =
  | "checking"
  | "installed"          // fully hidden — card returns null
  | "install_idle"       // no model, ready to install
  | "install_resumable"  // partial download saved
  | "downloading"        // download in progress
  | "migrating"          // upgrade in progress (staged migration)
  | "activating"         // loading model into WASM runtime
  | "update_available"   // opt-in upgrade exists
  | "update_required"    // installed model deprecated — must upgrade
  | "corrupted"          // file failed integrity check
  | "storage_full"       // insufficient storage
  | "unavailable"        // no download URL / incompatible device
  | "emergency_disabled" // server kill switch
  | "wifi_advisory"      // not on Wi-Fi, user must confirm
  | "error";

function formatGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export function ModelDownloadCard() {
  const manifest = getRecommendedManifest();
  const [phase, setPhase] = React.useState<CardPhase>("checking");
  const [lifecycleState, setLifecycleState] = React.useState<InstallState>("checking");
  const [progressPct, setProgressPct] = React.useState(0);
  const [resumeBytes, setResumeBytes] = React.useState(0);
  const [errorReason, setErrorReason] = React.useState<string | null>(null);
  const [availableStorage, setAvailableStorage] = React.useState<number | null>(null);
  const [serverReason, setServerReason] = React.useState<string | null>(null);
  const [updateTarget, setUpdateTarget] = React.useState<ModelManifest | null>(null);
  const [wifiConfirmPending, setWifiConfirmPending] = React.useState(false);
  const [migrationStage, setMigrationStage] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const runtime = useAIRuntime();

  // ── Lifecycle subscription ────────────────────────────────────────────────
  React.useEffect(() => {
    return subscribeToLifecycle((state: InstallState) => {
      setLifecycleState(state);
      if (state === "installed") {
        if (runtime.provider !== "local" || runtime.modelLoad !== "ready") {
          void tryActivateLocalProvider(manifest).catch(() => null);
        }
      }
    });
  }, [manifest, runtime.provider, runtime.modelLoad]);

  // ── Migration progress subscription ──────────────────────────────────────
  React.useEffect(() => {
    return subscribeToMigration((state: MigrationState) => {
      if (state.stage === "downloading" || state.stage === "validating" ||
          state.stage === "checkpointing" || state.stage === "switching" ||
          state.stage === "committing") {
        setPhase("migrating");
        setProgressPct(state.progressPct);
        setMigrationStage(state.stage);
      } else if (state.stage === "complete") {
        void handleAutoActivate(updateTarget ?? manifest);
      } else if (state.stage === "failed") {
        setErrorReason(state.error ?? "Migration failed");
        setPhase("error");
      }
    });
  }, [manifest, updateTarget]);

  // ── Initial state probe ───────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    async function probe() {
      const lifecycle = await checkLifecycleState();
      if (cancelled) return;

      setLifecycleState(lifecycle);

      if (lifecycle === "installed") return; // card hides

      if (lifecycle === "emergency_disabled") {
        const evaluation = await evaluateModelUpdate();
        setServerReason(evaluation.reason);
        setPhase("emergency_disabled");
        return;
      }

      if (lifecycle === "update_required") {
        const evaluation = await evaluateModelUpdate();
        setUpdateTarget(evaluation.targetManifest);
        setPhase("update_required");
        return;
      }

      if (lifecycle === "update_available") {
        const evaluation = await evaluateModelUpdate();
        setUpdateTarget(evaluation.targetManifest);
        setPhase("update_available");
        return;
      }

      if (lifecycle === "corrupted") {
        setPhase("corrupted");
        return;
      }

      if (lifecycle === "incompatible") {
        setPhase("unavailable");
        return;
      }

      // install_available / none — probe download state
      if (!manifest.downloadUrl) {
        setPhase("unavailable");
        return;
      }

      const [partialBytes, storageCheck] = await Promise.all([
        getPartialDownloadBytes(manifest),
        checkStorageAvailability(manifest.sizeBytes),
      ]);

      if (cancelled) return;
      setAvailableStorage(storageCheck.availableBytes);

      if (!storageCheck.available) {
        setPhase("storage_full");
        return;
      }

      if (partialBytes > 0 && partialBytes < manifest.sizeBytes) {
        setResumeBytes(partialBytes);
        setProgressPct(Math.round((partialBytes / manifest.sizeBytes) * 100));
        setPhase("install_resumable");
        return;
      }

      setPhase("install_idle");
    }

    // Sync with any in-progress download
    const currentLoad = getModelLoadState();
    if (currentLoad.phase === "downloading") {
      const s = currentLoad as Extract<ModelLoadState, { phase: "downloading" }>;
      setProgressPct(s.totalBytes > 0 ? Math.round((s.progressBytes / s.totalBytes) * 100) : 0);
      setPhase("downloading");
    } else {
      probe().catch(() => { if (!cancelled) setPhase("unavailable"); });
    }

    return () => { cancelled = true; };
  }, [manifest]);

  // ── Live load-state subscription ─────────────────────────────────────────
  React.useEffect(() => {
    return subscribeToModelLoad((state) => {
      if (state.phase === "downloading") {
        const s = state as Extract<ModelLoadState, { phase: "downloading" }>;
        setPhase("downloading");
        setProgressPct(s.totalBytes > 0 ? Math.round((s.progressBytes / s.totalBytes) * 100) : 0);
      } else if (state.phase === "verifying") {
        setProgressPct(99);
      } else if (state.phase === "not_loaded") {
        void handleAutoActivate(manifest);
      } else if (state.phase === "failed") {
        const s = state as Extract<ModelLoadState, { phase: "failed" }>;
        setErrorReason(s.reason);
        setPhase("error");
      }
    });
  }, [manifest]);

  // ── Auto-activate after download ─────────────────────────────────────────
  async function handleAutoActivate(target: ModelManifest) {
    setPhase("activating");
    try {
      const ok = await tryActivateLocalProvider(target);
      if (ok) {
        const state = await checkLifecycleState();
        setLifecycleState(state);
      } else {
        setPhase("install_idle");
      }
    } catch {
      setPhase("install_idle");
    }
  }

  // ── Download eligibility gate ─────────────────────────────────────────────
  async function requestDownload(targetManifest: ModelManifest) {
    const eligibility = await checkDownloadEligibility(targetManifest.sizeBytes);

    if (!eligibility.eligible) {
      // Battery too low — show error
      setErrorReason("Battery is too low to start a large download. Connect a charger and try again.");
      setPhase("error");
      return;
    }

    if (eligibility.constraint === "wifi_recommended" && !wifiConfirmPending) {
      setWifiConfirmPending(true);
      setPhase("wifi_advisory");
      return;
    }

    setWifiConfirmPending(false);
    startDownload(targetManifest);
  }

  function startDownload(targetManifest: ModelManifest) {
    setPhase("downloading");
    setProgressPct(0);
    setErrorReason(null);

    const controller = new AbortController();
    abortRef.current = controller;

    downloadAndStoreModel(targetManifest, controller.signal).catch((err) => {
      if (controller.signal.aborted) {
        setPhase(resumeBytes > 0 ? "install_resumable" : "install_idle");
      } else {
        setErrorReason(err instanceof Error ? err.message : "Download failed");
        setPhase("error");
      }
      abortRef.current = null;
    });
  }

  async function startMigration(targetManifest: ModelManifest) {
    setPhase("migrating");
    setProgressPct(0);
    setErrorReason(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await performMigration(targetManifest, { signal: controller.signal });
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrorReason(err instanceof Error ? err.message : "Upgrade failed");
        setPhase("error");
      } else {
        setPhase("update_available");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  async function handleDelete() {
    await deleteStoredModel(manifest);
    setPhase("install_idle");
    setProgressPct(0);
    setResumeBytes(0);
    const state = await checkLifecycleState();
    setLifecycleState(state);
  }

  async function handleRepairCorrupted() {
    await deleteCorruptedModel();
    setPhase("install_idle");
    setErrorReason(null);
    const state = await checkLifecycleState();
    setLifecycleState(state);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Invisible: probing or healthy+current
  if (phase === "checking" || phase === "installed" || lifecycleState === "installed") {
    return null;
  }

  // ── Emergency disabled ─────────────────────────────────────────────────────
  if (phase === "emergency_disabled") {
    return (
      <Card className="border-border/15 bg-muted/5">
        <CardContent className="py-5 px-5">
          <div className="space-y-1">
            <p className="text-[13.5px] font-medium text-foreground/50">
              Offline support temporarily unavailable
            </p>
            <p className="text-[12px] text-muted-foreground/40 leading-snug">
              {serverReason ?? "This feature is temporarily paused. It will return soon."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Activating ────────────────────────────────────────────────────────────
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

  // ── Downloading ───────────────────────────────────────────────────────────
  if (phase === "downloading" || phase === "migrating") {
    const label = phase === "migrating"
      ? migrationLabel(migrationStage)
      : "Enabling offline support";

    return (
      <Card className="border-border/20">
        <CardContent className="py-5 px-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-foreground/65">{label}</p>
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

  // ── Wi-Fi advisory — not on Wi-Fi for large download ─────────────────────
  if (phase === "wifi_advisory") {
    const target = updateTarget ?? manifest;
    return (
      <Card className="border-amber-500/18 bg-amber-500/3">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start gap-3">
            <WifiOff className="h-4 w-4 text-amber-500/60 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Wi-Fi recommended
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                This is a {formatGB(target.sizeBytes)} download. Continue on mobile data?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setWifiConfirmPending(true); startDownload(target); }}
              className="text-[12px]"
            >
              Continue anyway
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPhase("install_idle")}
              className="text-[12px] text-muted-foreground/60"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Update required — deprecated model ────────────────────────────────────
  if (phase === "update_required") {
    const target = updateTarget ?? manifest;
    return (
      <Card className="border-amber-500/18 bg-amber-500/3">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500/60 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/70">
                Update required
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                Your offline companion needs a quick update to keep working.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              size="sm"
              onClick={() => requestDownload(target).then(() => {
                if (phase !== "wifi_advisory") startMigration(target);
              })}
              className="text-[12.5px]"
            >
              Update now
            </Button>
            <p className="text-[10.5px] text-muted-foreground/30">
              {formatGB(target.sizeBytes)} · Your data is preserved
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Update available — optional upgrade ───────────────────────────────────
  if (phase === "update_available") {
    const target = updateTarget ?? manifest;
    return (
      <Card className="border-border/25">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-start gap-3">
            <ArrowUp className="h-4 w-4 text-foreground/30 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[13.5px] font-medium text-foreground/65">
                Improved companion available
              </p>
              <p className="text-[12px] text-muted-foreground/50 leading-snug">
                A newer version is ready. Your existing data stays intact.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => startMigration(target)}
              className="text-[12.5px]"
            >
              Update
            </Button>
            <p className="text-[10.5px] text-muted-foreground/30">
              {formatGB(target.sizeBytes)} · Best on Wi-Fi
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Corrupted — file damaged ───────────────────────────────────────────────
  if (phase === "corrupted") {
    return (
      <Card className="border-border/20">
        <CardContent className="py-5 px-5 space-y-3">
          <p className="text-[13.5px] font-medium text-foreground/60">File needs repair</p>
          <p className="text-[12px] text-muted-foreground/45 leading-snug">
            The offline file is damaged. Removing it lets you download a fresh copy.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRepairCorrupted}
            className="text-[12px] h-8 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Remove and retry
          </Button>
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
              <p className="text-[13.5px] font-medium text-foreground/65">Not enough space</p>
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
            onClick={() => { setPhase("install_idle"); setErrorReason(null); }}
            className="text-[12px] h-8 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Resumable ─────────────────────────────────────────────────────────────
  if (phase === "install_resumable") {
    const pct = manifest.sizeBytes > 0
      ? Math.round((resumeBytes / manifest.sizeBytes) * 100)
      : 0;
    return (
      <Card className="border-border/25">
        <CardContent className="py-5 px-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[13.5px] font-medium text-foreground/65">Continue setup</p>
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
            onClick={() => requestDownload(manifest)}
            variant="outline"
            className="text-[12.5px]"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Unavailable ────────────────────────────────────────────────────────────
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

  // ── Idle — ready to install ───────────────────────────────────────────────
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
            onClick={() => requestDownload(manifest)}
            variant="outline"
            className="text-[12.5px]"
          >
            Enable Offline Support
          </Button>
          <p className="text-[10.5px] text-muted-foreground/30">
            {formatGB(manifest.sizeBytes)} · Best on Wi-Fi · Resumes if interrupted
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function migrationLabel(stage: string | null): string {
  switch (stage) {
    case "validating": return "Verifying update…";
    case "checkpointing":
    case "switching": return "Applying update…";
    case "committing": return "Finishing up…";
    default: return "Updating your companion";
  }
}
