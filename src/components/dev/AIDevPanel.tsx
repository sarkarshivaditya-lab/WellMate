// AI Runtime Developer Panel — /dev route only, tree-shaken from production.
// Tests inference, retrieval, embeddings, thermal state, and cancellation.

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAIRuntime } from "@/ai/hooks/useAIRuntime";
import { useStreamingInference } from "@/ai/hooks/useStreamingInference";
import { getActiveProviderInfo } from "@/ai/orchestration/orchestrator";
import { getMemoryStats, getRecentTurns, appendTurn } from "@/ai/memory/runtimeMemory";
import { getEmbeddingModelState } from "@/ai/embeddings/embeddingPipeline";
import { getVectorStoreStats } from "@/ai/embeddings/vectorStore";
import { retrievalBridge } from "@/ai/retrieval/retrievalBridge";
import { getBridgeStatus } from "@/ai/providers/local/llamaBridge";
import {
  getLongitudinalSummary,
  generateLongitudinalSummary,
  isSummaryStale,
} from "@/ai/memory/longitudinalSummary";
import {
  subscribeToPerformance,
  getPerformanceSnapshot,
  estimateModelRamMB,
} from "@/ai/runtime/performanceMonitor";
import { getThermalState, getInferenceRate, resetThermal } from "@/ai/runtime/thermalGuard";
import { validateModelIntegrity } from "@/ai/providers/local/modelLoader";
import { getRecommendedManifest } from "@/ai/models/modelRegistry";
import { getManifestResult, getReleaseChannel, setReleaseChannel, getRolloutSeed, type ReleaseChannel as ReleaseChannelType } from "@/ai/models/remoteManifest";
import { getDeviceProfile, type DeviceProfile } from "@/ai/platform/deviceProfile";
import { evaluateModelUpdate, type UpdateEvaluation } from "@/ai/models/modelUpdateService";
import { getStorageInventory, evictInactiveModels, type StorageInventory } from "@/ai/storage/storageAccountant";
import { getMigrationHistory } from "@/ai/models/migrationEngine";
import { getCapabilitiesSync, detectCapabilities, type RuntimeCapabilities } from "@/ai/platform/capabilityClassifier";
import { getDetailedSnapshot, subscribeToProfile, type DetailedSnapshot } from "@/ai/runtime/performanceProfiler";
import { getCurrentPolicy, subscribeToPolicy, type RuntimePolicy } from "@/ai/runtime/runtimeGovernor";
import { getThermalIncidents, getFailureEvents, getDailyRecords, getHistoryStorageBytes, clearAllHistory } from "@/ai/runtime/performanceHistory";
import { runBenchmarkSuite, getBenchmarkHistory, subscribeToProgress, type BenchmarkSuite } from "@/ai/runtime/benchmarkEngine";
import { filterOutput } from "@/ai/safety/outputFilter";
import { evaluatePresence, clearPresenceSuppression } from "@/ai/presence/presenceRules";
import {
  getStoredReflection,
  isReflectionStale,
  clearReflection,
} from "@/ai/reflection/reflectionStore";
import { generateDailyReflection } from "@/ai/reflection/reflectionEngine";
import { serializeSummaryForPrompt } from "@/ai/memory/longitudinalSummary";
import { cn } from "@/lib/utils";
import {
  getWorkerHealth,
  subscribeToWorkerHealth,
  spawnWorker,
  restartWorker,
  cleanupOrphanedWorkers,
  type WorkerHealthReport,
} from "@/ai/workers/workerOrchestrator";
import { getLifecycleState, subscribeToLifecycle, type AppLifecycleState } from "@/ai/runtime/appLifecycle";
import { getCognitionProfile, subscribeToCognitionProfile, type CognitionProfile } from "@/ai/cognition/cognitionScaler";
import { getBatteryScheduleState, getBatteryScheduleStateSync, type BatteryScheduleState } from "@/ai/runtime/batteryScheduler";
import {
  getAllSubsystemHealth,
  getFaultLog,
  resetSubsystem,
  resetAllSubsystems,
  subscribeToFaults,
  type SubsystemHealth,
  type SubsystemId,
} from "@/ai/runtime/faultContainment";
import {
  runStressSuite,
  getStressHistory,
  subscribeToStressProgress,
  ALL_STRESS_SCENARIOS,
  type StressScenarioId,
  type StressScenarioResult,
  type StressProgress,
} from "@/ai/runtime/stressSuite";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full",
        ok ? "bg-emerald-500/12 text-emerald-700" : "bg-red-500/12 text-red-600",
      )}
    >
      {label}
    </span>
  );
}

// ── Runtime status panel ──────────────────────────────────────────────────────

