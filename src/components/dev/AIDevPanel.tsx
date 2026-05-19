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
import { PHI3_MINI_MANIFEST } from "@/ai/providers/local/modelMetadata";
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

  const ramEstimate = estimateModelRamMB(PHI3_MINI_MANIFEST.sizeBytes, 2048);

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
      const result = await validateModelIntegrity(PHI3_MINI_MANIFEST.id);
      setIntegrityResult(result);
    } catch (err) {
      setIntegrityResult({ valid: false, reason: err instanceof Error ? err.message : "check failed" });
    }
    setChecking(false);
  }

  const ramEstimate = estimateModelRamMB(PHI3_MINI_MANIFEST.sizeBytes, 2048);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Model Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Model</p>
            <p className="text-foreground/70 font-mono text-[10.5px]">{PHI3_MINI_MANIFEST.id}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Size</p>
            <p className="font-mono text-foreground/70">
              {(PHI3_MINI_MANIFEST.sizeBytes / 1e9).toFixed(2)} GB
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Quantization</p>
            <p className="font-mono text-foreground/70">{PHI3_MINI_MANIFEST.quantization}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Context window</p>
            <p className="font-mono text-foreground/70">{PHI3_MINI_MANIFEST.contextLength} tok</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Max generation</p>
            <p className="font-mono text-foreground/70">{PHI3_MINI_MANIFEST.maxGenerationTokens} tok</p>
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
      <LongitudinalMemoryCard />
      <IntelligenceObservabilityCard />
      <StructuredTestsCard />
      <InferenceTestCard />
      <RetrievalTestCard />
      <SessionMemoryCard />
    </div>
  );
}
