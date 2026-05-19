// AI Runtime Developer Panel — /dev route only, tree-shaken from production.
// Tests inference, retrieval, embeddings, thermal state, and cancellation.

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAIRuntime } from "@/ai/hooks/useAIRuntime";
import { useInference } from "@/ai/hooks/useInference";
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

// ── Inference test panel ──────────────────────────────────────────────────────

function InferenceTestCard() {
  const { status, run, cancel } = useInference();
  const [prompt, setPrompt] = React.useState("What wellness patterns do you notice?");
  const [includeContext, setIncludeContext] = React.useState(false);
  const [maxTokens, setMaxTokens] = React.useState(256);
  const [temperature, setTemperature] = React.useState(0.7);

  const isRunning = status.phase === "queued" || status.phase === "running";

  async function handleRun() {
    let systemContext: string | undefined;

    if (includeContext) {
      const { buildAIContextPayload } = await import("@/ai/contextBridge");
      const { assembleInferenceContext } = await import("@/ai/orchestration/contextAssembler");
      // Build a minimal context payload from available intelligence
      try {
        const { useWellnessIntelligence } = await import("@/intelligence/useWellnessIntelligence");
        void useWellnessIntelligence; // context only available in hooks, skip for dev panel
      } catch { /* */ }
      const assembled = assembleInferenceContext(null);
      systemContext = assembled.systemPrompt;
    }

    const result = await run({ prompt, systemContext, maxTokens, temperature });
    if (result) {
      appendTurn("user", prompt);
      appendTurn("assistant", result.text);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Inference Test</CardTitle>
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
              type="range" min={64} max={1024} step={64}
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
            {isRunning ? "Running..." : "Run inference"}
          </Button>
          {isRunning && (
            <Button size="sm" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          )}
        </div>

        {status.phase === "complete" && (
          <div className="space-y-2">
            <div className="bg-muted/30 rounded-xl p-3 text-[12px]">
              <p className="text-foreground/80 leading-relaxed">{status.result.text}</p>
            </div>
            <div className="text-[10px] text-muted-foreground/60 flex gap-3">
              <span>{status.result.tokensGenerated} tokens</span>
              <span>{status.result.durationMs}ms</span>
              <span>via {status.result.provider}</span>
            </div>
          </div>
        )}

        {status.phase === "failed" && (
          <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {status.error}
          </p>
        )}

        {(status.phase === "cancelled") && (
          <p className="text-[12px] text-muted-foreground">Cancelled.</p>
        )}
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

// ── Main panel ────────────────────────────────────────────────────────────────

export function AIDevPanel() {
  return (
    <div className="space-y-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1">
        AI Runtime — Dev Tools
      </div>
      <RuntimeStatusCard />
      <LongitudinalMemoryCard />
      <InferenceTestCard />
      <RetrievalTestCard />
      <SessionMemoryCard />
    </div>
  );
}