function RuntimeStatusCard() {
  const state = useAIRuntime();
  const [embState, setEmbState] = React.useState(getEmbeddingModelState);
  const [vsStats, setVsStats] = React.useState<{ totalEntries: number; byScope: Record<string, number> } | null>(null);
  const bridgeStatus = getBridgeStatus();
  const providerInfo = getActiveProviderInfo();

  React.useEffect(() => {
    import("@/ai/embeddings/embeddingPipeline").then(({ subscribeToEmbeddingState }) => {
      return subscribeToEmbeddingState(setEmbState);
    });
  }, []);

  React.useEffect(() => {
    getVectorStoreStats().then(setVsStats).catch(() => null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">AI Runtime Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-muted-foreground">Runtime status</p>
            <StatusBadge ok={state.status === "ready"} label={state.status} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Active provider</p>
            <StatusBadge ok={state.provider !== "stub"} label={state.provider} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Thermal</p>
            <StatusBadge ok={state.thermal === "nominal"} label={state.thermal} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Queue depth</p>
            <span className="text-foreground font-mono">{state.queueDepth}</span>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Model load</p>
            <StatusBadge ok={state.modelLoad === "ready"} label={state.modelLoad} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Offline AI</p>
            <StatusBadge ok={state.offlineCapable} label={state.offlineCapable ? "yes" : "no"} />
          </div>
        </div>

        {state.lastError && (
          <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {state.lastError}
          </p>
        )}

        <div className="border-t border-border/30 pt-3 space-y-1">
          <p className="text-muted-foreground font-medium">llama.cpp bridge</p>
          <p className="text-foreground/70">
            env: <span className="font-mono">{bridgeStatus.env}</span>
            {bridgeStatus.env === "none" && (
              <span className="text-muted-foreground/60"> — {bridgeStatus.reason}</span>
            )}
          </p>
        </div>

        <div className="border-t border-border/30 pt-3 space-y-1">
          <p className="text-muted-foreground font-medium">Embedding model</p>
          <p className="text-foreground/70">status: <span className="font-mono">{embState.status}</span></p>
          {embState.status === "ready" && (
            <p className="text-foreground/50 text-[11px]">{(embState as { status: "ready"; modelId: string }).modelId}</p>
          )}
        </div>

        <div className="border-t border-border/30 pt-3 space-y-1">
          <p className="text-muted-foreground font-medium">Vector store</p>
          <p className="text-foreground/70">
            {vsStats ? `${vsStats.totalEntries} entries` : "loading..."}
          </p>
          {vsStats && Object.entries(vsStats.byScope).map(([scope, count]) => (
            <p key={scope} className="text-[11px] text-muted-foreground/60 pl-2">
              {scope}: {count}
            </p>
          ))}
        </div>

        <div className="border-t border-border/30 pt-3 space-y-1">
          <p className="text-muted-foreground font-medium">Provider</p>
          {providerInfo ? (
            <p className="text-foreground/70 font-mono text-[11px]">
              {providerInfo.type} / {providerInfo.modelId} / {providerInfo.ready ? "ready" : "not ready"}
            </p>
          ) : (
            <p className="text-muted-foreground/60">no active provider</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Streaming inference test panel ────────────────────────────────────────────

function InferenceTestCard() {
  const { status, streamedText, run, cancel, reset } = useStreamingInference();
  const [prompt, setPrompt] = React.useState("What wellness patterns do you notice?");
  const [includeContext, setIncludeContext] = React.useState(false);
  const [maxTokens, setMaxTokens] = React.useState(256);
  const [temperature, setTemperature] = React.useState(0.7);
  const outputRef = React.useRef<HTMLDivElement>(null);

  const isRunning = status.phase === "queued" || status.phase === "running";

  // Auto-scroll as tokens arrive
  React.useEffect(() => {
    if (outputRef.current && isRunning) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamedText, isRunning]);

  async function handleRun() {
    reset();
    let systemContext: string | undefined;

    if (includeContext) {
      const { assembleInferenceContext } = await import("@/ai/orchestration/contextAssembler");
      const assembled = assembleInferenceContext(null);
      systemContext = assembled.systemPrompt;
    }

    const result = await run({ prompt, systemContext, maxTokens, temperature });
    if (result) {
      appendTurn("user", prompt);
      appendTurn("assistant", result.text);
    }
  }

  const displayText = isRunning ? streamedText : (
    status.phase === "complete" ? status.result.text : streamedText
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Streaming Inference Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          className="w-full h-20 text-[12px] bg-muted/30 border border-border/30 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/25"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt..."
        />

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-muted-foreground">Include wellness context</span>
          </label>
          <div className="space-y-1">
            <p className="text-muted-foreground">Max tokens: {maxTokens}</p>
            <input
              type="range" min={64} max={512} step={64}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Temperature: {temperature.toFixed(1)}</p>
            <input
              type="range" min={0} max={1} step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning || !prompt.trim()}
            className="flex-1"
          >
            {isRunning ? "Generating…" : "Run"}
          </Button>
          {isRunning && (
            <Button size="sm" variant="outline" onClick={cancel}>
              Stop
            </Button>
          )}
          {(status.phase === "complete" || status.phase === "cancelled" || status.phase === "failed") && (
            <Button size="sm" variant="outline" onClick={reset} className="text-[11px]">
              Clear
            </Button>
          )}
        </div>

        {(displayText || isRunning) && (
          <div
            ref={outputRef}
            className="bg-muted/25 rounded-xl p-3 max-h-48 overflow-y-auto"
          >
            <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {displayText}
              {isRunning && <span className="inline-block w-1 h-3 bg-primary/50 ml-0.5 animate-pulse align-middle" />}
            </p>
          </div>
        )}

        {status.phase === "complete" && (
          <div className="text-[10px] text-muted-foreground/60 flex gap-3">
            <span>{status.result.tokensGenerated} tokens</span>
            <span>{status.result.durationMs}ms</span>
            <span>{(status.result.tokensGenerated / (status.result.durationMs / 1000)).toFixed(1)} tok/s</span>
            <span>via {status.result.provider}</span>
          </div>
        )}

        {status.phase === "failed" && (
          <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {status.error}
          </p>
        )}

        {status.phase === "cancelled" && (
          <p className="text-[11px] text-muted-foreground/60">Stopped.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Structured test workflows ─────────────────────────────────────────────────

type TestId = "minimal" | "journal" | "weekly" | "thermal";

type TestResult = {
  ok: boolean;
  detail: string;
  durationMs: number;
};

const STRUCTURED_TESTS: { id: TestId; label: string; description: string }[] = [
  {
    id: "minimal",
    label: "Minimal inference",
    description: "One-sentence prompt. Validates the inference pipeline end-to-end with zero context.",
  },
  {
    id: "journal",
    label: "Journal reflection",
    description: "Retrieves journal chunks and asks for a grounded reflection. Tests RAG pipeline.",
  },
  {
    id: "weekly",
    label: "Weekly insight",
    description: "Injects longitudinal weekly summary into system prompt. Tests grounded prompting.",
  },
  {
    id: "thermal",
    label: "Thermal stress (5×)",
    description: "Fires 5 rapid inferences sequentially. Validates thermal guard doesn't crash.",
  },
];

function StructuredTestsCard() {
  const [results, setResults] = React.useState<Partial<Record<TestId, TestResult>>>({});
  const [running, setRunning] = React.useState<TestId | null>(null);

  async function runTest(id: TestId) {
    setRunning(id);
    const start = Date.now();

    try {
      const { submitInference } = await import("@/ai/orchestration/orchestrator");

      if (id === "minimal") {
        const controller = new AbortController();
        const r = await submitInference({
          id: crypto.randomUUID(),
          prompt: "Reply with one word: OK",
          maxTokens: 16,
          temperature: 0.1,
          priority: "high",
          controller,
        });
        setResults((prev) => ({
          ...prev,
          minimal: {
            ok: r.text.length > 0,
            detail: `"${r.text.slice(0, 60)}" · ${r.tokensGenerated} tok · via ${r.provider}`,
            durationMs: Date.now() - start,
          },
        }));
      }

      if (id === "journal") {
        const { retrievalBridge } = await import("@/ai/retrieval/retrievalBridge");
        const retrieved = await retrievalBridge.query({
          text: "recent emotions and reflections",
          scope: ["journal_entries"],
          topK: 3,
          minScore: 0.1,
        });
        const context = retrieved.chunks.length > 0
          ? `Recent journal entries:\n${retrieved.chunks.map((c) => c.content).join("\n\n")}`
          : "No journal entries indexed yet.";

        const controller = new AbortController();
        const r = await submitInference({
          id: crypto.randomUUID(),
          prompt: "Based on these journal entries, what patterns do you notice? Keep it to 2 sentences.",
          systemContext: context,
          maxTokens: 128,
          temperature: 0.6,
          priority: "normal",
          controller,
        });
        setResults((prev) => ({
          ...prev,
          journal: {
            ok: r.text.length > 0,
            detail: `${retrieved.chunks.length} chunks retrieved · "${r.text.slice(0, 80)}…"`,
            durationMs: Date.now() - start,
          },
        }));
      }

      if (id === "weekly") {
        const { serializeSummaryForPrompt, getLongitudinalSummary, generateLongitudinalSummary } = await import("@/ai/memory/longitudinalSummary");
        let summary = getLongitudinalSummary();
        if (!summary) summary = generateLongitudinalSummary();
        const summaryText = serializeSummaryForPrompt();
        const controller = new AbortController();
        const r = await submitInference({
          id: crypto.randomUUID(),
          prompt: "Based on this week's patterns, what's one thing worth reflecting on?",
          systemContext: `You are a supportive wellness companion.\n\n${summaryText}`,
          maxTokens: 128,
          temperature: 0.65,
          priority: "normal",
          controller,
        });
        setResults((prev) => ({
          ...prev,
          weekly: {
            ok: r.text.length > 0 && !!summary,
            detail: `summary ${summary ? "present" : "missing"} · "${r.text.slice(0, 80)}…"`,
            durationMs: Date.now() - start,
          },
        }));
      }

      if (id === "thermal") {
        let failures = 0;
        for (let i = 0; i < 5; i++) {
          try {
            const controller = new AbortController();
            await submitInference({
              id: crypto.randomUUID(),
              prompt: `Reply with the number ${i + 1}.`,
              maxTokens: 8,
              temperature: 0.1,
              priority: "normal",
              controller,
            });
          } catch {
            failures++;
          }
        }
        const { getThermalState } = await import("@/ai/runtime/thermalGuard");
        const thermal = getThermalState();
        setResults((prev) => ({
          ...prev,
          thermal: {
            ok: failures === 0,
            detail: `5 inferences · ${failures} failures · thermal: ${thermal}`,
            durationMs: Date.now() - start,
          },
        }));
      }
    } catch (err) {
      const id2 = id;
      setResults((prev) => ({
        ...prev,
        [id2]: {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        },
      }));
    }

    setRunning(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Structured Test Workflows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {STRUCTURED_TESTS.map((test) => {
          const result = results[test.id];
          const isRunning = running === test.id;
          return (
            <div
              key={test.id}
              className="border border-border/20 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-foreground/75">{test.label}</p>
                  <p className="text-[11px] text-muted-foreground/55 leading-snug mt-0.5">
                    {test.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runTest(test.id)}
                  disabled={running !== null}
                  className="flex-shrink-0 text-[11px] h-7 px-2.5"
                >
                  {isRunning ? "Running…" : "Run"}
                </Button>
              </div>

              {result && (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-[11px]",
                    result.ok
                      ? "bg-emerald-500/8 text-emerald-700"
                      : "bg-red-500/8 text-red-600",
                  )}
                >
                  <span className="font-semibold mr-1.5">{result.ok ? "PASS" : "FAIL"}</span>
                  <span className="text-muted-foreground">{result.durationMs}ms</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="text-foreground/65">{result.detail}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Retrieval test panel ──────────────────────────────────────────────────────

function RetrievalTestCard() {
  const [query, setQuery] = React.useState("sleep patterns");
  const [result, setResult] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleQuery() {
    setLoading(true);
    setResult(null);
    try {
      const res = await retrievalBridge.query({
        text: query,
        scope: ["all"],
        topK: 5,
        minScore: 0.2,
      });
      if (res.chunks.length === 0) {
        setResult("No results. Embedding model may still be loading or index is empty.");
      } else {
        setResult(
          res.chunks
            .map((c, i) => `[${i + 1}] (${c.score.toFixed(3)}) ${c.content}`)
            .join("\n\n"),
        );
      }
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Retrieval Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            className="flex-1 text-[12px] bg-muted/30 border border-border/30 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/25"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="semantic search query..."
          />
          <Button size="sm" onClick={handleQuery} disabled={loading}>
            {loading ? "..." : "Query"}
          </Button>
        </div>

        {result && (
          <pre className="text-[11px] text-foreground/70 bg-muted/20 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

// ── Session memory panel ──────────────────────────────────────────────────────

function SessionMemoryCard() {
  const [stats, setStats] = React.useState(getMemoryStats());
  const [turns, setTurns] = React.useState(getRecentTurns(6));

  function refresh() {
    setStats(getMemoryStats());
    setTurns(getRecentTurns(6));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Session Memory</CardTitle>
        <Button size="sm" variant="outline" onClick={refresh} className="text-[11px] h-7 px-2">
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="flex gap-4">
          <p className="text-muted-foreground">Turns: <span className="text-foreground">{stats.turns}</span></p>
          <p className="text-muted-foreground">Tokens: ~<span className="text-foreground">{stats.tokens}</span></p>
        </div>
        {turns.length === 0 ? (
          <p className="text-muted-foreground/60 text-[11px]">No turns yet. Run inference to populate.</p>
        ) : (
          <div className="space-y-2">
            {turns.map((t) => (
              <div key={t.id} className="text-[11px]">
                <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[9px]">
                  {t.role}
                </span>
                <p className="text-foreground/70 leading-snug">{t.content.slice(0, 120)}{t.content.length > 120 ? "…" : ""}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Performance metrics panel ─────────────────────────────────────────────────

function PerformanceMetricsCard() {
  const [metrics, setMetrics] = React.useState(getPerformanceSnapshot);
  const [thermal, setThermal] = React.useState(getThermalState);
  const [inferenceRate, setInferenceRate] = React.useState(getInferenceRate);

  React.useEffect(() => {
    const unsub = subscribeToPerformance(setMetrics);
    const interval = setInterval(() => {
      setThermal(getThermalState());
      setInferenceRate(getInferenceRate());
    }, 3_000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const thermalColor =
    thermal === "critical" ? "text-red-500" :
    thermal === "hot" ? "text-amber-500" :
    thermal === "warm" ? "text-yellow-500" :
    "text-emerald-500";

  const ramEstimate = estimateModelRamMB(getRecommendedManifest().sizeBytes, 2048);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Inference Performance</CardTitle>
        <Button
          size="sm" variant="outline"
          onClick={() => resetThermal()}
          className="text-[10px] h-6 px-2"
        >
          Reset thermal
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Speed (last)</p>
            <p className="font-mono text-foreground">
              {metrics.tokensPerSec > 0 ? `${metrics.tokensPerSec} tok/s` : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Speed (peak)</p>
            <p className="font-mono text-foreground">
              {metrics.peakTokPerSec > 0 ? `${metrics.peakTokPerSec} tok/s` : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Avg latency</p>
            <p className="font-mono text-foreground">
              {metrics.avgInferenceMs > 0 ? `${metrics.avgInferenceMs}ms` : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Model load</p>
            <p className="font-mono text-foreground">
              {metrics.lastLoadDurationMs > 0 ? `${(metrics.lastLoadDurationMs / 1000).toFixed(1)}s` : "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Inferences</p>
            <p className="font-mono text-foreground">{metrics.inferenceCount}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Rate (per min)</p>
            <p className="font-mono text-foreground">{inferenceRate}</p>
          </div>
        </div>
        <div className="border-t border-border/25 pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">Thermal</p>
            <span className={cn("font-semibold text-[11px] uppercase", thermalColor)}>
              {thermal}
            </span>
          </div>
          <p className="text-[10.5px] text-muted-foreground/50">
            RAM estimate: ~{ramEstimate.toLocaleString()} MB
            <span className="ml-2 text-muted-foreground/35">(weights + KV cache + runtime)</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Runtime governor panel (Phase 10) ────────────────────────────────────────

function RuntimeGovernorCard() {
  const [caps, setCaps] = React.useState<RuntimeCapabilities | null>(getCapabilitiesSync);
  const [policy, setPolicy] = React.useState<RuntimePolicy>(() => getCurrentPolicy());
  const [profilerSnap, setProfilerSnap] = React.useState<DetailedSnapshot | null>(null);
  const [detecting, setDetecting] = React.useState(false);

  React.useEffect(() => {
    const unsubPolicy = subscribeToPolicy(setPolicy);
    const unsubProfile = subscribeToProfile((snap) => setProfilerSnap(snap));
    setProfilerSnap(getDetailedSnapshot());
    return () => { unsubPolicy(); unsubProfile(); };
  }, []);

  async function handleDetect() {
    setDetecting(true);
    const c = await detectCapabilities({ refresh: true });
    setCaps(c);
    setDetecting(false);
  }

  const modeColor =
    policy.mode === "suspended" ? "text-red-500" :
    policy.mode === "minimal" ? "text-red-400" :
    policy.mode === "conservative" ? "text-amber-500" :
    policy.mode === "efficient" ? "text-yellow-500" :
    "text-emerald-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Runtime Governor</CardTitle>
        <Button
          size="sm" variant="outline"
          onClick={handleDetect}
          disabled={detecting}
          className="text-[10px] h-6 px-2"
        >
          {detecting ? "Detecting…" : "Re-detect"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Capability class */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Device Classification
          </p>
          {caps ? (
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Class</p>
                <p className="font-mono text-foreground/80 font-semibold">{caps.capabilityClass}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">RAM</p>
                <p className="font-mono text-foreground/70">{caps.estimatedRamGB != null ? `${caps.estimatedRamGB} GB` : "unknown"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">CPU cores</p>
                <p className="font-mono text-foreground/70">{caps.hardwareConcurrency}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">WASM SIMD</p>
                <StatusBadge ok={caps.hasWasmSimd} label={caps.hasWasmSimd ? "yes" : "no"} />
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">WASM threads</p>
                <StatusBadge ok={caps.hasWasmThreads} label={caps.hasWasmThreads ? "yes" : "no"} />
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Background tasks</p>
                <StatusBadge ok={caps.params.backgroundTasksAllowed} label={caps.params.backgroundTasksAllowed ? "allowed" : "blocked"} />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground/50 text-[11px]">Not yet classified. Press Re-detect.</p>
          )}
        </div>

        {/* Active policy */}
        <div className="space-y-1.5 border-t border-border/15 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Active Policy
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("font-mono font-semibold uppercase text-[11px]", modeColor)}>
              {policy.mode}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-foreground/55 text-[11px]">{policy.reason}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Max context</p>
              <p className="font-mono text-foreground/70">{policy.maxContextTokens} tok</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Max generation</p>
              <p className="font-mono text-foreground/70">{policy.maxGenerationTokens} tok</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Retrieval depth</p>
              <p className="font-mono text-foreground/70">{policy.retrievalDepth}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Stream throttle</p>
              <p className="font-mono text-foreground/70">
                {policy.streamingThrottleMs > 0 ? `${policy.streamingThrottleMs}ms` : "none"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Heavy cognition</p>
              <StatusBadge ok={!policy.deferHeavyCognition} label={policy.deferHeavyCognition ? "deferred" : "allowed"} />
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Background</p>
              <StatusBadge ok={policy.allowBackgroundTasks} label={policy.allowBackgroundTasks ? "yes" : "no"} />
            </div>
          </div>
        </div>

        {/* Profiler snapshot */}
        {profilerSnap && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Profiler Snapshot
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Avg tok/s</p>
                <p className="font-mono text-foreground/70">
                  {profilerSnap.avgTokPerSec > 0 ? profilerSnap.avgTokPerSec.toFixed(1) : "—"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Peak tok/s</p>
                <p className="font-mono text-foreground/70">
                  {profilerSnap.peakTokPerSec > 0 ? profilerSnap.peakTokPerSec.toFixed(1) : "—"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">p50 latency</p>
                <p className="font-mono text-foreground/70">
                  {profilerSnap.p50LatencyMs > 0 ? `${profilerSnap.p50LatencyMs}ms` : "—"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">p90 latency</p>
                <p className="font-mono text-foreground/70">
                  {profilerSnap.p90LatencyMs > 0 ? `${profilerSnap.p90LatencyMs}ms` : "—"}
                </p>
              </div>
              {profilerSnap.memoryPressure && (
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Heap pressure</p>
                  <p className={cn(
                    "font-mono text-[11px]",
                    profilerSnap.memoryPressure.level === "high" ? "text-red-500" :
                    profilerSnap.memoryPressure.level === "moderate" ? "text-amber-500" :
                    "text-emerald-600",
                  )}>
                    {profilerSnap.memoryPressure.level} ({(profilerSnap.memoryPressure.ratio * 100).toFixed(0)}%)
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Sample count</p>
                <p className="font-mono text-foreground/70">{profilerSnap.sampleCount}</p>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── Model health + integrity panel ────────────────────────────────────────────

function ModelHealthCard() {
  const runtime = useAIRuntime();
  const [integrityResult, setIntegrityResult] = React.useState<
    { valid: boolean; reason?: string } | null
  >(null);
  const [checking, setChecking] = React.useState(false);

  async function handleValidate() {
    setChecking(true);
    try {
      const result = await validateModelIntegrity(getRecommendedManifest().id);
      setIntegrityResult(result);
    } catch (err) {
      setIntegrityResult({ valid: false, reason: err instanceof Error ? err.message : "check failed" });
    }
    setChecking(false);
  }

  const manifest = getRecommendedManifest();
  const ramEstimate = estimateModelRamMB(manifest.sizeBytes, 2048);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Model Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Model</p>
            <p className="text-foreground/70 font-mono text-[10.5px]">{manifest.id}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Size</p>
            <p className="font-mono text-foreground/70">
              {(manifest.sizeBytes / 1e9).toFixed(2)} GB
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Quantization</p>
            <p className="font-mono text-foreground/70">{manifest.quantization}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Context window</p>
            <p className="font-mono text-foreground/70">{manifest.contextLength} tok</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Max generation</p>
            <p className="font-mono text-foreground/70">{manifest.maxGenerationTokens} tok</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">RAM estimate</p>
            <p className="font-mono text-foreground/70">~{ramEstimate.toLocaleString()} MB</p>
          </div>
        </div>

        <div className="border-t border-border/20 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-medium">GGUF integrity</p>
            <Button
              size="sm" variant="outline"
              onClick={handleValidate}
              disabled={checking}
              className="text-[10px] h-6 px-2"
            >
              {checking ? "Checking…" : "Validate"}
            </Button>
          </div>
          {integrityResult ? (
            <div className={cn(
              "rounded-lg px-3 py-2 text-[11px]",
              integrityResult.valid ? "bg-emerald-500/8 text-emerald-700" : "bg-red-500/8 text-red-600",
            )}>
              <span className="font-semibold mr-1.5">{integrityResult.valid ? "VALID" : "CORRUPTED"}</span>
              {integrityResult.reason && (
                <span className="text-foreground/60">{integrityResult.reason}</span>
              )}
            </div>
          ) : (
            <p className="text-[10.5px] text-muted-foreground/45">Not checked yet</p>
          )}
        </div>

        {runtime.lastError && (
          <div className="border-t border-border/20 pt-3">
            <p className="text-[11px] text-red-600/80 bg-red-500/5 rounded-lg px-3 py-2">
              {runtime.lastError}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Longitudinal memory panel ─────────────────────────────────────────────────

function LongitudinalMemoryCard() {
  const [summary, setSummary] = React.useState(getLongitudinalSummary);
  const [stale, setStale] = React.useState(isSummaryStale);
  const [indexing, setIndexing] = React.useState(false);

  function refresh() {
    setSummary(getLongitudinalSummary());
    setStale(isSummaryStale());
  }

  async function handleRegenerate() {
    const s = generateLongitudinalSummary();
    setSummary(s);
    setStale(false);
  }

  async function handleReindex() {
    setIndexing(true);
    try {
      const { indexJournalEntries } = await import("@/ai/retrieval/journalIndexer");
      const { bootstrapBehavioralIndex } = await import("@/ai/retrieval/behavioralIndexer");
      await indexJournalEntries();
      await bootstrapBehavioralIndex();
    } catch { /* non-fatal */ }
    setIndexing(false);
    refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Longitudinal Memory</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={refresh} className="text-[11px] h-7 px-2">
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReindex}
            disabled={indexing}
            className="text-[11px] h-7 px-2"
          >
            {indexing ? "Indexing…" : "Re-index"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {stale && (
          <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2">
            <p className="text-[11px] text-amber-600/80">Weekly summary is stale or missing</p>
            <Button size="sm" variant="outline" onClick={handleRegenerate} className="text-[10px] h-6 px-2">
              Generate
            </Button>
          </div>
        )}

        {summary ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              {summary.weekWindow}
            </p>
            <div className="space-y-1.5 text-[11px] text-foreground/65">
              <p>{summary.overallWellnessSentence}</p>
              <p>{summary.moodSentence}</p>
              <p>{summary.sleepSentence}</p>
              <p>{summary.habitSentence}</p>
              <p className="text-[10.5px] text-muted-foreground/50 italic">{summary.journalHighlight}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground/60 text-[11px]">
            No summary yet. Use "Generate" to create one from current data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Phase 6 observability panel ───────────────────────────────────────────────

function IntelligenceObservabilityCard() {
  const [presence, setPresence] = React.useState(() => evaluatePresence());
  const [safetyInput, setSafetyInput] = React.useState("Your sleep consistency improved this week.");
  const [safetyResult, setSafetyResult] = React.useState<ReturnType<typeof filterOutput> | null>(null);
  const [reflection, setReflection] = React.useState(() => getStoredReflection("daily"));
  const [reflectionStale, setReflectionStale] = React.useState(() => isReflectionStale("daily"));
  const [contextPreview, setContextPreview] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [streamedText, setStreamedText] = React.useState("");

  function refreshPresence() {
    setPresence(evaluatePresence());
    setReflection(getStoredReflection("daily"));
    setReflectionStale(isReflectionStale("daily"));
  }

  function handleSafetyCheck() {
    setSafetyResult(filterOutput(safetyInput));
  }

  function handleContextPreview() {
    const summaryText = serializeSummaryForPrompt();
    setContextPreview(summaryText ?? "(no summary available)");
  }

  async function handleForceReflection() {
    setGenerating(true);
    setStreamedText("");
    clearReflection("daily");
    clearPresenceSuppression();
    const result = await generateDailyReflection({
      force: true,
      onToken: (t) => setStreamedText((prev) => prev + t),
    });
    setGenerating(false);
    setReflection(result ? {
      type: "daily",
      text: result.text,
      generatedAt: Date.now(),
      confidence: result.confidence,
      safetyScore: result.safetyScore,
    } : null);
    setReflectionStale(false);
  }

  const presenceColor = presence.show ? "text-emerald-600" : "text-amber-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Intelligence Observability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-[12px]">

        {/* Presence rules */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-medium">Presence decision</p>
            <Button size="sm" variant="outline" onClick={refreshPresence} className="text-[10px] h-6 px-2">
              Refresh
            </Button>
          </div>
          <div className="bg-muted/20 rounded-lg px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={cn("font-semibold uppercase text-[10px]", presenceColor)}>
                {presence.show ? "SHOW" : "HIDE"}
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-foreground/60">{presence.reason}</span>
              <span className="text-muted-foreground/40 ml-auto">
                confidence {(presence.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[10.5px] text-muted-foreground/55 flex gap-3 flex-wrap">
              <span>mood {presence.dataPoints.moodEntries}</span>
              <span>journal {presence.dataPoints.journalEntries}</span>
              <span>days {presence.dataPoints.dataDays}</span>
              <span>summary {presence.dataPoints.hasSummary ? "✓" : "✗"}</span>
            </div>
          </div>
        </div>

        {/* Daily reflection cache */}
        <div className="space-y-2 border-t border-border/20 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-medium">Daily reflection</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceReflection}
              disabled={generating}
              className="text-[10px] h-6 px-2"
            >
              {generating ? "Generating…" : "Force generate"}
            </Button>
          </div>
          {reflectionStale ? (
            <p className="text-[11px] text-amber-600/70">Stale or missing</p>
          ) : reflection ? (
            <div className="bg-muted/20 rounded-lg px-3 py-2 space-y-1">
              <p className="text-foreground/70 leading-snug">{reflection.text}</p>
              <div className="text-[10px] text-muted-foreground/50 flex gap-3">
                <span>confidence {(reflection.confidence * 100).toFixed(0)}%</span>
                <span>safety {(reflection.safetyScore * 100).toFixed(0)}%</span>
              </div>
            </div>
          ) : null}
          {generating && streamedText && (
            <p className="text-[11px] text-foreground/55 italic">
              {streamedText}
              <span className="inline-block w-1 h-3 bg-foreground/30 ml-0.5 animate-pulse align-middle" />
            </p>
          )}
        </div>

        {/* Safety filter tester */}
        <div className="space-y-2 border-t border-border/20 pt-4">
          <p className="text-muted-foreground font-medium">Safety filter test</p>
          <div className="flex gap-2">
            <input
              className="flex-1 text-[11px] bg-muted/30 border border-border/25 rounded-lg px-2.5 py-1.5 focus:outline-none"
              value={safetyInput}
              onChange={(e) => setSafetyInput(e.target.value)}
              placeholder="Test text here…"
            />
            <Button size="sm" variant="outline" onClick={handleSafetyCheck} className="text-[10px] h-7 px-2">
              Check
            </Button>
          </div>
          {safetyResult && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-[11px]",
                safetyResult.safe ? "bg-emerald-500/8 text-emerald-700" : "bg-red-500/8 text-red-600",
              )}
            >
              <span className="font-semibold mr-1.5">{safetyResult.safe ? "SAFE" : "BLOCKED"}</span>
              <span className="text-muted-foreground">score {(safetyResult.score * 100).toFixed(0)}%</span>
              {safetyResult.flags.length > 0 && (
                <span className="ml-1.5 text-foreground/60">
                  flags: {safetyResult.flags.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Context injection preview */}
        <div className="space-y-2 border-t border-border/20 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-medium">Context injection preview</p>
            <Button size="sm" variant="outline" onClick={handleContextPreview} className="text-[10px] h-6 px-2">
              Preview
            </Button>
          </div>
          {contextPreview && (
            <pre className="text-[10px] text-foreground/60 bg-muted/20 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
              {contextPreview}
            </pre>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// ── Platform observability panel (Phase 9) ────────────────────────────────────

function PlatformObservabilityCard() {
  const [device, setDevice] = React.useState<DeviceProfile | null>(null);
  const [manifest, setManifest] = React.useState(() => getManifestResult());
  const [update, setUpdate] = React.useState<UpdateEvaluation | null>(null);
  const [inventory, setInventory] = React.useState<StorageInventory | null>(null);
  const [channel, setChannelState] = React.useState<ReleaseChannelType>(() => getReleaseChannel());
  const [history] = React.useState(() => getMigrationHistory());
  const [loading, setLoading] = React.useState(false);
  const [evicting, setEvicting] = React.useState(false);
  const [evictedBytes, setEvictedBytes] = React.useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    const [d, u, inv] = await Promise.all([
      getDeviceProfile({ refresh: true }),
      evaluateModelUpdate(),
      getStorageInventory(),
    ]);
    setDevice(d);
    setUpdate(u);
    setInventory(inv);
    setManifest(getManifestResult());
    setLoading(false);
  }

  async function handleEvict() {
    setEvicting(true);
    const freed = await evictInactiveModels();
    setEvictedBytes(freed);
    const inv = await getStorageInventory();
    setInventory(inv);
    setEvicting(false);
  }

  function handleChannelChange(ch: ReleaseChannelType) {
    setReleaseChannel(ch);
    setChannelState(ch);
  }

  const updateColor =
    update?.decision === "update_required" ? "text-red-500" :
    update?.decision === "update_available" ? "text-amber-500" :
    update?.decision === "no_update" ? "text-emerald-500" :
    "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Platform Observability</CardTitle>
        <Button
          size="sm" variant="outline"
          onClick={refresh}
          disabled={loading}
          className="text-[10px] h-6 px-2"
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Remote manifest */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Remote Manifest
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Source</p>
              <p className={cn(
                "font-mono",
                manifest?.source === "remote" ? "text-emerald-600" :
                manifest?.source === "cached" ? "text-amber-600" :
                "text-muted-foreground",
              )}>
                {manifest?.source ?? "not fetched"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Models listed</p>
              <p className="font-mono text-foreground/70">
                {manifest?.models.length ?? 0}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Fetched</p>
              <p className="font-mono text-foreground/70 text-[10.5px]">
                {manifest?.fetchedAt
                  ? new Date(manifest.fetchedAt).toLocaleTimeString()
                  : "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Emergency disable</p>
              <p className={cn(
                "font-mono",
                manifest?.platform?.emergencyDisable ? "text-red-500" : "text-emerald-600",
              )}>
                {manifest?.platform?.emergencyDisable ? "ACTIVE" : "off"}
              </p>
            </div>
          </div>
          {manifest?.error && (
            <p className="text-[10.5px] text-amber-600/70 bg-amber-500/5 rounded px-2 py-1">
              {manifest.error}
            </p>
          )}
        </div>

        {/* Device profile */}
        {device && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Device Profile
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Tier</p>
                <p className="font-mono text-foreground/70">{device.tier}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">RAM</p>
                <p className="font-mono text-foreground/70">
                  {device.estimatedRamGB != null ? `${device.estimatedRamGB} GB` : "unknown"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Platform</p>
                <p className="font-mono text-foreground/70">{device.platform}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Wi-Fi</p>
                <p className="font-mono text-foreground/70">
                  {device.isOnWifi === null ? "unknown" : device.isOnWifi ? "yes" : "no"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Battery</p>
                <p className="font-mono text-foreground/70">
                  {device.batteryPct != null
                    ? `${device.batteryPct}% ${device.batteryCharging ? "(charging)" : ""}`
                    : "unknown"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Storage free</p>
                <p className="font-mono text-foreground/70">
                  {device.availableStorageMB != null
                    ? `${(device.availableStorageMB / 1000).toFixed(1)} GB`
                    : "unknown"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Update evaluation */}
        {update && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Update Evaluation
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn("font-mono font-semibold text-[10.5px] uppercase", updateColor)}>
                  {update.decision.replace("_", " ")}
                </span>
              </div>
              <p className="text-foreground/55 text-[11px]">{update.reason}</p>
              {update.targetManifest && (
                <p className="text-muted-foreground/50 text-[10.5px] font-mono">
                  target: {update.targetManifest.id}
                </p>
              )}
              <p className="text-muted-foreground/40 text-[10.5px]">
                rollout seed: {getRolloutSeed()}
              </p>
            </div>
          </div>
        )}

        {/* Storage inventory */}
        {inventory && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                Storage Inventory
              </p>
              {inventory.evictableBytes > 0 && (
                <Button
                  size="sm" variant="outline"
                  onClick={handleEvict}
                  disabled={evicting}
                  className="text-[10px] h-6 px-2"
                >
                  {evicting ? "Evicting…" : "Evict unused"}
                </Button>
              )}
            </div>
            {inventory.entries.length === 0 ? (
              <p className="text-muted-foreground/50 text-[11px]">No models on disk</p>
            ) : (
              <div className="space-y-1">
                {inventory.entries.map((e) => (
                  <div key={e.modelId} className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] text-foreground/60 truncate">
                      {e.modelId}
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold ml-2 flex-shrink-0",
                      e.state === "active" ? "text-emerald-600" :
                      e.state === "staged" ? "text-amber-600" :
                      e.state === "corrupted" ? "text-red-500" :
                      "text-muted-foreground/50",
                    )}>
                      {e.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-muted-foreground/40 text-[10.5px]">
              total: {(inventory.totalUsedBytes / 1e9).toFixed(2)} GB
              {inventory.evictableBytes > 0 && ` · evictable: ${(inventory.evictableBytes / 1e9).toFixed(2)} GB`}
            </p>
            {evictedBytes !== null && (
              <p className="text-emerald-600/70 text-[10.5px]">
                Freed {(evictedBytes / 1e9).toFixed(2)} GB
              </p>
            )}
          </div>
        )}

        {/* Release channel */}
        <div className="space-y-1.5 border-t border-border/15 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Release Channel
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {(["stable", "beta", "experimental", "internal"] as ReleaseChannelType[]).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelChange(ch)}
                className={cn(
                  "text-[10.5px] px-2 py-0.5 rounded border transition-colors",
                  channel === ch
                    ? "border-foreground/30 text-foreground/80 bg-foreground/5"
                    : "border-border/20 text-muted-foreground/40 hover:border-border/40",
                )}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Migration history */}
        {history.length > 0 && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Migration History
            </p>
            <div className="space-y-1">
              {history.slice(-5).reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[10.5px]">
                  <span className={r.success ? "text-emerald-600" : "text-red-500"}>
                    {r.success ? "✓" : "✗"}
                  </span>
                  <span className="text-muted-foreground/50 font-mono truncate">
                    {r.from ?? "none"} → {r.to}
                  </span>
                  <span className="text-muted-foreground/30 flex-shrink-0">
                    {new Date(r.completedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── Benchmark panel (Phase 10) ────────────────────────────────────────────────

function BenchmarkCard() {
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentType, setCurrentType] = React.useState<string | null>(null);
  const [latest, setLatest] = React.useState<BenchmarkSuite | null>(null);
  const [history, setHistory] = React.useState<BenchmarkSuite[]>(() => getBenchmarkHistory());
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const h = getBenchmarkHistory();
    setHistory(h);
    if (h.length > 0) setLatest(h[h.length - 1]);
  }, []);

  async function handleRun() {
    setRunning(true);
    setProgress(0);
    setCurrentType(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const unsub = subscribeToProgress((type, pct) => {
      setCurrentType(type === "complete" ? null : type);
      setProgress(pct);
    });

    try {
      const suite = await runBenchmarkSuite({ signal: controller.signal });
      setLatest(suite);
      setHistory(getBenchmarkHistory());
    } catch { /* aborted or failed */ }

    unsub();
    setRunning(false);
    setCurrentType(null);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const scoreColor = (score: number) =>
    score >= 75 ? "text-emerald-600" :
    score >= 50 ? "text-amber-500" :
    "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Inference Benchmark</CardTitle>
        <div className="flex gap-1">
          {running ? (
            <Button size="sm" variant="outline" onClick={handleStop} className="text-[10px] h-6 px-2">
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRun} className="text-[10px] h-6 px-2">
              Run suite
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Progress */}
        {running && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {currentType ? `Running: ${currentType.replace("_", " ")}` : "Starting…"}
              </span>
              <span className="font-mono text-foreground/60">{progress}%</span>
            </div>
            <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/50 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Latest results */}
        {latest && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                Latest Suite — {latest.deviceClass}
              </p>
              <span className={cn("font-mono font-bold text-[13px]", scoreColor(latest.overallScore))}>
                {latest.overallScore}
              </span>
            </div>
            <div className="space-y-1">
              {latest.results.map((r) => (
                <div key={r.type} className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground/55 w-32">{r.type.replace(/_/g, " ")}</span>
                  <span className="font-mono text-muted-foreground/60 w-16 text-right">
                    {r.tokPerSec > 0 ? `${r.tokPerSec} t/s` : "—"}
                  </span>
                  <span className={cn("font-mono font-semibold w-12 text-right", scoreColor(r.score))}>
                    {r.score}
                  </span>
                  <StatusBadge ok={r.passed} label={r.passed ? "pass" : "fail"} />
                </div>
              ))}
            </div>
            <p className="text-muted-foreground/35 text-[10px]">
              {new Date(latest.ranAt).toLocaleString()} · {(latest.durationMs / 1000).toFixed(1)}s total
            </p>
          </div>
        )}

        {/* History summary */}
        {history.length > 1 && (
          <div className="space-y-1 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              History ({history.length} suites)
            </p>
            <div className="flex gap-2 flex-wrap">
              {history.slice(-8).map((s) => (
                <div key={s.suiteId} className="text-center">
                  <div className={cn("font-mono text-[11px] font-semibold", scoreColor(s.overallScore))}>
                    {s.overallScore}
                  </div>
                  <div className="text-muted-foreground/30 text-[9px]">
                    {new Date(s.ranAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!latest && !running && (
          <p className="text-muted-foreground/50 text-[11px]">
            No benchmarks run yet. Press "Run suite" to characterize this device.
          </p>
        )}

      </CardContent>
    </Card>
  );
}

// ── Performance history panel (Phase 10) ─────────────────────────────────────

function PerformanceHistoryCard() {
  const [thermalIncidents] = React.useState(() => getThermalIncidents(10));
  const [failures] = React.useState(() => getFailureEvents(10));
  const [daily] = React.useState(() => {
    const records = getDailyRecords();
    return Object.values(records)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  });
  const [storageBytes] = React.useState(() => getHistoryStorageBytes());
  const [cleared, setCleared] = React.useState(false);

  function handleClear() {
    clearAllHistory();
    setCleared(true);
  }

  const stabilityColor = (score: number) =>
    score >= 90 ? "text-emerald-600" :
    score >= 70 ? "text-amber-500" :
    "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Performance History</CardTitle>
        <Button
          size="sm" variant="outline"
          onClick={handleClear}
          disabled={cleared}
          className="text-[10px] h-6 px-2"
        >
          {cleared ? "Cleared" : "Clear all"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Daily records */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Daily Records (last 7 days)
          </p>
          {daily.length === 0 ? (
            <p className="text-muted-foreground/50 text-[11px]">No daily records yet.</p>
          ) : (
            <div className="space-y-1">
              {daily.map((d) => (
                <div key={d.date} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground/50 font-mono w-20 flex-shrink-0">{d.date.slice(5)}</span>
                  <span className="text-foreground/60 w-16 font-mono">
                    {d.inferenceCount} inf
                  </span>
                  <span className="text-foreground/50 w-16 font-mono">
                    {d.avgTokPerSec > 0 ? `${d.avgTokPerSec.toFixed(1)} t/s` : "—"}
                  </span>
                  <span className={cn("font-mono font-semibold ml-auto", stabilityColor(d.modelStabilityScore))}>
                    {d.modelStabilityScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thermal incidents */}
        <div className="space-y-1.5 border-t border-border/15 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Thermal Incidents (last 10)
          </p>
          {thermalIncidents.length === 0 ? (
            <p className="text-muted-foreground/50 text-[11px]">None recorded.</p>
          ) : (
            <div className="space-y-1">
              {thermalIncidents.slice().reverse().map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-[10.5px]">
                  <span className="text-red-500/70 font-semibold w-20 flex-shrink-0">{t.thermalState}</span>
                  <span className="text-muted-foreground/50 font-mono">{t.inferencesPerMin}/min</span>
                  <span className="text-muted-foreground/40 font-mono ml-auto">
                    {new Date(t.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Failure events */}
        <div className="space-y-1.5 border-t border-border/15 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Failure Events (last 10)
          </p>
          {failures.length === 0 ? (
            <p className="text-muted-foreground/50 text-[11px]">None recorded.</p>
          ) : (
            <div className="space-y-1">
              {failures.slice().reverse().map((f, i) => (
                <div key={i} className="text-[10.5px] space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500/70 font-mono">{f.provider}</span>
                    <StatusBadge ok={f.recoveredSuccessfully} label={f.recoveredSuccessfully ? "recovered" : "failed"} />
                    <span className="text-muted-foreground/30 ml-auto">
                      {new Date(f.occurredAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-foreground/40 truncate pl-2">{f.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage */}
        <div className="border-t border-border/15 pt-3">
          <p className="text-muted-foreground/40 text-[10.5px]">
            History storage: {(storageBytes / 1024).toFixed(1)} KB
          </p>
        </div>

      </CardContent>
    </Card>
  );
}

// ── Worker health + lifecycle panel (Phase 11) ────────────────────────────────

function WorkerHealthCard() {
  const [workers, setWorkers] = React.useState<WorkerHealthReport[]>(() => getWorkerHealth());
  const [lifecycle, setLifecycle] = React.useState<AppLifecycleState>(() => getLifecycleState());
  const [orphansCleaned, setOrphansCleaned] = React.useState<number | null>(null);

  React.useEffect(() => {
    const unsubW = subscribeToWorkerHealth(setWorkers);
    const unsubL = subscribeToLifecycle((_, state) => setLifecycle(state));
    return () => { unsubW(); unsubL(); };
  }, []);

  function handleSpawn(role: "inference" | "retrieval" | "indexing" | "summarization") {
    spawnWorker(role);
  }

  function handleCleanup() {
    const cleaned = cleanupOrphanedWorkers();
    setOrphansCleaned(cleaned);
  }

  const lifecycleColor =
    lifecycle === "active" ? "text-emerald-500" :
    lifecycle === "backgrounded" ? "text-amber-500" :
    lifecycle === "paused" ? "text-yellow-500" :
    "text-red-500";

  const statusColor = (s: WorkerHealthReport["status"]) =>
    s === "idle" ? "text-emerald-600" :
    s === "busy" ? "text-sky-500" :
    s === "degraded" ? "text-amber-500" :
    s === "restarting" ? "text-yellow-500" :
    "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Workers + Lifecycle</CardTitle>
        <Button size="sm" variant="outline" onClick={handleCleanup} className="text-[10px] h-6 px-2">
          Cleanup orphans
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Lifecycle state */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            App Lifecycle
          </p>
          <div className="flex items-center gap-2">
            <span className={cn("font-mono font-semibold uppercase", lifecycleColor)}>
              {lifecycle}
            </span>
            {orphansCleaned !== null && (
              <span className="text-muted-foreground/50 text-[10.5px]">
                · {orphansCleaned} orphan{orphansCleaned !== 1 ? "s" : ""} cleaned
              </span>
            )}
          </div>
        </div>

        {/* Worker pool */}
        <div className="space-y-1.5 border-t border-border/15 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Worker Pool ({workers.length})
            </p>
            <div className="flex gap-1">
              {(["inference", "retrieval"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSpawn(role)}
                  className="text-[10px] px-2 py-0.5 rounded border border-border/20 text-muted-foreground/50 hover:border-border/40 transition-colors"
                >
                  + {role}
                </button>
              ))}
            </div>
          </div>

          {workers.length === 0 ? (
            <p className="text-muted-foreground/45 text-[11px]">No workers spawned yet.</p>
          ) : (
            <div className="space-y-1">
              {workers.map((w) => (
                <div key={w.workerId} className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-foreground/50 w-28 truncate">{w.workerId}</span>
                  <span className={cn("font-semibold text-[10px] uppercase w-16", statusColor(w.status))}>
                    {w.status}
                  </span>
                  <span className="text-muted-foreground/35 text-[10px]">
                    {w.tasksCompleted}✓ {w.tasksFailed}✗
                  </span>
                  <span className="text-muted-foreground/30 text-[10px] ml-auto">
                    {Math.round(w.uptimeMs / 1000)}s
                  </span>
                  {(w.status === "crashed" || w.status === "degraded") && (
                    <button
                      type="button"
                      onClick={() => restartWorker(w.workerId)}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-600 hover:bg-amber-500/5"
                    >
                      Restart
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// ── Cognition quality + battery schedule panel (Phase 11) ─────────────────────

function CognitionQualityCard() {
  const [profile, setProfile] = React.useState<CognitionProfile>(() => getCognitionProfile());
  const [battery, setBattery] = React.useState<BatteryScheduleState | null>(() => getBatteryScheduleStateSync());
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeToCognitionProfile(setProfile);
    getBatteryScheduleState().then(setBattery).catch(() => null);
    return unsub;
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    const b = await getBatteryScheduleState({ refresh: true });
    setBattery(b);
    setProfile(getCognitionProfile({ batteryPct: b.batteryPct }));
    setRefreshing(false);
  }

  const qualityColor = (q: CognitionProfile["quality"]) =>
    q === "deep_reflection" ? "text-emerald-600" :
    q === "reflective" ? "text-sky-500" :
    q === "balanced" ? "text-foreground/80" :
    q === "efficient" ? "text-amber-500" :
    "text-red-500";

  const batteryModeColor = (m: BatteryScheduleState["mode"]) =>
    m === "unrestricted" ? "text-emerald-600" :
    m === "conservative" ? "text-amber-500" :
    m === "minimal" ? "text-orange-500" :
    "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Cognition Quality</CardTitle>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="text-[10px] h-6 px-2">
          {refreshing ? "..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Quality profile */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Active Quality
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("font-mono font-bold text-[13px]", qualityColor(profile.quality))}>
              {profile.quality.replace("_", " ")}
            </span>
          </div>
          <p className="text-muted-foreground/50 text-[10.5px]">{profile.reason}</p>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Max tokens</p>
              <p className="font-mono text-foreground/70">{profile.maxTokens}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Retrieval depth</p>
              <p className="font-mono text-foreground/70">{profile.retrievalDepth}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Summarization</p>
              <StatusBadge ok={profile.enableSummarization} label={profile.enableSummarization ? "on" : "off"} />
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Memory synthesis</p>
              <StatusBadge ok={profile.enableMemorySynthesis} label={profile.enableMemorySynthesis ? "on" : "off"} />
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Journal analysis</p>
              <StatusBadge ok={profile.enableJournalAnalysis} label={profile.enableJournalAnalysis ? "on" : "off"} />
            </div>
          </div>
        </div>

        {/* Battery schedule */}
        {battery && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Battery Schedule
            </p>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono font-semibold uppercase text-[11px]", batteryModeColor(battery.mode))}>
                {battery.mode}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-foreground/55 text-[11px]">{battery.reason}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Heavy tasks</p>
                <StatusBadge ok={battery.heavyTasksAllowed} label={battery.heavyTasksAllowed ? "allowed" : "blocked"} />
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Background</p>
                <StatusBadge ok={battery.backgroundTasksAllowed} label={battery.backgroundTasksAllowed ? "allowed" : "blocked"} />
              </div>
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Max quality</p>
                <p className={cn("font-mono text-[10.5px]", qualityColor(battery.maxCognitionQuality))}>
                  {battery.maxCognitionQuality.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── Fault containment panel (Phase 11) ────────────────────────────────────────

function FaultContainmentCard() {
  const [health, setHealth] = React.useState<SubsystemHealth[]>(() => getAllSubsystemHealth());
  const [faultLog, setFaultLog] = React.useState(() => getFaultLog(10));
  const [resetting, setResetting] = React.useState<SubsystemId | "all" | null>(null);

  React.useEffect(() => {
    const unsub = subscribeToFaults(() => {
      setHealth(getAllSubsystemHealth());
      setFaultLog(getFaultLog(10));
    });
    return unsub;
  }, []);

  async function handleReset(id: SubsystemId | "all") {
    setResetting(id);
    if (id === "all") resetAllSubsystems();
    else resetSubsystem(id);
    setHealth(getAllSubsystemHealth());
    await new Promise<void>((r) => setTimeout(r, 300));
    setResetting(null);
  }

  const circuitColor = (h: SubsystemHealth) =>
    h.quarantined ? "text-red-600 font-bold" :
    h.circuitState === "open" ? "text-red-500" :
    h.circuitState === "half_open" ? "text-amber-500" :
    "text-emerald-600";

  const anyFault = health.some((h) => h.circuitState !== "closed" || h.quarantined);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Fault Containment</CardTitle>
        {anyFault && (
          <Button
            size="sm" variant="outline"
            onClick={() => handleReset("all")}
            disabled={resetting === "all"}
            className="text-[10px] h-6 px-2"
          >
            {resetting === "all" ? "Resetting…" : "Reset all"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Circuit breaker grid */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Circuit Breakers
          </p>
          <div className="space-y-1">
            {health.map((h) => (
              <div key={h.subsystem} className="flex items-center gap-2">
                <span className="text-foreground/55 w-24 text-[11px]">{h.subsystem}</span>
                <span className={cn("font-mono text-[10px] uppercase w-16", circuitColor(h))}>
                  {h.quarantined ? "quarantined" : h.circuitState.replace("_", " ")}
                </span>
                <span className="text-muted-foreground/35 text-[10px]">
                  {h.failureCount}✗
                </span>
                {h.circuitState !== "closed" && !h.quarantined && (
                  <button
                    type="button"
                    onClick={() => void handleReset(h.subsystem)}
                    className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-600 hover:bg-amber-500/5 ml-auto"
                  >
                    Reset
                  </button>
                )}
                {h.quarantined && (
                  <button
                    type="button"
                    onClick={() => void handleReset(h.subsystem)}
                    className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-600 hover:bg-red-500/5 ml-auto"
                  >
                    Unquarantine
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fault log */}
        {faultLog.length > 0 && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Fault Log (last 10)
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {faultLog.slice().reverse().map((f, i) => (
                <div key={i} className="text-[10.5px] space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500/70 font-mono">{f.subsystem}</span>
                    <span className="text-muted-foreground/30 ml-auto flex-shrink-0">
                      {new Date(f.occurredAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-foreground/40 truncate pl-2">{f.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!anyFault && faultLog.length === 0 && (
          <p className="text-muted-foreground/45 text-[11px]">All subsystems healthy. No faults recorded.</p>
        )}

      </CardContent>
    </Card>
  );
}

// ── Runtime stress suite panel (Phase 11) ─────────────────────────────────────

const STRESS_LABELS: Record<StressScenarioId, string> = {
  sustained_inference: "Sustained inference (10×)",
  rapid_cancel_restart: "Rapid cancel/restart (8×)",
  retrieval_burst: "Retrieval burst (15×)",
  long_context: "Long context (3×)",
  thermal_escalation: "Thermal escalation (12×)",
  memory_pressure: "Memory pressure (5×)",
  low_storage: "Low storage check",
  worker_fault: "Worker fault recovery",
};

function StressTestCard() {
  const [selected, setSelected] = React.useState<Set<StressScenarioId>>(
    new Set(["sustained_inference", "rapid_cancel_restart"]),
  );
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<StressProgress | null>(null);
  const [results, setResults] = React.useState<StressScenarioResult[]>([]);
  const [history] = React.useState<StressScenarioResult[][]>(() => getStressHistory());
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const unsub = subscribeToStressProgress(setProgress);
    return unsub;
  }, []);

  function toggleScenario(id: StressScenarioId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRun() {
    if (selected.size === 0) return;
    setRunning(true);
    setResults([]);
    setProgress(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const ids = ALL_STRESS_SCENARIOS.filter((id) => selected.has(id));
    const r = await runStressSuite(ids, ctrl.signal);
    setResults(r);
    setRunning(false);
    setProgress(null);
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const passColor = (r: StressScenarioResult) =>
    r.passed ? "text-emerald-600" : "text-red-500";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Runtime Stress Suite</CardTitle>
        <div className="flex gap-1">
          {running ? (
            <Button size="sm" variant="outline" onClick={handleStop} className="text-[10px] h-6 px-2">
              Stop
            </Button>
          ) : (
            <Button
              size="sm" variant="outline"
              onClick={() => void handleRun()}
              disabled={selected.size === 0}
              className="text-[10px] h-6 px-2"
            >
              Run selected
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-[12px]">

        {/* Scenario selection */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Scenarios
          </p>
          <div className="space-y-1">
            {ALL_STRESS_SCENARIOS.map((id) => (
              <label key={id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggleScenario(id)}
                  disabled={running}
                  className="w-3 h-3"
                />
                <span className={cn(
                  "text-[11px]",
                  selected.has(id) ? "text-foreground/75" : "text-muted-foreground/40",
                )}>
                  {STRESS_LABELS[id]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Progress */}
        {running && progress && (
          <div className="space-y-1 border-t border-border/15 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{STRESS_LABELS[progress.scenario]}</span>
              <span className="font-mono text-foreground/50">{progress.iteration}/{progress.total}</span>
            </div>
            <p className="text-[10.5px] text-muted-foreground/45 italic">{progress.phase}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-1.5 border-t border-border/15 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              Results
            </p>
            <div className="space-y-1.5">
              {results.map((r) => (
                <div key={r.id} className="space-y-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={cn("font-semibold w-8", passColor(r))}>
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                    <span className="text-foreground/60 truncate">{STRESS_LABELS[r.id]}</span>
                    <span className="text-muted-foreground/35 ml-auto flex-shrink-0">
                      {(r.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/45 pl-10 truncate">{r.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!running && results.length === 0 && history.length > 0 && (
          <div className="border-t border-border/15 pt-3">
            <p className="text-[10px] text-muted-foreground/35">
              Last run: {history[history.length - 1].filter((r) => r.passed).length}/{history[history.length - 1].length} passed
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AIDevPanel() {
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1">
        AI Runtime — Dev Tools
      </div>
      <RuntimeStatusCard />
      <ModelHealthCard />
      <PerformanceMetricsCard />
      <RuntimeGovernorCard />
      <CognitionQualityCard />
      <WorkerHealthCard />
      <PlatformObservabilityCard />
      <BenchmarkCard />
      <PerformanceHistoryCard />
      <FaultContainmentCard />
      <StressTestCard />
      <LongitudinalMemoryCard />
      <IntelligenceObservabilityCard />
      <StructuredTestsCard />
      <InferenceTestCard />
      <RetrievalTestCard />
      <SessionMemoryCard />
    </div>
  );
}
