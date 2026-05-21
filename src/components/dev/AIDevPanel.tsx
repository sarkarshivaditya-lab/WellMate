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
  serializeSummaryForPrompt,
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
import { getManifestResult, getReleaseChannel, setReleaseChannel, getRolloutSeed } from "@/ai/models/remoteManifest";
import type { ReleaseChannel as ReleaseChannelType } from "@/ai/providers/local/modelMetadata";
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
import { cn } from "@/lib/utils";
import {
  getWorkerHealth,
  subscribeToWorkerHealth,
  spawnWorker,
  restartWorker,
  cleanupOrphanedWorkers,
} from "@/ai/workers/workerOrchestrator";
import type { WorkerHealthReport } from "@/ai/workers/workerContracts";
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
import { getWorkerBridgeStatus, type WorkerBridgeStatus } from "@/ai/workers/workerBridge";
import { getStorageHealthReport, type StorageHealthReport } from "@/ai/storage/storageIntegrity";
import {
  getStartupProfiles,
  getAverageBootDurationMs,
  getSlowestStage,
  type BootProfile,
} from "@/ai/runtime/coldStartOptimizer";
import { getDeploymentDiagnostics, isSafeModeActive, activateSafeMode, deactivateSafeMode, type DeploymentDiagnosticsReport } from "@/ai/platform/deploymentDiagnostics";
import { getThreadingCapability, isMultiThreadEligible, type ThreadingCapability } from "@/ai/runtime/threadingCapability";
import { getPoolMetrics, getPoolSlots, type PoolMetrics } from "@/ai/workers/threadedInferencePool";
import { getTopologySnapshot, getQueueDepthByRole, type TopologySnapshot } from "@/ai/workers/workerTopology";
import { getSnapshot as getNativeLifecycleSnapshot, getNativeLifecycleLog, initNativeLifecycle, type NativeLifecycleSnapshot } from "@/ai/platform/nativeLifecycle";
import { getAllRegistryEntries, getTrustScore, verifyIntegrityChain, type SecureModelRegistryEntry } from "@/ai/storage/secureModelStore";
import { getTelemetrySummary, getRecentTelemetry, clearTelemetry, type TelemetrySummary, type TelemetryEvent } from "@/ai/telemetry/runtimeTelemetry";
import { getFleetDiagnosticsReport, getDeploymentCohort, type FleetDiagnosticsReport } from "@/ai/telemetry/fleetDiagnostics";
import { getSchedulerState, getPendingJobs, getAllNativeJobs, type SchedulerState, type NativeBackgroundJob } from "@/ai/platform/nativeBackgroundExecution";
import { getAllFeatureGates, getRolloutAssignment, checkBuildCompatibility, overrideFeatureGate, clearFeatureGateOverrides, type FeatureGateState } from "@/ai/platform/deploymentConvergence";
import { getWasmRuntimeCapability, type WasmRuntimeCapabilitySummary } from "@/ai/workers/threadedWasmRuntime";
import { getSabMemoryReport, isSabAvailable, type SabMemoryReport } from "@/ai/runtime/sabMemoryManager";
import { computeThreadScaleDecision, getThreadScaleHistory, recordThreadEfficiency, type ThreadScaleDecision } from "@/ai/runtime/adaptiveThreadScaler";
import { assessWebGpuCapability, getWebGpuCapabilitySync, resolveInferenceExecutionTier, type WebGpuCapabilityReport } from "@/ai/platform/webgpuCapability";
import { getMemoryGovernorReport, getContextBudget, isFragmentationSuspected, type MemoryGovernorReport } from "@/ai/runtime/memoryGovernor";
import { getThroughputSummary, getRecentSamples, type ThroughputSummary } from "@/ai/runtime/throughputProfiler";
import { getHardwareCharacterization, getThermalTrendLog, type HardwareCharacterization } from "@/ai/runtime/hardwareCharacterizer";
import { getPluginAvailability, type PluginAvailabilityMap } from "@/ai/platform/nativePluginContracts";
import { computeRuntimePressure, getInferenceTimeline, getSustainedLoadProfile, type RuntimePressureSnapshot } from "@/ai/runtime/performanceLab";
import { getInferenceWorkerBridgeState, initInferenceWorkerBridge, subscribeToInferenceWorkerBridge, type InferenceSlotSnapshot } from "@/ai/workers/inferenceWorkerBridge";
import { getCoopCoepStatus, verifyCoopCoep, type CoopCoepStatus } from "@/ai/platform/coopCoepVerifier";
import { getSabStreamStats, type SabStreamStats } from "@/ai/runtime/sabTokenStream";
import { getThreadedBootStatus, runThreadedBoot, type ThreadedBootStatus, type ThreadedBootStageResult } from "@/ai/runtime/threadedRuntimeBoot";
import { getNativeFilesystemReport, benchmarkFilesystem, type NativeFilesystemReport } from "@/ai/storage/nativeFilesystemAccelerator";
import { getNativeThermalBatteryState, sampleNativeThermalBattery, type NativeThermalBatteryState } from "@/ai/platform/nativeThermalBattery";
import { getKvCacheReport, clearKvCacheState, type KvCacheReport } from "@/ai/runtime/kvCacheGovernor";
import { getRoutingDecision, getQuantizationProfiles, recordInferencePerformance, type RoutingDecision, type QuantizationProfile } from "@/ai/models/quantizationRouter";
import { getAllContractSatisfaction, getNativeBackgroundContracts, type ContractSatisfactionMap } from "@/ai/platform/nativeBackgroundContracts";
import { getRuntimeValidationReport, runValidationSuite, getDeploymentReadinessScore, type RuntimeValidationReport, type ValidationResult } from "@/ai/runtime/runtimeValidator";
import { getCognitionEventBusStats, getRecentCognitionEvents, type CognitionEvent } from "@/ai/cognition/cognitionEventBus";
import { getCognitiveStateReport, type CognitiveStateReport } from "@/ai/cognition/cognitiveStateEngine";
import { getMemoryHierarchyReport, type MemoryHierarchyReport } from "@/ai/memory/memoryHierarchy";
import { getContextBudgetReport, assembleContext, type ContextBudgetReport } from "@/ai/cognition/contextPrioritizer";
import { getUserModelReport, type UserModelReport } from "@/ai/cognition/userModel";
import { getReflectionReport, getActiveReflections, type ReflectionReport, type ReflectionEntry } from "@/ai/cognition/reflectionEngine";
import { getContinuityStatus, getContinuityRecoveryLog, type ContinuityStatus } from "@/ai/cognition/continuityRecovery";
import { getSafetyGovernorReport, runSafetyAudit, type SafetyGovernorReport } from "@/ai/cognition/memorySafetyGovernor";
import { runCognitionValidation, getLastValidationReport, getCognitionCertification, type CognitionValidationReport } from "@/ai/cognition/cognitionValidator";
import { getOrchestratorReport, type OrchestratorReport } from "@/ai/cognition/cognitiveExecutionOrchestrator";
import { getPromptSynthesisReport, type SynthesisOutput } from "@/ai/cognition/promptSynthesisEngine";
import { getResponseAnalysisPipelineReport, type ResponseAnalysis } from "@/ai/cognition/responseAnalysisPipeline";
import { getMemoryExtractionReport } from "@/ai/cognition/memoryExtractionEngine";
import { getGoalThreadReport, type GoalThreadReport } from "@/ai/cognition/goalThreadTracker";
import { getEmotionalContinuityReport, type EmotionalContinuityReport } from "@/ai/cognition/emotionalContinuityEngine";
import { getContextInjectionReport, type ContextInjectionReport } from "@/ai/cognition/continuousContextInjector";
import { getCognitionFeedbackLoopReport } from "@/ai/cognition/cognitionFeedbackLoop";
import { getSemanticMemoryReport, type SemanticMemoryReport } from "@/ai/cognition/semanticMemoryEngine";
import { runCoherenceValidation, getLastCoherenceReport, type CoherenceReport } from "@/ai/cognition/cognitiveCoherenceValidator";
import { computeWellnessTrajectory, getWellnessTrajectory, type WellnessTrajectory } from "@/ai/wellness/wellnessTrajectoryEngine";
import { predictDisengagement, getDisengagementPrediction, type DisengagementPrediction } from "@/ai/wellness/disengagementPredictor";
import { detectRecoveryOpportunities, getRecoveryOpportunityReport, type RecoveryOpportunityReport } from "@/ai/wellness/recoveryOpportunityDetector";
import { getCoachingEngineReport, calibrateCoachingStyle, resetCoachingCalibration, type CoachingEngineReport } from "@/ai/coaching/adaptiveCoachingEngine";
import { evaluateInterventionTiming, getTimingEngineReport } from "@/ai/wellness/interventionTimingEngine";
import { synthesizeProactiveInsights, getInsightSynthesisReport, type InsightSynthesisReport } from "@/ai/wellness/proactiveInsightSynthesizer";
import { runWellnessSafetyAudit, getWellnessSafetyReport, type SafetyAuditReport } from "@/ai/wellness/wellnessSafetyGovernor";
import { computeLongitudinalPatternGraph, getPatternGraphReport } from "@/ai/wellness/longitudinalPatternGraph";
import { runProactiveCognitionLoop, getProactiveCognitionReport, type ProactiveCognitionReport } from "@/ai/cognition/proactiveCognitionLoop";
import { runWellnessIntelligenceValidation, getLastWellnessValidationReport, type WellnessValidationReport } from "@/ai/wellness/wellnessIntelligenceValidator";
import { getAssistantStateReport, syncAssistantState, resetAssistantState, type AssistantStateReport } from "@/ai/assistant/assistantStateModel";
import { getSurfaceBehaviorProfile, type AssistantSurface } from "@/ai/assistant/contextualBehaviorEngine";
import { getDeliveryEngineReport, getPendingItems, refreshDeliveryQueue } from "@/ai/assistant/proactiveDeliveryEngine";
import { runConsistencyValidation, getLastConsistencyReport, type ConsistencyValidationReport } from "@/ai/assistant/assistantConsistencyValidator";
import { getAssistantOrchestratorReport } from "@/ai/assistant/unifiedAssistantOrchestrator";
import { generateProductionReadinessReport, getLastProductionReport, type ProductionReadinessReport } from "@/ai/production/productionReadinessReport";
import { getInferenceBridgeReport, runBypassAudit } from "@/ai/production/productionInferenceBridge";
import { getEmbeddingAdapterReport, semanticCluster, getLastClusters, type SemanticCluster } from "@/ai/memory/semanticEmbeddingAdapter";
import { runLongSessionCheck, getLastSessionStabilityReport, type SessionStabilityReport } from "@/ai/cognition/longSessionStabilityGuard";
import { getMobileHardenerReport, initMobileHardener, type MobileHardenerReport } from "@/ai/platform/mobileExecutionHardener";
import { getPsychologicalSafetyStatus, runFullSafetyAudit } from "@/ai/assistant/psychologicalSafetyRuntime";
import { getAllSurfaceSignals, type SurfaceCognitionSignal } from "@/ai/assistant/uiCognitionIntegrationLayer";
import { runOfflineDeploymentValidation, getLastDeploymentReport, type DeploymentValidationReport } from "@/ai/production/offlineDeploymentValidator";
import { getUnifiedContextReport } from "@/ai/cognition/unifiedContextAssembler";
import {
  validateEmbeddingCapabilities,
  runEmbeddingDiagnostics,
  getEmbeddingMetrics,
  type EmbeddingDiagnosticResult,
  type EmbeddingCapabilityReport,
} from "@/ai/embeddings/embeddingPipeline";
import { getInterventionCalibrationStatus } from "@/ai/wellness/wellnessSafetyGovernor";
import { isEmotionalOverfittingActive } from "@/ai/cognition/longSessionStabilityGuard";
import { conceptualRecall } from "@/ai/memory/semanticEmbeddingAdapter";
import { retrieveMemory } from "@/ai/memory/memoryHierarchy";

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
        const { serializeSummaryForPrompt: _ssp, getLongitudinalSummary: _gls, generateLongitudinalSummary } = await import("@/ai/memory/longitudinalSummary");
        let summary = _gls();
        if (!summary) summary = generateLongitudinalSummary();
        const summaryText = summary ? _ssp(summary) : "";
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
              {profilerSnap.memory && (
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Heap pressure</p>
                  <p className={cn(
                    "font-mono text-[11px]",
                    profilerSnap.memory.ratio > 0.85 ? "text-red-500" :
                    profilerSnap.memory.ratio > 0.7 ? "text-amber-500" :
                    "text-emerald-600",
                  )}>
                    {profilerSnap.memory.ratio > 0.85 ? "high" : profilerSnap.memory.ratio > 0.7 ? "moderate" : "low"} ({(profilerSnap.memory.ratio * 100).toFixed(0)}%)
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                <p className="text-muted-foreground">Sample count</p>
                <p className="font-mono text-foreground/70">{profilerSnap.totalProfiled}</p>
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
    const longitudinalSummary = getLongitudinalSummary();
    const summaryText = longitudinalSummary ? serializeSummaryForPrompt(longitudinalSummary) : null;
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

// ── Phase 15 Cards ────────────────────────────────────────────────────────────

function WorkerExecutionCard() {
  const [state, setState] = React.useState(getInferenceWorkerBridgeState);
  const [booting, setBooting] = React.useState(false);

  React.useEffect(() => {
    return subscribeToInferenceWorkerBridge(() => setState(getInferenceWorkerBridgeState()));
  }, []);

  const statusColor = (s: InferenceSlotSnapshot["status"]) => {
    const map: Record<typeof s, string> = {
      idle: "text-emerald-600", busy: "text-blue-600", spawning: "text-yellow-600",
      crashed: "text-red-600", recovering: "text-orange-500",
    };
    return map[s] ?? "text-foreground";
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Worker Execution Inspector</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-3 gap-2">
          <div><p className="text-muted-foreground">Slots</p><p className="font-mono">{state.slots.length}</p></div>
          <div><p className="text-muted-foreground">Queue</p><p className="font-mono">{state.queueDepth}</p></div>
          <div><p className="text-muted-foreground">Inferences</p><p className="font-mono">{state.totalInferences}</p></div>
        </div>
        <div className="space-y-1">
          {state.slots.map((slot) => (
            <div key={slot.slotId} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
              <span className="font-mono text-[11px]">{slot.slotId}</span>
              <div className="flex gap-2 items-center">
                {slot.supportsSab && <StatusBadge ok label="SAB" />}
                <span className={cn("font-semibold", statusColor(slot.status))}>{slot.status}</span>
                {slot.crashCount > 0 && <span className="text-red-500 text-[10px]">×{slot.crashCount} crash</span>}
              </div>
            </div>
          ))}
        </div>
        {!state.initialized && (
          <Button size="sm" variant="outline" onClick={() => { initInferenceWorkerBridge(); setState(getInferenceWorkerBridgeState()); }}>
            Init Worker Bridge
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SabStreamingCard() {
  const [coopCoep, setCoopCoep] = React.useState<CoopCoepStatus>(getCoopCoepStatus);
  const [streamStats, setStreamStats] = React.useState<SabStreamStats>(getSabStreamStats);

  React.useEffect(() => {
    const interval = setInterval(() => setStreamStats(getSabStreamStats()), 1000);
    return () => clearInterval(interval);
  }, []);

  const gateColor = coopCoep.sabDeploymentGate === "open" ? "text-emerald-600" : "text-amber-600";

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">SAB Streaming Visualizer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Isolation</p><StatusBadge ok={coopCoep.crossOriginIsolated} label={coopCoep.isolationMode} /></div>
          <div><p className="text-muted-foreground">SAB Gate</p><p className={cn("font-mono", gateColor)}>{coopCoep.sabDeploymentGate}</p></div>
          <div><p className="text-muted-foreground">Active Channels</p><p className="font-mono">{streamStats.activeChannels}</p></div>
          <div><p className="text-muted-foreground">SAB Mode</p><p className="font-mono">{streamStats.sabModeChannels}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Tokens Delivered</p><p className="font-mono">{streamStats.totalTokensDelivered}</p></div>
          <div><p className="text-muted-foreground">Fallback Tokens</p><p className="font-mono text-amber-600">{streamStats.totalFallbackTokens}</p></div>
        </div>
        {streamStats.averageDrainLatencyMs !== null && (
          <p className="text-muted-foreground">Ring drain latency: <span className="font-mono text-foreground">{streamStats.averageDrainLatencyMs.toFixed(2)}ms avg</span></p>
        )}
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{coopCoep.deploymentGuidance}</p>
        <Button size="sm" variant="outline" onClick={() => setCoopCoep(verifyCoopCoep())}>
          Re-verify Isolation
        </Button>
      </CardContent>
    </Card>
  );
}

function ThreadedExecutionMonitorCard() {
  const [bootStatus, setBootStatus] = React.useState<ThreadedBootStatus>(getThreadedBootStatus);
  const [booting, setBooting] = React.useState(false);

  const stageBadge = (s: ThreadedBootStageResult) => {
    const color = s.status === "complete" ? "text-emerald-600" : s.status === "failed" ? "text-red-600" : s.status === "skipped" ? "text-muted-foreground" : "text-blue-600";
    return <span className={cn("font-mono text-[10px]", color)}>{s.status}</span>;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Threaded Execution Monitor</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {bootStatus.blockingReason && (
          <p className="text-amber-600 bg-amber-50 rounded px-2 py-1 text-[11px]">{bootStatus.blockingReason}</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div><p className="text-muted-foreground">Attempts</p><p className="font-mono">{bootStatus.totalAttempts}</p></div>
          <div><p className="text-muted-foreground">Successes</p><p className="font-mono">{bootStatus.successfulBoots}</p></div>
          <div><p className="text-muted-foreground">Avg Boot</p><p className="font-mono">{bootStatus.averageBootMs ? `${bootStatus.averageBootMs.toFixed(0)}ms` : "—"}</p></div>
        </div>
        {bootStatus.lastSession && (
          <div className="space-y-1 border-t border-border/30 pt-2">
            <p className="text-muted-foreground font-medium">Last Boot Stages</p>
            {bootStatus.lastSession.stages.map((s) => (
              <div key={s.stage} className="flex justify-between items-center">
                <span className="font-mono">{s.stage}</span>
                <div className="flex gap-2">{stageBadge(s)}{s.durationMs !== null && <span className="text-muted-foreground">{s.durationMs}ms</span>}</div>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" disabled={booting} onClick={async () => {
          setBooting(true);
          await runThreadedBoot();
          setBootStatus(getThreadedBootStatus());
          setBooting(false);
        }}>
          {booting ? "Booting…" : "Run Boot Sequence"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InferenceSlotTopologyCard() {
  const [state, setState] = React.useState(getInferenceWorkerBridgeState);

  React.useEffect(() => {
    return subscribeToInferenceWorkerBridge(() => setState(getInferenceWorkerBridgeState()));
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Inference Slot Topology</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="flex gap-2 flex-wrap">
          {state.slots.map((slot) => {
            const busy = slot.status === "busy";
            const crashed = slot.status === "crashed" || slot.status === "recovering";
            return (
              <div key={slot.slotId} className={cn(
                "rounded-lg px-3 py-2 border text-center min-w-[80px]",
                busy ? "border-blue-400 bg-blue-50" : crashed ? "border-red-400 bg-red-50" : "border-border bg-muted/20"
              )}>
                <p className="font-mono text-[10px] font-semibold">{slot.slotId}</p>
                <p className={cn("text-[10px] font-medium mt-0.5",
                  busy ? "text-blue-600" : crashed ? "text-red-600" : "text-emerald-600"
                )}>{slot.status}</p>
                <p className="text-muted-foreground text-[9px] mt-0.5">{slot.inferenceCount} inf</p>
                {slot.supportsSab && <p className="text-[9px] text-emerald-500 mt-0.5">SAB</p>}
              </div>
            );
          })}
          {state.slots.length === 0 && <p className="text-muted-foreground">No slots initialized</p>}
        </div>
        <div className="border-t border-border/30 pt-2 grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Queue depth</p><p className="font-mono">{state.queueDepth}</p></div>
          <div><p className="text-muted-foreground">Total crashes</p><p className="font-mono text-red-500">{state.totalCrashes}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuantizationRoutingCard() {
  const [decision, setDecision] = React.useState<RoutingDecision | null>(null);
  const [profiles] = React.useState<QuantizationProfile[]>(getQuantizationProfiles);

  React.useEffect(() => { setDecision(getRoutingDecision()); }, []);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Quantization Routing Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {decision && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Selected</p><StatusBadge ok label={decision.selected} /></div>
              <div><p className="text-muted-foreground">Fallback</p><p className="font-mono">{decision.fallback}</p></div>
              <div><p className="text-muted-foreground">Thermal</p><p className="font-mono">{decision.thermalState}</p></div>
              <div><p className="text-muted-foreground">RAM (GB)</p><p className="font-mono">{decision.availableRamGb ?? "?"}</p></div>
            </div>
            <p className="text-[11px] text-muted-foreground">{decision.routingReason}</p>
            <div className="space-y-1 border-t border-border/30 pt-2">
              <p className="text-muted-foreground font-medium">Suitability Scores</p>
              {decision.suitabilityScores.map((s) => (
                <div key={s.profileId} className="flex justify-between items-center">
                  <span className="font-mono">{s.profileId}</span>
                  <div className="flex gap-2 items-center">
                    {s.disqualifyReason ? <span className="text-red-500 text-[10px]">{s.disqualifyReason}</span> :
                      <span className={cn("text-[10px]", s.score > 70 ? "text-emerald-600" : s.score > 40 ? "text-yellow-600" : "text-red-500")}>{s.score}/100</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => setDecision(getRoutingDecision())}>
          Refresh Routing
        </Button>
      </CardContent>
    </Card>
  );
}

function KvCacheDiagnosticsCard() {
  const [report, setReport] = React.useState<KvCacheReport>(getKvCacheReport);

  React.useEffect(() => {
    const interval = setInterval(() => setReport(getKvCacheReport()), 2000);
    return () => clearInterval(interval);
  }, []);

  const pressureColor = report.pressureLevel === "critical" ? "text-red-600" : report.pressureLevel === "high" ? "text-orange-500" : report.pressureLevel === "moderate" ? "text-yellow-600" : "text-emerald-600";

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">KV-Cache Diagnostics</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Pressure</p><p className={cn("font-mono font-semibold", pressureColor)}>{report.pressureLevel} ({report.contextPressurePct}%)</p></div>
          <div><p className="text-muted-foreground">Model Tier</p><p className="font-mono">{report.modelTier}</p></div>
          <div><p className="text-muted-foreground">Tokens Used</p><p className="font-mono">{report.tokensUsed} / {report.nCtx}</p></div>
          <div><p className="text-muted-foreground">Cache Size</p><p className="font-mono">{(report.estimatedCacheSizeBytes / (1024 * 1024)).toFixed(1)} MB</p></div>
          <div><p className="text-muted-foreground">Recommended nCtx</p><p className="font-mono">{report.recommendedNCtx}</p></div>
          <div><p className="text-muted-foreground">Evictions</p><p className="font-mono">{report.cacheEvictionEvents}</p></div>
        </div>
        <div className="flex gap-3">
          {report.fragmentationSuspected && <StatusBadge ok={false} label="fragmented" />}
          {report.longSession && <StatusBadge ok={false} label="long session" />}
          {report.shrinkReason !== "none" && <StatusBadge ok={false} label={report.shrinkReason} />}
        </div>
        <Button size="sm" variant="outline" onClick={() => { clearKvCacheState(); setReport(getKvCacheReport()); }}>
          Clear Cache State
        </Button>
      </CardContent>
    </Card>
  );
}

function NativeFilesystemInspectorCard() {
  const [report, setReport] = React.useState<NativeFilesystemReport | null>(null);
  const [benchmarking, setBenchmarking] = React.useState(false);

  React.useEffect(() => {
    getNativeFilesystemReport().then(setReport).catch(() => null);
  }, []);

  const tierColor = report?.tier === "native_capacitor" ? "text-emerald-600" : report?.tier === "opfs" ? "text-blue-600" : "text-amber-600";
  const pressureColor = report?.storagePressure === "critical" ? "text-red-600" : report?.storagePressure === "high" ? "text-orange-500" : "text-foreground";

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Native Filesystem Inspector</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {report ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Tier</p><p className={cn("font-mono font-semibold", tierColor)}>{report.tier}</p></div>
              <div><p className="text-muted-foreground">Activation</p><p className="font-mono">{report.activationState}</p></div>
              <div><p className="text-muted-foreground">Storage Pressure</p><p className={cn("font-mono", pressureColor)}>{report.storagePressure}</p></div>
              <div><p className="text-muted-foreground">Atomic Write</p><StatusBadge ok={report.atomicWriteSupported} label={report.atomicWriteSupported ? "yes" : "no"} /></div>
            </div>
            {report.availableBytes !== null && (
              <p className="text-muted-foreground">Available: <span className="font-mono text-foreground">{(report.availableBytes / (1024 * 1024 * 1024)).toFixed(2)} GB</span></p>
            )}
            {report.activeModelId && <p className="text-muted-foreground">Active model: <span className="font-mono text-foreground">{report.activeModelId}</span></p>}
            {report.benchmark && (
              <div className="border-t border-border/30 pt-2 grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground">Write Speed</p><p className="font-mono">{report.benchmark.writeSpeedMbps} MB/s</p></div>
                <div><p className="text-muted-foreground">Read Speed</p><p className="font-mono">{report.benchmark.readSpeedMbps} MB/s</p></div>
              </div>
            )}
          </>
        ) : <p className="text-muted-foreground">Loading…</p>}
        <Button size="sm" variant="outline" disabled={benchmarking} onClick={async () => {
          setBenchmarking(true);
          await benchmarkFilesystem();
          const r = await getNativeFilesystemReport();
          setReport(r);
          setBenchmarking(false);
        }}>
          {benchmarking ? "Benchmarking…" : "Run FS Benchmark"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DeploymentIsolationCard() {
  const [status, setStatus] = React.useState<CoopCoepStatus>(getCoopCoepStatus);
  const [nativeThermal, setNativeThermal] = React.useState<NativeThermalBatteryState>(getNativeThermalBatteryState);
  const [sampling, setSampling] = React.useState(false);

  const gateOk = status.sabDeploymentGate === "open";

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Deployment Isolation Diagnostics</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Isolation Mode</p><StatusBadge ok={status.crossOriginIsolated} label={status.isolationMode} /></div>
          <div><p className="text-muted-foreground">SAB Gate</p><StatusBadge ok={gateOk} label={status.sabDeploymentGate} /></div>
          <div><p className="text-muted-foreground">Secure Context</p><StatusBadge ok={status.isSecureContext} label={status.isSecureContext ? "yes" : "no"} /></div>
          <div><p className="text-muted-foreground">Local Dev</p><StatusBadge ok={!status.isLocalDev} label={status.isLocalDev ? "yes" : "no"} /></div>
        </div>
        <div className="border-t border-border/30 pt-2 space-y-1">
          <p className="text-muted-foreground font-medium">Native Thermal/Battery</p>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-muted-foreground">Thermal</p><p className="font-mono">{nativeThermal.thermalState} ({nativeThermal.thermalSource})</p></div>
            <div><p className="text-muted-foreground">Battery</p><p className="font-mono">{nativeThermal.batteryLevel}% {nativeThermal.isCharging ? "⚡" : ""}</p></div>
          </div>
          <p className="text-muted-foreground">Policy: <span className="font-mono text-foreground">{nativeThermal.chargingPolicy.recommended}</span> — {nativeThermal.chargingPolicy.reason}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{status.deploymentGuidance}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStatus(verifyCoopCoep())}>
            Re-verify
          </Button>
          <Button size="sm" variant="outline" disabled={sampling} onClick={async () => {
            setSampling(true);
            setNativeThermal(await sampleNativeThermalBattery());
            setSampling(false);
          }}>
            {sampling ? "Sampling…" : "Sample Thermal"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuntimeValidationCard() {
  const [report, setReport] = React.useState<RuntimeValidationReport | null>(getRuntimeValidationReport);
  const [running, setRunning] = React.useState(false);

  const statusColor = (s: ValidationResult["status"]) => ({
    pass: "text-emerald-600", fail: "text-red-600", warning: "text-yellow-600", skipped: "text-muted-foreground"
  }[s]);

  const certColor = (level: string) => ({
    production: "text-emerald-600", standard: "text-blue-600", basic: "text-yellow-600", none: "text-red-600"
  }[level] ?? "text-foreground");

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Runtime Validation Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {report ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              <div><p className="text-muted-foreground">Pass</p><p className="font-mono text-emerald-600">{report.passCount}</p></div>
              <div><p className="text-muted-foreground">Warn</p><p className="font-mono text-yellow-600">{report.warningCount}</p></div>
              <div><p className="text-muted-foreground">Fail</p><p className="font-mono text-red-600">{report.failCount}</p></div>
              <div><p className="text-muted-foreground">Skip</p><p className="font-mono">{report.skippedCount}</p></div>
            </div>
            <p className="text-muted-foreground">Certification: <span className={cn("font-semibold", certColor(report.certificationLevel))}>{report.certificationLevel}</span></p>
            <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
              {report.results.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-0.5">
                  <span className="truncate max-w-[140px]">{r.name}</span>
                  <div className="flex gap-2">
                    <span className={cn("text-[10px] font-mono", statusColor(r.status))}>{r.status}</span>
                    <span className="text-[10px] text-muted-foreground">{r.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-muted-foreground">No validation report yet</p>}
        <Button size="sm" variant="outline" disabled={running} onClick={async () => {
          setRunning(true);
          const r = await runValidationSuite();
          setReport(r);
          setRunning(false);
        }}>
          {running ? "Running…" : "Run Validation Suite"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ExecutionReadinessCard() {
  const [score, setScore] = React.useState(getDeploymentReadinessScore);
  const [contracts, setContracts] = React.useState<ContractSatisfactionMap>(getAllContractSatisfaction);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setScore(getDeploymentReadinessScore());
      setContracts(getAllContractSatisfaction());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scoreColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const scoreLabel = score >= 80 ? "Production Ready" : score >= 60 ? "Standard" : score >= 40 ? "Basic" : "Not Ready";

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Execution Readiness Scorecard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className={cn("text-4xl font-bold font-mono", scoreColor)}>{score}</p>
            <p className="text-muted-foreground text-[10px]">/ 100</p>
          </div>
          <div>
            <p className={cn("text-lg font-semibold", scoreColor)}>{scoreLabel}</p>
            <p className="text-muted-foreground text-[11px]">Composite execution readiness</p>
          </div>
        </div>
        <div className="w-full bg-muted/30 rounded-full h-2">
          <div className={cn("h-2 rounded-full", score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500")}
            style={{ width: `${score}%` }} />
        </div>
        <div className="border-t border-border/30 pt-2 space-y-1">
          <p className="text-muted-foreground font-medium">Background Contract Readiness</p>
          {Object.entries(contracts).map(([jobType, sat]) => (
            <div key={jobType} className="flex justify-between">
              <span className="font-mono text-[10px]">{jobType}</span>
              <span className={sat.ok ? "text-emerald-600 text-[10px]" : "text-amber-500 text-[10px]"}>
                {sat.ok ? "ready" : sat.reason ?? "not ready"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Wasm Runtime Card (Phase 14) ─────────────────────────────────────────────

function WasmRuntimeCard() {
  const [cap, setCap] = React.useState<WasmRuntimeCapabilitySummary | null>(null);
  const [sab, setSab] = React.useState<SabMemoryReport | null>(null);
  const [gpuReport, setGpuReport] = React.useState<WebGpuCapabilityReport | null>(null);
  const [loadingGpu, setLoadingGpu] = React.useState(false);

  React.useEffect(() => {
    setCap(getWasmRuntimeCapability());
    setSab(getSabMemoryReport());
    const sync = getWebGpuCapabilitySync();
    if (sync) setGpuReport(sync);
  }, []);

  async function runGpuAudit() {
    setLoadingGpu(true);
    try { setGpuReport(await assessWebGpuCapability(true)); } finally { setLoadingGpu(false); }
  }

  const execTier = resolveInferenceExecutionTier();

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">WASM Runtime + GPU</CardTitle>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={runGpuAudit} disabled={loadingGpu}>
          {loadingGpu ? "…" : "GPU Audit"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Execution tier</span>
          <StatusBadge ok={execTier === "gpu" || execTier === "threaded_cpu"} label={execTier.replace(/_/g, " ")} />
        </div>
        {cap && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WASM mode</span>
              <StatusBadge ok={cap.activeMode === "threaded"} label={cap.activeMode.replace(/_/g, " ")} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SAB allocatable</span>
              <StatusBadge ok={cap.sabAllocatable} label={cap.sabAllocatable ? "yes" : "no"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended threads</span>
              <span className="font-mono">{cap.recommendedThreadCount}</span>
            </div>
            {cap.fallbackReason && (
              <p className="text-[10px] text-muted-foreground/55 border-t border-border/15 pt-1">{cap.fallbackReason}</p>
            )}
          </>
        )}
        {sab && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">SAB Memory</p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Allocations</span>
              <span className="font-mono">{sab.totalAllocations} ({Math.round(sab.totalBytes / 1024)}KB)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Memory pressure</span>
              <StatusBadge ok={sab.memoryPressure === "low"} label={sab.memoryPressure} />
            </div>
          </div>
        )}
        {gpuReport && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">WebGPU</p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Eligibility</span>
              <StatusBadge ok={gpuReport.eligibility === "eligible"} label={gpuReport.eligibility.replace(/_/g, " ")} />
            </div>
            {gpuReport.adapterName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Adapter</span>
                <span className="font-mono truncate max-w-[140px]">{gpuReport.adapterName}</span>
              </div>
            )}
            {gpuReport.eligibility === "eligible" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">float16 / timestamp</span>
                <span className="font-mono">{gpuReport.features.float16 ? "f16" : "no-f16"} / {gpuReport.features.timestampQuery ? "ts" : "no-ts"}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Thread Scaler Card (Phase 14) ─────────────────────────────────────────────

function ThreadScalerCard() {
  const [decision, setDecision] = React.useState<ThreadScaleDecision | null>(null);
  const [history, setHistory] = React.useState<ReturnType<typeof getThreadScaleHistory>>([]);

  React.useEffect(() => {
    function refresh() {
      setDecision(computeThreadScaleDecision());
      setHistory(getThreadScaleHistory().slice(-6).reverse());
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Adaptive Thread Scaler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {decision ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended threads</span>
              <span className="font-mono">{decision.recommendedThreads} / {decision.maxPossibleThreads}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scaling factor</span>
              <span className="font-mono">{Math.round(decision.scalingFactor * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Primary reason</span>
              <StatusBadge ok={decision.primaryReason === "hardware_ceiling"} label={decision.primaryReason.replace(/_/g, " ")} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Policy / Thermal</span>
              <span className="font-mono">{decision.policyMode} / {decision.thermalState}</span>
            </div>
            {history.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Efficiency samples</p>
                {history.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-muted-foreground/60">{s.threads}t / {s.thermalState}</span>
                    <span className="font-mono">{s.tokPerSec.toFixed(1)} tok/s</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : <p className="text-muted-foreground/50">Computing…</p>}
      </CardContent>
    </Card>
  );
}

// ── Memory Governor Card (Phase 14) ──────────────────────────────────────────

function MemoryGovernorCard() {
  const [report, setReport] = React.useState<MemoryGovernorReport | null>(null);

  React.useEffect(() => {
    function refresh() { setReport(getMemoryGovernorReport()); }
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  const budget = getContextBudget();

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Memory Governor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {report ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Memory tier</span>
              <StatusBadge ok={report.currentTier === "unconstrained" || report.currentTier === "comfortable"} label={report.currentTier} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device RAM</span>
              <span className="font-mono">{report.deviceRamGb !== null ? `${report.deviceRamGb}GB` : "unknown"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Heap estimate</span>
              <span className="font-mono">{report.estimatedHeapMb !== null ? `${Math.round(report.estimatedHeapMb)}MB` : "unavailable"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended n_ctx</span>
              <span className="font-mono">{budget.recommendedNCtx}</span>
            </div>
            {budget.reductionReason && (
              <p className="text-[10px] text-muted-foreground/55">Reduced: {budget.reductionReason}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fragmentation</span>
              <StatusBadge ok={!report.fragmentation} label={report.fragmentation ? "detected" : "clean"} />
            </div>
          </>
        ) : <p className="text-muted-foreground/50">Loading…</p>}
      </CardContent>
    </Card>
  );
}

// ── Throughput Profiler Card (Phase 14) ───────────────────────────────────────

function ThroughputProfilerCard() {
  const [summary, setSummary] = React.useState<ThroughputSummary | null>(null);

  React.useEffect(() => {
    function refresh() { setSummary(getThroughputSummary()); }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const timeline = getInferenceTimeline(6);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Throughput Profiler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {summary && summary.totalSamples > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device class</span>
              <StatusBadge ok={summary.deviceClass === "high_end" || summary.deviceClass === "mid_range"} label={summary.deviceClass.replace(/_/g, " ")} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg / Peak tok/s</span>
              <span className="font-mono">{summary.avgTokPerSec.toFixed(1)} / {summary.peakTokPerSec.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sustained tok/s</span>
              <span className="font-mono">{summary.sustainedTokPerSec.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Degradation</span>
              <StatusBadge ok={summary.degradationPct < 20} label={`${summary.degradationPct.toFixed(0)}%`} />
            </div>
            {summary.latencyPercentiles && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">P50 / P90 / P99</span>
                <span className="font-mono">{summary.latencyPercentiles.p50Ms}ms / {summary.latencyPercentiles.p90Ms}ms / {summary.latencyPercentiles.p99Ms}ms</span>
              </div>
            )}
            {timeline.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Timeline</p>
                {timeline.map((e) => (
                  <div key={e.sampleId} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground/60">#{e.sessionIndex} {e.thermalState}</span>
                    <span className="font-mono">{e.tokPerSec.toFixed(1)}t/s {e.durationMs}ms</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : <p className="text-muted-foreground/50">No samples yet — run an inference first</p>}
      </CardContent>
    </Card>
  );
}

// ── Hardware Characterizer Card (Phase 14) ────────────────────────────────────

function HardwareCharacterizerCard() {
  const [hw, setHw] = React.useState<HardwareCharacterization | null>(null);

  React.useEffect(() => {
    function refresh() { setHw(getHardwareCharacterization()); }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const trendLog = getThermalTrendLog().slice(-6).reverse();

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Hardware Characterizer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {hw ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Thermal trend</span>
              <StatusBadge ok={hw.thermalTrend !== "heating"} label={hw.thermalTrend} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Peak thermal (session)</span>
              <StatusBadge ok={hw.peakThermalState === "nominal" || hw.peakThermalState === "warm"} label={hw.peakThermalState} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cooldown estimate</span>
              <span className="font-mono">{hw.estimatedCooldownMs !== null ? `${Math.round(hw.estimatedCooldownMs / 1000)}s` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Energy/inference</span>
              <span className="font-mono">{hw.estimatedInferenceEnergyMah !== null ? `${hw.estimatedInferenceEnergyMah.toFixed(2)}mAh` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Heavy session risk</span>
              <StatusBadge ok={!hw.heavySessionRisk} label={hw.heavySessionRisk ? "yes" : "no"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Session inferences</span>
              <span className="font-mono">{hw.sessionInferences} ({hw.inferencesPerMin.toFixed(1)}/min)</span>
            </div>
            {trendLog.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Thermal log</p>
                {trendLog.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <StatusBadge ok={p.state === "nominal" || p.state === "warm"} label={p.state} />
                    <span className="font-mono text-muted-foreground/50">{p.inferencesPerMin.toFixed(1)}/min</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : <p className="text-muted-foreground/50">Loading…</p>}
      </CardContent>
    </Card>
  );
}

// ── Native Plugin Contracts Card (Phase 14) ───────────────────────────────────

function NativePluginContractsCard() {
  const [plugins, setPlugins] = React.useState<PluginAvailabilityMap | null>(null);

  React.useEffect(() => { setPlugins(getPluginAvailability()); }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Native Plugin Contracts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {plugins ? (
          Object.entries(plugins).map(([name, available]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-muted-foreground capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
              <StatusBadge ok={available} label={available ? "native" : "stub"} />
            </div>
          ))
        ) : <p className="text-muted-foreground/50">Loading…</p>}
      </CardContent>
    </Card>
  );
}

// ── Performance Lab Card (Phase 14) ──────────────────────────────────────────

function PerformanceLabCard() {
  const [pressure, setPressure] = React.useState<RuntimePressureSnapshot | null>(null);
  const sustained = getSustainedLoadProfile();

  React.useEffect(() => {
    function refresh() { setPressure(computeRuntimePressure()); }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Performance Lab</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {pressure && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Runtime pressure</span>
              <StatusBadge ok={pressure.label === "nominal" || pressure.label === "elevated"} label={`${pressure.score}/100 ${pressure.label}`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Thermal / Battery / Memory</span>
              <span className="font-mono">{pressure.components.thermal} / {pressure.components.battery} / {pressure.components.memory}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Throughput / Threads</span>
              <span className="font-mono">{pressure.components.throughput} / {pressure.components.threads}</span>
            </div>
            <div className="border-t border-border/15 pt-2 space-y-1">
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Sustained load</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Session duration</span>
                <span className="font-mono">{sustained.durationMinutes}min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Inferences run</span>
                <span className="font-mono">{sustained.inferencesRun}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peak thermal</span>
                <StatusBadge ok={sustained.peakThermal === "nominal" || sustained.peakThermal === "warm"} label={sustained.peakThermal} />
              </div>
              {sustained.pressureProgression.length > 0 && (
                <div className="flex items-center gap-1 pt-1 overflow-hidden">
                  {sustained.pressureProgression.map((p, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded"
                      style={{
                        height: `${Math.max(2, (p / 100) * 20)}px`,
                        background: p < 25 ? "rgb(34 197 94 / 0.4)" : p < 50 ? "rgb(234 179 8 / 0.4)" : "rgb(239 68 68 / 0.4)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Threaded Runtime Card ─────────────────────────────────────────────────────

function ThreadedRuntimeCard() {
  const [cap, setCap] = React.useState<ThreadingCapability | null>(null);
  const [pool, setPool] = React.useState<PoolMetrics | null>(null);

  React.useEffect(() => {
    function refresh() {
      setCap(getThreadingCapability());
      setPool(getPoolMetrics());
    }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Threaded Runtime</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {cap ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Threading mode</span>
              <StatusBadge ok={cap.mode === "multi_thread_eligible"} label={cap.mode.replace(/_/g, " ")} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SharedArrayBuffer</span>
              <StatusBadge ok={cap.sharedArrayBufferAvailable} label={cap.sharedArrayBufferAvailable ? "available" : "blocked"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">crossOriginIsolated</span>
              <StatusBadge ok={cap.crossOriginIsolated} label={String(cap.crossOriginIsolated)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hardware threads</span>
              <span className="font-mono">{cap.hardwareConcurrency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recommended threads</span>
              <span className="font-mono">{cap.recommendedThreadCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Browser compat</span>
              <StatusBadge ok={cap.browserCompatibility === "full"} label={cap.browserCompatibility} />
            </div>
            {cap.degradationReason && (
              <p className="text-[10px] text-muted-foreground/60 border-t border-border/15 pt-2">{cap.degradationReason}</p>
            )}
            {pool && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Inference Pool</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Slots (idle/busy/crashed)</span>
                  <span className="font-mono">{pool.idleSlots}/{pool.busySlots}/{pool.crashedSlots}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-mono">{Math.round(pool.utilization * 100)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed / Failed</span>
                  <span className="font-mono">{pool.totalCompleted} / {pool.totalFailed}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">Assessing…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Worker Topology Card ──────────────────────────────────────────────────────

function WorkerTopologyCard() {
  const [snap, setSnap] = React.useState<TopologySnapshot | null>(null);
  const [queues, setQueues] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    function refresh() {
      setSnap(getTopologySnapshot());
      setQueues(getQueueDepthByRole());
    }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Worker Topology</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {snap ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Backpressure</span>
              <StatusBadge ok={!snap.backpressureActive} label={snap.backpressureActive ? `active (${snap.backpressureRole})` : "none"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg utilization</span>
              <span className="font-mono">{Math.round(snap.avgUtilization * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total queue depth</span>
              <span className="font-mono">{snap.totalQueueDepth}</span>
            </div>
            {Object.entries(queues).map(([role, depth]) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-muted-foreground/70">{role}</span>
                <span className="font-mono text-muted-foreground/70">queue={depth}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border/15 pt-2">
              <span className="text-muted-foreground">Completed / Failed</span>
              <span className="font-mono">{snap.totalCompleted} / {snap.totalFailed}</span>
            </div>
            {snap.nodes.length > 0 && (
              <div className="space-y-1 border-t border-border/15 pt-2">
                {snap.nodes.slice(0, 6).map((n) => (
                  <div key={n.nodeId} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground/60 truncate">{n.role}:{n.nodeId.slice(-4)}</span>
                    <StatusBadge ok={n.status === "idle" || n.status === "busy"} label={`${n.status} ${Math.round(n.utilization * 100)}%`} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">No topology data</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Native Lifecycle Card ─────────────────────────────────────────────────────

function NativeLifecycleCard() {
  const [snap, setSnap] = React.useState<NativeLifecycleSnapshot | null>(null);
  const [log, setLog] = React.useState<Array<{ event: string; ts: number }>>([]);

  React.useEffect(() => {
    initNativeLifecycle();
    function refresh() {
      setSnap(getNativeLifecycleSnapshot());
      setLog(getNativeLifecycleLog().slice(-8).reverse());
    }
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Native Lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {snap ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-mono">{snap.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">State</span>
              <StatusBadge ok={snap.state === "active"} label={snap.state} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Low power mode</span>
              <StatusBadge ok={!snap.lowPowerMode} label={snap.lowPowerMode ? "on" : "off"} />
            </div>
            {log.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Event log</p>
                {log.map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-muted-foreground/60">{e.event}</span>
                    <span className="font-mono text-muted-foreground/40">{new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">Initializing…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Secure Storage Card ───────────────────────────────────────────────────────

function SecureStorageCard() {
  const [entries, setEntries] = React.useState<SecureModelRegistryEntry[]>([]);
  const [verifying, setVerifying] = React.useState<string | null>(null);

  React.useEffect(() => { setEntries(getAllRegistryEntries()); }, []);

  async function verify(assetId: string) {
    setVerifying(assetId);
    try {
      await verifyIntegrityChain(assetId);
      setEntries(getAllRegistryEntries());
    } finally { setVerifying(null); }
  }

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Secure Model Store</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {entries.length === 0 ? (
          <p className="text-muted-foreground/50">No model assets registered</p>
        ) : (
          entries.map((e) => (
            <div key={e.assetId} className="border border-border/15 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground/80 truncate">{e.assetId.slice(0, 20)}</span>
                <StatusBadge ok={(e.lastChainResult?.trustScore ?? 0) >= 75} label={`trust=${e.lastChainResult?.trustScore ?? "—"}`} />
              </div>
              {e.activation && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground/60">activation</span>
                  <StatusBadge ok={e.activation.status === "active"} label={e.activation.status} />
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" disabled={verifying === e.assetId} onClick={() => void verify(e.assetId)}>
                {verifying === e.assetId ? "Verifying…" : "Verify chain"}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Runtime Telemetry Card ────────────────────────────────────────────────────

function RuntimeTelemetryCard() {
  const [summary, setSummary] = React.useState<TelemetrySummary | null>(null);
  const [recent, setRecent] = React.useState<TelemetryEvent[]>([]);

  React.useEffect(() => {
    function refresh() {
      setSummary(getTelemetrySummary());
      setRecent(getRecentTelemetry(6).reverse());
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Runtime Telemetry</CardTitle>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { clearTelemetry(); setSummary(getTelemetrySummary()); setRecent([]); }}>
          Clear
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {summary ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total events</span>
              <span className="font-mono">{summary.totalEvents}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-mono">{Math.round(summary.storageBytes / 1024)}KB</span>
            </div>
            {Object.entries(summary.byType).filter(([, n]) => n > 0).map(([type, n]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-muted-foreground/70">{type.replace(/_/g, " ")}</span>
                <StatusBadge ok={type === "streaming_optimizer"} label={String(n)} />
              </div>
            ))}
            {recent.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Recent</p>
                {recent.map((e) => (
                  <div key={e.eventId} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground/60 truncate">{e.type.replace(/_/g, " ")}</span>
                    <span className="font-mono text-muted-foreground/40">{new Date(e.occurredAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Fleet Diagnostics Card ────────────────────────────────────────────────────

function FleetDiagnosticsCard() {
  const [report, setReport] = React.useState<FleetDiagnosticsReport | null>(null);

  React.useEffect(() => {
    void getFleetDiagnosticsReport().then(setReport);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Fleet Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {report ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device ID</span>
              <span className="font-mono">{report.deviceFingerprint.fingerprintId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Capability tier</span>
              <StatusBadge ok={report.deviceFingerprint.capabilityTier === "tier_1" || report.deviceFingerprint.capabilityTier === "tier_2"} label={report.deviceFingerprint.capabilityTier} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cohort</span>
              <span className="font-mono">{report.cohort.cohortId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Health score</span>
              <StatusBadge ok={report.currentHealthScore >= 70} label={`${report.currentHealthScore}/100`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hardware concurrency</span>
              <span className="font-mono">{report.deviceFingerprint.hardwareConcurrency} cores</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Device RAM</span>
              <span className="font-mono">{report.deviceFingerprint.deviceMemoryGb !== null ? `${report.deviceFingerprint.deviceMemoryGb}GB` : "unknown"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SAB / COOP</span>
              <StatusBadge ok={report.runtimeEnvironment.sabAvailable && report.runtimeEnvironment.crossOriginIsolated} label={`${report.runtimeEnvironment.sabAvailable ? "SAB" : "no-SAB"} / ${report.runtimeEnvironment.crossOriginIsolated ? "isolated" : "not-isolated"}`} />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground/50">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Background Execution Card ─────────────────────────────────────────────────

function BackgroundExecutionCard() {
  const [state, setState] = React.useState<SchedulerState | null>(null);
  const [jobs, setJobs] = React.useState<NativeBackgroundJob[]>([]);

  React.useEffect(() => {
    function refresh() {
      setState(getSchedulerState());
      setJobs(getAllNativeJobs().slice(-5).reverse());
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Background Execution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {state ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scheduler backend</span>
              <StatusBadge ok={state.backend !== "none"} label={state.backend.replace(/_/g, " ")} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending / Deferred</span>
              <span className="font-mono">{state.pendingJobs} / {state.deferredJobs}</span>
            </div>
            {jobs.length > 0 && (
              <div className="border-t border-border/15 pt-2 space-y-1">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Recent jobs</p>
                {jobs.map((j) => (
                  <div key={j.jobId} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground/60 truncate">{j.label}</span>
                    <StatusBadge ok={j.status === "completed"} label={j.status} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Deployment Convergence Card ───────────────────────────────────────────────

function DeploymentConvergenceCard() {
  const [gates, setGates] = React.useState<FeatureGateState[]>([]);
  const rollout = getRolloutAssignment();
  const compat = checkBuildCompatibility();

  React.useEffect(() => { setGates(getAllFeatureGates()); }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Deployment Convergence</CardTitle>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { clearFeatureGateOverrides(); setGates(getAllFeatureGates()); }}>
          Reset gates
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Rollout bucket</span>
          <span className="font-mono">{rollout.rolloutPct}/100</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Channel</span>
          <span className="font-mono">{rollout.channel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Build compat</span>
          <StatusBadge ok={compat.compatible} label={compat.compatible ? "ok" : "mismatch"} />
        </div>
        <div className="border-t border-border/15 pt-2 space-y-1">
          <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">Feature gates</p>
          {gates.map((g) => (
            <div key={g.gateId} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground/70 truncate">{g.gateId.replace(/_/g, " ")}</span>
              <div className="flex items-center gap-1">
                <StatusBadge ok={g.enabled} label={g.enabled ? "on" : "off"} />
                <Button
                  variant="ghost" size="sm"
                  className="text-[9px] h-4 px-1.5"
                  onClick={() => { overrideFeatureGate(g.gateId as Parameters<typeof overrideFeatureGate>[0], !g.enabled); setGates(getAllFeatureGates()); }}
                >
                  flip
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Worker Bridge Card ────────────────────────────────────────────────────────

function WorkerBridgeCard() {
  const [status, setStatus] = React.useState<WorkerBridgeStatus | null>(null);

  React.useEffect(() => {
    function refresh() { setStatus(getWorkerBridgeStatus()); }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Worker Bridge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {status ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mode</span>
              <StatusBadge ok={status.mode === "worker"} label={status.mode} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Worker alive</span>
              <StatusBadge ok={status.workerAlive} label={status.workerAlive ? "yes" : "no"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending tasks</span>
              <span className="font-mono">{status.pendingTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed / Failed</span>
              <span className="font-mono">{status.totalCompleted} / {status.totalFailed}</span>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground/50">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Storage Integrity Card ─────────────────────────────────────────────────────

function StorageIntegrityCard() {
  const [report, setReport] = React.useState<StorageHealthReport | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try { setReport(getStorageHealthReport()); } finally { setLoading(false); }
  }

  React.useEffect(() => { void refresh(); }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Storage Integrity</CardTitle>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={refresh} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {report ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Health score</span>
              <StatusBadge ok={report.healthScore >= 80} label={`${report.healthScore}/100`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total assets</span>
              <span className="font-mono">{report.totalAssets}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verified / Corrupt / Missing</span>
              <span className="font-mono">{report.verified} / {report.corrupt} / {report.missing}</span>
            </div>
            {report.quarantined.length > 0 && (
              <div className="border-t border-border/15 pt-2">
                <p className="text-muted-foreground/70">Quarantined: {report.quarantined.join(", ")}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground/50">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Startup Profiler Card ─────────────────────────────────────────────────────

function StartupProfilerCard() {
  const profiles = getStartupProfiles();
  const avgMs = getAverageBootDurationMs();
  const slowest = getSlowestStage();
  const last = profiles[profiles.length - 1] ?? null;

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Cold-Start Profiler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Sessions profiled</span>
          <span className="font-mono">{profiles.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Avg boot time</span>
          <span className="font-mono">{avgMs !== null ? `${avgMs}ms` : "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Slowest stage</span>
          <span className="font-mono">{slowest ? `${slowest.stage} (${slowest.avgMs}ms)` : "—"}</span>
        </div>
        {last && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-muted-foreground/60 uppercase tracking-wide text-[9px]">Last session</p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <StatusBadge ok={last.isWarmStart} label={last.isWarmStart ? "warm" : "cold"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono">{last.totalDurationMs !== null ? `${last.totalDurationMs}ms` : "incomplete"}</span>
            </div>
            {(["core", "governor", "warmup", "ready"] as const).map((stage) => {
              const rec = last.stages[stage];
              return rec?.durationMs != null ? (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-muted-foreground/60">{stage}</span>
                  <span className="font-mono text-muted-foreground/60">{rec.durationMs}ms</span>
                </div>
              ) : null;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Deployment Diagnostics Card ───────────────────────────────────────────────

function DeploymentDiagnosticsCard() {
  const [report, setReport] = React.useState<DeploymentDiagnosticsReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const safeMode = isSafeModeActive();

  async function runAudit() {
    setLoading(true);
    try { setReport(await getDeploymentDiagnostics()); } finally { setLoading(false); }
  }

  React.useEffect(() => { void runAudit(); }, []);

  return (
    <Card className="bg-card/50 border-border/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Deployment Diagnostics</CardTitle>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={runAudit} disabled={loading}>
          {loading ? "…" : "Re-audit"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Safe mode</span>
          <div className="flex items-center gap-2">
            <StatusBadge ok={!safeMode} label={safeMode ? "active" : "off"} />
            {safeMode ? (
              <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" onClick={() => deactivateSafeMode()}>
                Disable
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" onClick={() => activateSafeMode("manual")}>
                Force
              </Button>
            )}
          </div>
        </div>
        {report && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Critical failures</span>
              <StatusBadge ok={report.criticalFailures === 0} label={String(report.criticalFailures)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Build mode</span>
              <span className="font-mono">{report.buildFingerprint.mode}</span>
            </div>
            {report.buildFingerprint.version && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{report.buildFingerprint.version}</span>
              </div>
            )}
            <div className="border-t border-border/15 pt-2 space-y-1">
              {report.compatibilityChecks.map((c) => (
                <div key={c.feature} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground/70 truncate">{c.feature}</span>
                  <StatusBadge ok={c.passed} label={c.passed ? "ok" : "fail"} />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Phase 16: Persistent Cognition Cards ─────────────────────────────────────

function CognitiveStateCard() {
  const [report, setReport] = React.useState<CognitiveStateReport>(() => getCognitiveStateReport());
  React.useEffect(() => {
    const id = setInterval(() => setReport(getCognitiveStateReport()), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognitive State Engine</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Attention slots</p><p className="font-mono">{report.attentionSlotCount} / 5</p></div>
          <div><p className="text-muted-foreground">Active goals</p><p className="font-mono">{report.activeGoalCount} / 3</p></div>
          <div><p className="text-muted-foreground">Unresolved topics</p><p className="font-mono">{report.unresolvedTopicCount}</p></div>
          <div><p className="text-muted-foreground">Momentum</p><p className="font-mono">{(report.conversationMomentum * 100).toFixed(0)}%</p></div>
          <div><p className="text-muted-foreground">Emotion</p><p className="font-mono">{report.dominantEmotion}</p></div>
          <div><p className="text-muted-foreground">Checkpointed</p><StatusBadge ok={report.isCheckpointed} label={report.isCheckpointed ? "yes" : "no"} /></div>
        </div>
        {report.attentionSlots.length > 0 && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-muted-foreground font-medium">Top attention slots</p>
            {report.attentionSlots.slice(0, 3).map((s, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-foreground/70 truncate">{s.content.slice(0, 50)}</span>
                <span className="font-mono text-muted-foreground">{(s.salience * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkingMemoryTimelineCard() {
  const [events, setEvents] = React.useState<CognitionEvent[]>(() => getRecentCognitionEvents(20));
  const [busStats, setBusStats] = React.useState(() => getCognitionEventBusStats());
  React.useEffect(() => {
    const id = setInterval(() => {
      setEvents(getRecentCognitionEvents(20));
      setBusStats(getCognitionEventBusStats());
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognition Event Timeline</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Total events</p><p className="font-mono">{busStats.totalEvents}</p></div>
          <div><p className="text-muted-foreground">Subscribers</p><p className="font-mono">{Object.values(busStats.subscriberCount).reduce((a, b) => a + b, 0)}</p></div>
        </div>
        <div className="border-t border-border/15 pt-2 space-y-1 max-h-40 overflow-y-auto">
          {events.slice().reverse().slice(0, 12).map((e, i) => (
            <div key={i} className="flex justify-between gap-2 text-[11px]">
              <span className="font-mono text-muted-foreground">{e.eventType}</span>
              <span className="text-foreground/50">{new Date(e.emittedAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MemoryHierarchyCard() {
  const [report, setReport] = React.useState<MemoryHierarchyReport>(() => getMemoryHierarchyReport());
  React.useEffect(() => {
    const id = setInterval(() => setReport(getMemoryHierarchyReport()), 8000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Memory Hierarchy</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-3 gap-2">
          <div><p className="text-muted-foreground">Total items</p><p className="font-mono">{report.totalItems}</p></div>
          <div><p className="text-muted-foreground">Evictions</p><p className="font-mono">{report.evictionsThisSession}</p></div>
          <div><p className="text-muted-foreground">Promotions</p><p className="font-mono">{report.promotionsThisSession}</p></div>
        </div>
        <div className="border-t border-border/15 pt-2 space-y-1">
          {report.tiers.map((t) => (
            <div key={t.tier} className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">T{t.tier} {t.name}</span>
              <div className="flex-1 h-1.5 bg-border/20 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${t.fillPct}%` }} />
              </div>
              <span className="font-mono w-12 text-right">{t.itemCount}/{t.maxItems}</span>
            </div>
          ))}
        </div>
        {report.topSalientItems.length > 0 && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-muted-foreground font-medium">Top salient items</p>
            {report.topSalientItems.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-foreground/60 truncate text-[11px]">{item.content.slice(0, 55)}</span>
                <span className="font-mono text-muted-foreground">{(item.salience * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContextBudgetCard() {
  const [report, setReport] = React.useState<ContextBudgetReport>(() => getContextBudgetReport());
  const [assembling, setAssembling] = React.useState(false);
  const assemble = () => {
    setAssembling(true);
    assembleContext(1000);
    setReport(getContextBudgetReport());
    setAssembling(false);
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Context Budget</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Budget</p><p className="font-mono">{report.budgetTokens} tok</p></div>
          <div><p className="text-muted-foreground">Utilization</p><p className="font-mono">{report.utilizationPct}%</p></div>
          <div><p className="text-muted-foreground">Items included</p><p className="font-mono">{report.itemsIncluded}</p></div>
          <div><p className="text-muted-foreground">Items excluded</p><p className="font-mono">{report.itemsExcluded}</p></div>
          <div><p className="text-muted-foreground">Contradictions</p><p className="font-mono">{report.contradictionsDetected}</p></div>
        </div>
        {report.topItems.length > 0 && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            {report.topItems.map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-foreground/60 truncate">{item.content.slice(0, 48)}</span>
                <span className="font-mono text-muted-foreground">{(item.score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px] h-7" onClick={assemble} disabled={assembling}>
          {assembling ? "Assembling…" : "Assemble Context"}
        </Button>
      </CardContent>
    </Card>
  );
}

function UserModelCard() {
  const [report, setReport] = React.useState<UserModelReport>(() => getUserModelReport());
  React.useEffect(() => {
    const id = setInterval(() => setReport(getUserModelReport()), 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">User Model</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Avg confidence</p><p className="font-mono">{(report.averageConfidence * 100).toFixed(0)}%</p></div>
          <div><p className="text-muted-foreground">High-conf dims</p><p className="font-mono">{report.highConfidenceDimensions}/{report.totalDimensions}</p></div>
          <div><p className="text-muted-foreground">Stale dims</p><p className="font-mono">{report.staleDimensions}</p></div>
          <div><p className="text-muted-foreground">Burnout risk</p><StatusBadge ok={report.burnoutRisk === "low"} label={report.burnoutRisk} /></div>
          <div className="col-span-2"><p className="text-muted-foreground">Coaching style</p><p className="font-mono">{report.coachingStylePreference}</p></div>
        </div>
        {report.dominantMotivation && (
          <div className="border-t border-border/15 pt-2">
            <p className="text-muted-foreground font-medium">Coaching context</p>
            <p className="text-foreground/70 mt-1">{report.dominantMotivation}</p>
          </div>
        )}
        <div className="border-t border-border/15 pt-2 space-y-1">
          {report.dimensions.filter((d) => d.confidence >= 0.3).slice(0, 5).map((d) => (
            <div key={d.dimension} className="flex items-center gap-2">
              <span className="text-muted-foreground truncate w-36">{d.dimension}</span>
              <div className="flex-1 h-1 bg-border/20 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400/60 rounded-full" style={{ width: `${d.value * 100}%` }} />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{(d.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReflectionActivityCard() {
  const [report, setReport] = React.useState<ReflectionReport>(() => getReflectionReport());
  const [reflections, setReflections] = React.useState<ReflectionEntry[]>(() => getActiveReflections());
  React.useEffect(() => {
    const id = setInterval(() => {
      setReport(getReflectionReport());
      setReflections(getActiveReflections());
    }, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Reflection Engine</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Total reflections</p><p className="font-mono">{report.totalReflections}</p></div>
          <div><p className="text-muted-foreground">Active</p><p className="font-mono">{reflections.length}</p></div>
          <div><p className="text-muted-foreground">Last run</p><p className="font-mono">{report.lastReflectionAt ? new Date(report.lastReflectionAt).toLocaleTimeString() : "never"}</p></div>
          <div><p className="text-muted-foreground">Skipped</p><p className="font-mono">{report.skippedReason ?? "no"}</p></div>
        </div>
        {reflections.length > 0 && (
          <div className="border-t border-border/15 pt-2 space-y-2">
            {reflections.slice(0, 3).map((r, i) => (
              <div key={i} className="space-y-0.5">
                <p className="font-mono text-[10px] text-muted-foreground">{r.kind}</p>
                <p className="text-foreground/70 leading-snug">{r.summary}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContinuityRecoveryCard() {
  const [status, setStatus] = React.useState<ContinuityStatus>(() => getContinuityStatus());
  const [log, setLog] = React.useState(() => getContinuityRecoveryLog().slice(-5).reverse());
  React.useEffect(() => {
    const id = setInterval(() => {
      setStatus(getContinuityStatus());
      setLog(getContinuityRecoveryLog().slice(-5).reverse());
    }, 8000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Continuity Recovery</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Recovered</p><StatusBadge ok={status.isRecovered} label={status.isRecovered ? "yes" : "no"} /></div>
          <div><p className="text-muted-foreground">Recovery count</p><p className="font-mono">{status.recoveryCount}</p></div>
          <div><p className="text-muted-foreground">Last outcome</p><p className="font-mono">{status.lastRecoveryOutcome ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Crash marker</p><StatusBadge ok={!status.crashMarkerPresent} label={status.crashMarkerPresent ? "yes" : "no"} /></div>
        </div>
        {log.length > 0 && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            <p className="text-muted-foreground font-medium">Recovery log</p>
            {log.map((r, i) => (
              <div key={i} className="flex justify-between gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground">{r.reason} → {r.outcome}</span>
                <span className="text-foreground/50">{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemorySafetyCard() {
  const [report, setReport] = React.useState<SafetyGovernorReport>(() => getSafetyGovernorReport());
  const [auditing, setAuditing] = React.useState(false);
  const audit = () => {
    setAuditing(true);
    runSafetyAudit(true);
    setReport(getSafetyGovernorReport());
    setAuditing(false);
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Memory Safety Governor</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Last audit</p><StatusBadge ok={report.lastAuditPassed ?? true} label={report.lastAuditPassed === null ? "never" : report.lastAuditPassed ? "passed" : "failed"} /></div>
          <div><p className="text-muted-foreground">Total violations</p><p className="font-mono">{report.totalViolations}</p></div>
          <div><p className="text-muted-foreground">Remediations</p><p className="font-mono">{report.totalRemediations}</p></div>
        </div>
        {report.violationHistory.slice(-4).reverse().map((v, i) => (
          <div key={i} className="text-[11px] border border-border/20 rounded p-1.5 space-y-0.5">
            <div className="flex justify-between">
              <span className="font-mono text-muted-foreground">{v.kind}</span>
              <StatusBadge ok={v.severity === "low"} label={v.severity} />
            </div>
            <p className="text-foreground/60 leading-snug">{v.description.slice(0, 80)}</p>
          </div>
        ))}
        <Button size="sm" variant="outline" className="w-full text-[11px] h-7" onClick={audit} disabled={auditing}>
          {auditing ? "Auditing…" : "Run Safety Audit"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SalienceHeatmapCard() {
  const [report, setReport] = React.useState<MemoryHierarchyReport>(() => getMemoryHierarchyReport());
  const [cogReport, setCogReport] = React.useState<CognitiveStateReport>(() => getCognitiveStateReport());
  React.useEffect(() => {
    const id = setInterval(() => {
      setReport(getMemoryHierarchyReport());
      setCogReport(getCognitiveStateReport());
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const allSlots = cogReport.attentionSlots;
  const maxSalience = Math.max(...allSlots.map((s) => s.salience), 0.01);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Salience Heatmap</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div>
          <p className="text-muted-foreground font-medium mb-1">Attention slots</p>
          {allSlots.length === 0 ? (
            <p className="text-muted-foreground/50">No active slots</p>
          ) : (
            <div className="space-y-1">
              {allSlots.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-border/15 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(s.salience / maxSalience) * 100}%`,
                        background: `hsl(${220 + (1 - s.salience / maxSalience) * 60}, 70%, 55%)`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] w-8 text-right">{(s.salience * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border/15 pt-2">
          <p className="text-muted-foreground font-medium mb-1">Memory tier fill</p>
          <div className="space-y-1">
            {report.tiers.map((t) => (
              <div key={t.tier} className="flex items-center gap-2">
                <span className="text-muted-foreground w-16 text-[10px]">T{t.tier}</span>
                <div className="flex-1 h-1.5 bg-border/15 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.fillPct}%`,
                      background: t.fillPct > 80 ? "hsl(0,70%,55%)" : "hsl(200,70%,55%)",
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] w-8 text-right">{t.fillPct}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CognitiveDriftCard() {
  const [validationReport, setValidationReport] = React.useState<CognitionValidationReport | null>(() => getLastValidationReport());
  const [cert, setCert] = React.useState(() => getCognitionCertification());
  const [running, setRunning] = React.useState(false);

  const runValidation = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runCognitionValidation();
      setValidationReport(r);
      setCert(getCognitionCertification());
      setRunning(false);
    }, 50);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognition Validator</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className="font-mono text-lg">{validationReport?.totalScore ?? "—"}<span className="text-[10px] text-muted-foreground">/100</span></p>
          </div>
          <div>
            <p className="text-muted-foreground">Certification</p>
            <StatusBadge ok={cert === "production" || cert === "standard"} label={cert} />
          </div>
          {validationReport && (
            <>
              <div><p className="text-muted-foreground">Tests run</p><p className="font-mono">{validationReport.testResults.length}</p></div>
              <div><p className="text-muted-foreground">Duration</p><p className="font-mono">{validationReport.durationMs}ms</p></div>
            </>
          )}
        </div>
        {validationReport && (
          <div className="border-t border-border/15 pt-2 space-y-1">
            {validationReport.testResults.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-foreground/60 truncate text-[11px]">{t.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{t.score}/{t.weight}</span>
                  <StatusBadge ok={t.passed} label={t.passed ? "ok" : "fail"} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px] h-7" onClick={runValidation} disabled={running}>
          {running ? "Running…" : "Run Cognition Validation"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Phase 18: Proactive Wellness Intelligence ─────────────────────────────────

function WellnessTrajectoryMonitorCard() {
  const [trajectory, setTrajectory] = React.useState<WellnessTrajectory | null>(() => getWellnessTrajectory());
  const [computing, setComputing] = React.useState(false);
  const handleCompute = () => {
    setComputing(true);
    try { setTrajectory(computeWellnessTrajectory(true)); } finally { setComputing(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Wellness Trajectory Monitor</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!trajectory ? <p className="text-muted-foreground italic">No trajectory computed</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Direction</p><p className="font-mono">{trajectory.compositeDirection}</p></div>
              <div><p className="text-muted-foreground">Momentum</p><p className="font-mono">{(trajectory.compositeMomentum * 100).toFixed(0)}%</p></div>
              <div><p className="text-muted-foreground">Burnout progress</p><p className={cn("font-mono", trajectory.burnoutProgression > 0.6 ? "text-red-500" : "")}>{(trajectory.burnoutProgression * 100).toFixed(0)}%</p></div>
              <div><p className="text-muted-foreground">Motivation decay</p><p className={cn("font-mono", trajectory.motivationDecay > 0.6 ? "text-amber-500" : "")}>{(trajectory.motivationDecay * 100).toFixed(0)}%</p></div>
            </div>
            {trajectory.negativeSignals.length > 0 && <p className="text-red-500 text-[10px]">Declining: {trajectory.negativeSignals.join(", ")}</p>}
            {trajectory.positiveSignals.length > 0 && <p className="text-emerald-600 text-[10px]">Improving: {trajectory.positiveSignals.join(", ")}</p>}
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleCompute} disabled={computing}>
          {computing ? "Computing…" : "Recompute trajectory"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DisengagementRiskAnalyzerCard() {
  const [prediction, setPrediction] = React.useState<DisengagementPrediction | null>(() => getDisengagementPrediction());
  const [computing, setComputing] = React.useState(false);
  const handlePredict = () => {
    setComputing(true);
    try { setPrediction(predictDisengagement(true)); } finally { setComputing(false); }
  };
  const riskColor = prediction?.riskLevel === "high" ? "text-red-500" : prediction?.riskLevel === "moderate" ? "text-amber-500" : "text-emerald-600";
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Disengagement Risk Analyzer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!prediction ? <p className="text-muted-foreground italic">No prediction yet</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Risk score</p><p className={cn("font-mono font-bold", riskColor)}>{(prediction.riskScore * 100).toFixed(0)}%</p></div>
              <div><p className="text-muted-foreground">Level</p><p className={cn("font-semibold capitalize", riskColor)}>{prediction.riskLevel}</p></div>
              <div><p className="text-muted-foreground">Confidence</p><p className="font-mono">{(prediction.confidence * 100).toFixed(0)}%</p></div>
              <div><p className="text-muted-foreground">Strategy</p><p className="font-mono text-[10px]">{prediction.suggestedStrategy.replace(/_/g, " ")}</p></div>
            </div>
            {prediction.probableCauses.length > 0 && (
              <p className="text-muted-foreground text-[10px]">Causes: {prediction.probableCauses.join(", ")}</p>
            )}
            <p className="text-[10px] text-muted-foreground italic">{prediction.strategyReason}</p>
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handlePredict} disabled={computing}>
          {computing ? "Predicting…" : "Run disengagement prediction"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RecoveryOpportunityViewerCard() {
  const [report, setReport] = React.useState<RecoveryOpportunityReport | null>(() => getRecoveryOpportunityReport());
  const [computing, setComputing] = React.useState(false);
  const handleDetect = () => {
    setComputing(true);
    try { setReport(detectRecoveryOpportunities(true)); } finally { setComputing(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Recovery Opportunity Viewer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!report ? <p className="text-muted-foreground italic">No detection yet</p> : (
          <>
            <div className="flex items-center gap-4">
              <div><p className="text-muted-foreground">Opportunities</p><p className="font-mono text-emerald-600">{report.opportunities.length}</p></div>
              <div><p className="text-muted-foreground">Active now</p><StatusBadge ok={report.hasActiveWindow} label={report.hasActiveWindow ? "yes" : "no"} /></div>
            </div>
            {report.opportunities.map((o) => (
              <div key={o.id} className="border border-border/30 rounded p-2 space-y-1">
                <div className="flex justify-between"><span className="font-medium">{o.headline}</span><span className="text-muted-foreground">{o.window}</span></div>
                <p className="text-[10px] text-muted-foreground">{o.suggestion.slice(0, 100)}…</p>
                <p className="text-[10px]">Confidence: {(o.confidence * 100).toFixed(0)}%</p>
              </div>
            ))}
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleDetect} disabled={computing}>
          {computing ? "Detecting…" : "Detect recovery opportunities"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AdaptiveCoachingDashboardCard() {
  const [report, setReport] = React.useState<CoachingEngineReport>(() => getCoachingEngineReport());
  const handleCalibrate = () => { calibrateCoachingStyle(); setReport(getCoachingEngineReport()); };
  const handleReset = () => { resetCoachingCalibration(); setReport(getCoachingEngineReport()); };
  const style = report.currentStyle;
  const driftColor = report.driftRisk === "high" ? "text-red-500" : report.driftRisk === "moderate" ? "text-amber-500" : "text-emerald-600";
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Adaptive Coaching Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!style ? <p className="text-muted-foreground italic">No calibration yet</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Tone</p><p className="font-mono">{style.tone}</p></div>
              <div><p className="text-muted-foreground">Frame</p><p className="font-mono">{style.frame}</p></div>
              <div><p className="text-muted-foreground">Intensity</p><p className="font-mono">{style.intensity}</p></div>
              <div><p className="text-muted-foreground">Pressure</p><p className="font-mono">{style.pressure}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-1">
              <div><p className="text-muted-foreground">Evidence count</p><p className="font-mono">{report.evidenceCount}</p></div>
              <div><p className="text-muted-foreground">Drift risk</p><p className={cn("font-mono capitalize", driftColor)}>{report.driftRisk}</p></div>
              <div><p className="text-muted-foreground">Confidence</p><p className="font-mono">{(style.confidenceInCalibration * 100).toFixed(0)}%</p></div>
            </div>
            {report.overpersonalizationRisk && <p className="text-amber-500 text-[10px]">Over-personalization risk detected</p>}
            <p className="text-[10px] text-muted-foreground italic">{style.calibrationReason}</p>
          </>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-[11px]" onClick={handleCalibrate}>Recalibrate</Button>
          <Button size="sm" variant="outline" className="flex-1 text-[11px]" onClick={handleReset}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InterventionTimingGraphCard() {
  const [evaluation, setEvaluation] = React.useState(() => { try { return evaluateInterventionTiming("today"); } catch { return null; } });
  const [report] = React.useState(() => getTimingEngineReport());
  const decisionColor = evaluation?.decision === "proceed" ? "text-emerald-600" : evaluation?.decision === "defer" ? "text-amber-500" : "text-red-500";
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Intervention Timing</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {evaluation && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Timing score</p><p className="font-mono">{(evaluation.timingScore * 100).toFixed(0)}%</p></div>
              <div><p className="text-muted-foreground">Decision</p><p className={cn("font-semibold", decisionColor)}>{evaluation.decision}</p></div>
              <div><p className="text-muted-foreground">Urgency</p><p className="font-mono">{evaluation.urgency}</p></div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">{evaluation.reason}</p>
          </>
        )}
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-1">
          <div><p className="text-muted-foreground text-[10px]">Proceed</p><p className="font-mono">{report.proceedCount}</p></div>
          <div><p className="text-muted-foreground text-[10px]">Deferred</p><p className="font-mono">{report.deferralCount}</p></div>
          <div><p className="text-muted-foreground text-[10px]">Suppressed</p><p className="font-mono">{report.suppressionCount}</p></div>
        </div>
        <p className="text-[10px] text-muted-foreground">Avg timing score: {(report.averageTimingScore * 100).toFixed(0)}%</p>
      </CardContent>
    </Card>
  );
}

function ProactiveInsightExplorerCard() {
  const [report, setReport] = React.useState<InsightSynthesisReport>(() => getInsightSynthesisReport());
  const [synthesizing, setSynthesizing] = React.useState(false);
  const handleSynthesize = () => {
    setSynthesizing(true);
    try { setReport(synthesizeProactiveInsights(true)); } finally { setSynthesizing(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Proactive Insight Explorer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Fresh insights</p><p className="font-mono text-emerald-600">{report.freshInsights.length}</p></div>
          <div><p className="text-muted-foreground">Suppressed</p><p className="font-mono">{report.suppressedCount}</p></div>
          <div><p className="text-muted-foreground">Total generated</p><p className="font-mono">{report.totalInsightsGenerated}</p></div>
        </div>
        {report.freshInsights.map((ins) => (
          <div key={ins.id} className="border border-border/30 rounded p-2 space-y-1">
            <div className="flex justify-between"><span className={ins.isPositive ? "text-emerald-600" : "text-amber-500"}>{ins.category.replace(/_/g, " ")}</span><span className="font-mono text-muted-foreground">{(ins.confidence * 100).toFixed(0)}% conf</span></div>
            <p className="text-[10px]">{ins.text}</p>
          </div>
        ))}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleSynthesize} disabled={synthesizing}>
          {synthesizing ? "Synthesizing…" : "Synthesize insights"}
        </Button>
        {report.lastSynthesizedAt && <p className="text-[10px] text-muted-foreground">Last: {new Date(report.lastSynthesizedAt).toLocaleTimeString()}</p>}
      </CardContent>
    </Card>
  );
}

function WellnessSafetyGovernorCard() {
  const [report, setReport] = React.useState<SafetyAuditReport>(() => getWellnessSafetyReport());
  const handleAudit = () => setReport(runWellnessSafetyAudit());
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Wellness Safety Governor</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="flex items-center gap-4">
          <div><p className="text-muted-foreground">Overall</p><StatusBadge ok={report.overallSafe} label={report.overallSafe ? "safe" : "violations"} /></div>
          <div><p className="text-muted-foreground">Blocks</p><p className={cn("font-mono", report.totalBlocksThisSession > 0 ? "text-red-500" : "")}>{report.totalBlocksThisSession}</p></div>
          <div><p className="text-muted-foreground">Warnings</p><p className={cn("font-mono", report.totalWarningsThisSession > 0 ? "text-amber-500" : "")}>{report.totalWarningsThisSession}</p></div>
        </div>
        <div><p className="text-muted-foreground">Intervention freq/day</p><p className={cn("font-mono", report.interventionFrequency > 2 ? "text-amber-500" : "")}>{report.interventionFrequency.toFixed(1)}</p></div>
        {report.activeViolations.length > 0 && (
          <div className="space-y-1">
            <p className="text-red-500 text-[10px] uppercase tracking-wide">Active violations</p>
            {report.activeViolations.map((v) => <p key={v} className="text-[10px] text-red-500">{v.replace(/_/g, " ")}</p>)}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleAudit}>Run safety audit</Button>
      </CardContent>
    </Card>
  );
}

function LongitudinalPatternGraphCard() {
  const [report, setReport] = React.useState(() => getPatternGraphReport());
  const [computing, setComputing] = React.useState(false);
  const handleCompute = () => {
    setComputing(true);
    try { computeLongitudinalPatternGraph(true); setReport(getPatternGraphReport()); } finally { setComputing(false); }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Longitudinal Pattern Graph</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Nodes</p><p className="font-mono">{report.nodeCount}</p></div>
          <div><p className="text-muted-foreground">Edges</p><p className="font-mono">{report.edgeCount}</p></div>
        </div>
        {report.dominantPattern && <p className="text-[10px] text-emerald-600 italic">{report.dominantPattern}</p>}
        {report.topRelationships.length > 0 && (
          <div className="space-y-1 border-t border-border/40 pt-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Top relationships</p>
            {report.topRelationships.map((e, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span>{e.from} → {e.to}</span>
                <span className={cn("font-mono", e.relationship === "inverse" ? "text-amber-500" : "text-emerald-600")}>{e.relationship.replace(/_/g, " ")} {(e.strength * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleCompute} disabled={computing}>
          {computing ? "Computing…" : "Compute pattern graph"}
        </Button>
        {report.lastComputedAt && <p className="text-[10px] text-muted-foreground">Last: {new Date(report.lastComputedAt).toLocaleTimeString()}</p>}
      </CardContent>
    </Card>
  );
}

function ProactiveCognitionActivityCard() {
  const [report, setReport] = React.useState<ProactiveCognitionReport>(() => getProactiveCognitionReport());
  const [running, setRunning] = React.useState(false);
  const handleRun = async () => {
    setRunning(true);
    try { await runProactiveCognitionLoop("manual", true); setReport(getProactiveCognitionReport()); } finally { setRunning(false); }
  };
  const last = report.lastResult;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Proactive Cognition Loop</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Total runs</p><p className="font-mono">{report.totalRuns}</p></div>
          <div><p className="text-muted-foreground">Avg duration</p><p className="font-mono">{report.averageDurationMs}ms</p></div>
          <div><p className="text-muted-foreground">Running now</p><StatusBadge ok={!report.isRunning} label={report.isRunning ? "running" : "idle"} /></div>
        </div>
        {last && (
          <div className="space-y-1 border-t border-border/40 pt-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Last run ({last.triggeredBy})</p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span>Completed</span><span className="font-mono text-right text-emerald-600">{last.stagesCompleted.length}</span>
              <span>Failed</span><span className={cn("font-mono text-right", last.stagesFailed.length > 0 ? "text-red-500" : "")}>{last.stagesFailed.length}</span>
              <span>Insights</span><span className="font-mono text-right">{last.freshInsightCount}</span>
              <span>Disengagement risk</span><span className="font-mono text-right">{(last.disengagementRisk * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleRun} disabled={running || report.isRunning}>
          {running ? "Running…" : "Run proactive cognition"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PsychologicalSafetyAuditCard() {
  const [report, setReport] = React.useState<WellnessValidationReport | null>(() => getLastWellnessValidationReport());
  const [running, setRunning] = React.useState(false);
  const handleValidate = () => {
    setRunning(true);
    try { setReport(runWellnessIntelligenceValidation()); } finally { setRunning(false); }
  };
  const gradeColor = report ? { excellent: "text-emerald-600", good: "text-emerald-500", degraded: "text-amber-500", critical: "text-red-500" }[report.grade] : "";
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Psychological Safety Audit</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!report ? <p className="text-muted-foreground italic">No validation yet</p> : (
          <>
            <div className="flex items-center gap-4">
              <div><p className="text-muted-foreground">Score</p><p className={cn("font-mono text-lg font-bold", gradeColor)}>{report.overallScore}/100</p></div>
              <div><p className="text-muted-foreground">Grade</p><p className={cn("font-semibold capitalize", gradeColor)}>{report.grade}</p></div>
            </div>
            {report.criticalIssues.length > 0 && (
              <div className="space-y-1">
                <p className="text-red-500 text-[10px] uppercase tracking-wide">Critical issues</p>
                {report.criticalIssues.slice(0, 2).map((issue, i) => <p key={i} className="text-[10px] text-red-400">{issue}</p>)}
              </div>
            )}
            <div className="space-y-1 border-t border-border/40 pt-1">
              {report.checks.filter((c) => !c.passed).slice(0, 4).map((c) => (
                <div key={c.checkId} className="flex justify-between">
                  <span className="text-amber-500 text-[10px]">{c.checkId.replace(/_/g, " ")}</span>
                  <span className="font-mono text-muted-foreground">{c.score}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleValidate} disabled={running}>
          {running ? "Auditing…" : "Run psychological safety audit"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Phase 17: Cognitive Execution Integration ─────────────────────────────────

function CognitiveExecutionPipelineCard() {
  const [report, setReport] = React.useState<OrchestratorReport>(() => getOrchestratorReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getOrchestratorReport()), 2000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognitive Execution Pipeline</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Total executions</p><p className="font-mono">{report.totalExecutions}</p></div>
          <div><p className="text-muted-foreground">Failed</p><p className="font-mono text-red-500">{report.failedExecutions}</p></div>
          <div><p className="text-muted-foreground">Avg pipeline ms</p><p className="font-mono">{report.averagePipelineMs}ms</p></div>
          <div><p className="text-muted-foreground">Executing now</p><StatusBadge ok={!report.isExecuting} label={report.isExecuting ? "running" : "idle"} /></div>
        </div>
        {report.lastStages.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Last pipeline stages</p>
            {report.lastStages.map((s) => (
              <div key={s.stage} className="flex justify-between items-center">
                <span className={s.succeeded ? "text-emerald-600" : "text-red-500"}>{s.stage}</span>
                <span className="font-mono text-muted-foreground">{s.durationMs}ms{s.detail ? ` · ${s.detail}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromptSynthesisInspectorCard() {
  const [report, setReport] = React.useState(() => getPromptSynthesisReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getPromptSynthesisReport()), 3000);
    return () => clearInterval(interval);
  }, []);
  const s = report.lastSynthesis;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Prompt Synthesis Inspector</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!s ? <p className="text-muted-foreground italic">No synthesis yet</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Tokens used</p><p className="font-mono">{s.tokenBudgetUsed} / {s.tokenBudgetTotal}</p></div>
              <div><p className="text-muted-foreground">Contradictions suppressed</p><p className="font-mono">{s.contradictionsSuppressed}</p></div>
            </div>
            {s.continuityFrame && <p className="text-muted-foreground text-[10px] truncate">Frame: {s.continuityFrame}</p>}
            <div className="space-y-1 border-t border-border/40 pt-1">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Sections</p>
              {s.sections.map((sec, i) => (
                <div key={i} className="flex justify-between">
                  <span className={sec.included ? "" : "text-muted-foreground line-through"}>{sec.name}</span>
                  <span className="font-mono text-muted-foreground">{sec.tokens}t{sec.reason ? ` (${sec.reason})` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResponseAnalysisViewerCard() {
  const [report, setReport] = React.useState(() => getResponseAnalysisPipelineReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getResponseAnalysisPipelineReport()), 3000);
    return () => clearInterval(interval);
  }, []);
  const a = report.lastAnalysis;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Response Analysis Viewer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!a ? <p className="text-muted-foreground italic">No analysis yet</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Emotion</p><p className="font-mono">{a.emotionalSignals.dominantEmotion}</p></div>
              <div><p className="text-muted-foreground">Valence</p><p className={cn("font-mono", a.emotionalSignals.valence >= 0 ? "text-emerald-600" : "text-red-500")}>{a.emotionalSignals.valence.toFixed(2)}</p></div>
              <div><p className="text-muted-foreground">Commitments</p><p className="font-mono">{a.commitments.length}</p></div>
              <div><p className="text-muted-foreground">Coaching opps</p><p className="font-mono">{a.coachingOpportunities.length}</p></div>
            </div>
            {a.coachingOpportunities.length > 0 && (
              <p className="text-[10px] text-amber-600 truncate">Opportunity: {a.coachingOpportunities[0]}</p>
            )}
            {a.commitments.length > 0 && (
              <p className="text-[10px] text-emerald-600 truncate">Commitment: {a.commitments[0]}</p>
            )}
            <p className="text-muted-foreground text-[10px]">Analysis: {a.analysisMs}ms</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MemoryExtractionMonitorCard() {
  const [report, setReport] = React.useState(() => getMemoryExtractionReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getMemoryExtractionReport()), 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Memory Extraction Monitor</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {report.lastExtractedAt === null ? <p className="text-muted-foreground italic">No extraction yet</p> : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Candidates</p><p className="font-mono">{report.lastCandidateCount}</p></div>
              <div><p className="text-muted-foreground">Duplicates suppressed</p><p className="font-mono">{report.lastDuplicatesSuppressed}</p></div>
              <div><p className="text-muted-foreground">Contradictions</p><p className="font-mono text-amber-500">{report.lastContradictionsDetected}</p></div>
            </div>
            <div className="space-y-1 border-t border-border/40 pt-1">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Tier distribution</p>
              {([1, 2, 3, 4, 5] as const).map((tier) => (
                <div key={tier} className="flex justify-between">
                  <span>T{tier}</span>
                  <span className="font-mono">{report.tierDistribution[tier]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoalThreadTrackerCard() {
  const [report, setReport] = React.useState<GoalThreadReport>(() => getGoalThreadReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getGoalThreadReport()), 5000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Goal Thread Tracker</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Active</p><p className="font-mono text-emerald-600">{report.activeThreads}</p></div>
          <div><p className="text-muted-foreground">Stalled</p><p className="font-mono text-amber-500">{report.stalledThreads}</p></div>
          <div><p className="text-muted-foreground">Abandoned</p><p className="font-mono text-muted-foreground">{report.abandonedThreads}</p></div>
          <div><p className="text-muted-foreground">Completed</p><p className="font-mono text-emerald-600">{report.completedThreads}</p></div>
        </div>
        {report.topThreads.length > 0 && (
          <div className="space-y-1 border-t border-border/40 pt-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Top threads</p>
            {report.topThreads.map((t, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="truncate max-w-[160px]">{t.name}</span>
                  <StatusBadge ok={t.status === "progressing" || t.status === "active"} label={t.status} />
                </div>
                <div className="w-full bg-border/30 rounded h-1">
                  <div className="bg-emerald-500 h-1 rounded" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmotionalContinuityGraphCard() {
  const [report, setReport] = React.useState<EmotionalContinuityReport>(() => getEmotionalContinuityReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getEmotionalContinuityReport()), 5000);
    return () => clearInterval(interval);
  }, []);
  const dims = report.profile.dimensions;
  const dimensionEntries = Object.entries(dims) as Array<[string, { value: number; trend: string; confidence: number }]>;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Emotional Continuity</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Overall valence</p><p className={cn("font-mono", report.overallValence >= 0 ? "text-emerald-600" : "text-red-500")}>{report.overallValence.toFixed(2)}</p></div>
          <div><p className="text-muted-foreground">Active shift</p><StatusBadge ok={!report.hasActiveShift} label={report.hasActiveShift ? "yes" : "stable"} /></div>
        </div>
        {report.dominantConcern && <p className="text-amber-500 text-[10px]">Dominant concern: {report.dominantConcern}</p>}
        <div className="space-y-1 border-t border-border/40 pt-1">
          {dimensionEntries.map(([dim, val]) => (
            <div key={dim} className="space-y-0.5">
              <div className="flex justify-between">
                <span>{dim.replace(/_/g, " ")}</span>
                <span className="font-mono text-muted-foreground">{val.value.toFixed(2)} {val.trend === "rising" ? "↑" : val.trend === "falling" ? "↓" : "→"}</span>
              </div>
              <div className="w-full bg-border/30 rounded h-1">
                <div className="bg-blue-500 h-1 rounded" style={{ width: `${Math.round(val.value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ContextInjectionAnalyzerCard() {
  const [report, setReport] = React.useState<ContextInjectionReport>(() => getContextInjectionReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getContextInjectionReport()), 3000);
    return () => clearInterval(interval);
  }, []);
  const inj = report.lastInjection;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Context Injection Analyzer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Avg sections</p><p className="font-mono">{report.averageSectionsIncluded}</p></div>
          <div><p className="text-muted-foreground">Avg tokens used</p><p className="font-mono">{report.averageTokensUsed}</p></div>
        </div>
        {inj && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Last tokens</p><p className="font-mono">{inj.totalTokens} / {inj.budgetTokens}</p></div>
              <div><p className="text-muted-foreground">Critical tokens</p><p className="font-mono">{inj.criticalTokens}</p></div>
            </div>
            <div className="space-y-1 border-t border-border/40 pt-1">
              {inj.sections.map((s, i) => (
                <div key={i} className="flex justify-between">
                  <span className={s.isCritical ? "text-amber-500 font-medium" : ""}>{s.name}</span>
                  <span className="font-mono text-muted-foreground">{s.tokens}t</span>
                </div>
              ))}
            </div>
          </>
        )}
        {report.criticalSectionNames.length > 0 && (
          <p className="text-[10px] text-amber-500">Critical: {report.criticalSectionNames.join(", ")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CognitionFeedbackLoopCard() {
  const [report, setReport] = React.useState(() => getCognitionFeedbackLoopReport());
  React.useEffect(() => {
    const interval = setInterval(() => setReport(getCognitionFeedbackLoopReport()), 3000);
    return () => clearInterval(interval);
  }, []);
  const last = report.lastResult;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognition Feedback Loop</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Total loops</p><p className="font-mono">{report.totalLoops}</p></div>
          <div><p className="text-muted-foreground">Total memories written</p><p className="font-mono">{report.totalMemoriesWritten}</p></div>
          <div><p className="text-muted-foreground">Reflections triggered</p><p className="font-mono">{report.reflectionTriggerCount}</p></div>
        </div>
        {last && (
          <div className="space-y-1 border-t border-border/40 pt-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Last loop</p>
            <div className="grid grid-cols-2 gap-1">
              <span>Memories written</span><span className="font-mono text-right">{last.memoriesWritten}</span>
              <span>Goals updated</span><span className="font-mono text-right">{last.goalsUpdated}</span>
              <span>Safety violations</span><span className={cn("font-mono text-right", last.safetyViolationsDetected > 0 ? "text-red-500" : "")}>{last.safetyViolationsDetected}</span>
              <span>Duration</span><span className="font-mono text-right">{last.durationMs}ms</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SemanticMemoryGraphCard() {
  const [report, setReport] = React.useState<SemanticMemoryReport>(() => getSemanticMemoryReport());
  const [computing, setComputing] = React.useState(false);
  const handleCompute = async () => {
    setComputing(true);
    try {
      const { retrieveMemory } = await import("@/ai/memory/memoryHierarchy");
      const { computeSemanticMemoryReport } = await import("@/ai/cognition/semanticMemoryEngine");
      const entries = retrieveMemory({ maxTier: 4, limit: 50 });
      setReport(computeSemanticMemoryReport(entries));
    } finally {
      setComputing(false);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Semantic Memory Explorer</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-muted-foreground">Relations</p><p className="font-mono">{report.totalRelations}</p></div>
          <div><p className="text-muted-foreground">Groups</p><p className="font-mono">{report.totalGroups}</p></div>
          <div><p className="text-muted-foreground">Avg coherence</p><p className="font-mono">{report.averageGroupCoherence.toFixed(2)}</p></div>
          <div><p className="text-muted-foreground">Contradictions</p><p className={cn("font-mono", report.contradictionCount > 0 ? "text-amber-500" : "")}>{report.contradictionCount}</p></div>
        </div>
        {report.topGroups.length > 0 && (
          <div className="space-y-1 border-t border-border/40 pt-1">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Concept groups</p>
            {report.topGroups.map((g, i) => (
              <div key={i} className="flex justify-between">
                <span>{g.label}</span>
                <span className="font-mono text-muted-foreground">{g.memberCount} items · {g.coherence.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleCompute} disabled={computing}>
          {computing ? "Computing…" : "Compute semantic graph"}
        </Button>
        {report.lastComputedAt && <p className="text-[10px] text-muted-foreground">Last computed: {new Date(report.lastComputedAt).toLocaleTimeString()}</p>}
      </CardContent>
    </Card>
  );
}

function CognitiveCoherenceDashboardCard() {
  const [report, setReport] = React.useState<CoherenceReport | null>(() => getLastCoherenceReport());
  const [running, setRunning] = React.useState(false);
  const handleValidate = () => {
    setRunning(true);
    try {
      setReport(runCoherenceValidation());
    } finally {
      setRunning(false);
    }
  };
  const gradeColor = report ? { excellent: "text-emerald-600", good: "text-emerald-500", degraded: "text-amber-500", critical: "text-red-500" }[report.grade] : "";
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Cognitive Coherence Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {!report ? <p className="text-muted-foreground italic">No validation yet</p> : (
          <>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-muted-foreground">Score</p>
                <p className={cn("font-mono text-lg font-bold", gradeColor)}>{report.overallScore}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade</p>
                <p className={cn("font-semibold capitalize", gradeColor)}>{report.grade}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Session turns</p>
                <p className="font-mono">{report.sessionTurns}</p>
              </div>
            </div>
            <div className="space-y-1 border-t border-border/40 pt-1">
              {report.checks.map((c) => (
                <div key={c.checkId} className="flex justify-between items-start gap-2">
                  <div>
                    <StatusBadge ok={c.passed} label={c.passed ? "pass" : "fail"} />
                    <span className="ml-2">{c.checkId.replace(/_/g, " ")}</span>
                    {c.issue && <p className="text-[10px] text-muted-foreground mt-0.5 pl-8">{c.issue}</p>}
                  </div>
                  <span className="font-mono text-muted-foreground shrink-0">{c.score}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleValidate} disabled={running}>
          {running ? "Validating…" : "Run coherence validation"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Assistant State Inspector ─────────────────────────────────────────────────

function AssistantStateInspectorCard() {
  const [report, setReport] = React.useState<AssistantStateReport>(() => getAssistantStateReport());

  React.useEffect(() => {
    const interval = setInterval(() => setReport(getAssistantStateReport()), 3000);
    return () => clearInterval(interval);
  }, []);

  const state = report.state;
  const stalenessColor =
    report.staleness === "fresh" ? "text-emerald-500" :
    report.staleness === "recent" ? "text-yellow-500" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Assistant State Inspector
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => { syncAssistantState(); setReport(getAssistantStateReport()); }}>
              Sync
            </Button>
            <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => { resetAssistantState(); setReport(getAssistantStateReport()); }}>
              Reset
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex gap-2 items-center flex-wrap">
          <span className={cn("font-mono text-[10px]", stalenessColor)}>{report.staleness}</span>
          <span className="text-muted-foreground">coaching: <span className="text-foreground font-mono">{state.activeCoachingFrame}</span></span>
          <span className="text-muted-foreground">burnout sensitivity: <span className="text-foreground font-mono">{(state.burnoutSensitivity * 100).toFixed(0)}%</span></span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {([
            ["Dominant concern", state.dominantConcern ?? "—"],
            ["Emotional trajectory", state.emotionalTrajectory],
            ["Motivational state", state.motivationalState],
            ["Engagement state", state.engagementState],
            ["Intervention cooldown", state.interventionCooldown ? "active" : "off"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="font-mono">{value}</p>
            </div>
          ))}
        </div>
        {state.longitudinalFocusAreas.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-0.5">Longitudinal focus areas</p>
            <p className="font-mono text-[11px]">{state.longitudinalFocusAreas.join(", ")}</p>
          </div>
        )}
        {report.coachingHint && (
          <div className="border-t border-border/40 pt-1">
            <p className="text-muted-foreground">Coaching hint</p>
            <p className="text-[11px] italic">{report.coachingHint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Unified Behavior Pipeline ─────────────────────────────────────────────────

function UnifiedBehaviorPipelineCard() {
  const [report, setReport] = React.useState(() => getAssistantOrchestratorReport());

  React.useEffect(() => {
    const interval = setInterval(() => setReport(getAssistantOrchestratorReport()), 2000);
    return () => clearInterval(interval);
  }, []);

  const scoreColor =
    report.consistencyScore >= 85 ? "text-emerald-500" :
    report.consistencyScore >= 65 ? "text-yellow-500" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Unified Behavior Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-muted-foreground">Total requests</p>
            <p className="font-mono">{report.totalRequests}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Blocked by safety</p>
            <p className="font-mono">{report.blockedBySafety}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Consistency score</p>
            <p className={cn("font-mono font-bold", scoreColor)}>{report.consistencyScore}/100</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Last surface</p>
            <p className="font-mono">{report.lastSurface ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <StatusBadge ok={!report.isExecuting} label={report.isExecuting ? "executing" : "idle"} />
          </div>
        </div>
        {report.lastRequestAt && (
          <p className="text-muted-foreground text-[10px]">
            Last: {new Date(report.lastRequestAt).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Contextual Behavior Viewer ────────────────────────────────────────────────

const SURFACES: AssistantSurface[] = ["overview", "sleep", "exercise", "nutrition", "habits", "journal", "mental", "ai_chat"];

function ContextualBehaviorViewerCard() {
  const [selectedSurface, setSelectedSurface] = React.useState<AssistantSurface>("ai_chat");
  const profile = getSurfaceBehaviorProfile(selectedSurface);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Contextual Behavior Viewer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-1">
          {SURFACES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={selectedSurface === s ? "default" : "outline"}
              className="text-[10px] h-6 px-2"
              onClick={() => setSelectedSurface(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 border-t border-border/40 pt-2">
          {([
            ["Safety level", profile.safetyLevel],
            ["Proactive allowed", profile.proactiveAllowed ? "yes" : "no"],
            ["Max tokens", String(profile.maxResponseTokens)],
            ["Goal reinforcement", profile.allowGoalReinforcement ? "yes" : "no"],
            ["Challenge framing", profile.allowChallengeFraming ? "yes" : "no"],
            ["Tone override", profile.toneOverride ?? "none"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="font-mono">{value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border/40 pt-1">
          <p className="text-muted-foreground mb-0.5">System hint</p>
          <p className="text-[10px] italic text-muted-foreground/80">{profile.systemHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Proactive Delivery Queue ──────────────────────────────────────────────────

function ProactiveDeliveryQueueCard() {
  const [report, setReport] = React.useState(() => getDeliveryEngineReport());
  const [items, setItems] = React.useState(() => getPendingItems());
  const [refreshing, setRefreshing] = React.useState(false);

  function handleRefresh() {
    setRefreshing(true);
    try {
      refreshDeliveryQueue("overview");
      setReport(getDeliveryEngineReport());
      setItems(getPendingItems());
    } finally {
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    const interval = setInterval(() => {
      setReport(getDeliveryEngineReport());
      setItems(getPendingItems());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Proactive Delivery Queue
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh queue"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-muted-foreground">Pending</p>
            <p className="font-mono">{report.pendingCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Delivered today</p>
            <p className="font-mono">{report.deliveredTodayCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Blocked</p>
            <p className="font-mono">{report.blockedCount}</p>
          </div>
        </div>
        {report.blockedReasons.length > 0 && (
          <div className="bg-red-500/5 rounded p-1.5">
            {report.blockedReasons.map((r, i) => (
              <p key={i} className="text-[10px] text-red-400">{r}</p>
            ))}
          </div>
        )}
        {items.length > 0 ? (
          <div className="space-y-2 border-t border-border/40 pt-1">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="bg-muted/30 rounded p-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-[11px]">{item.title}</span>
                  <span className="text-muted-foreground text-[10px]">{item.channel}</span>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{item.body}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">priority: {item.priority} · source: {item.sourceType}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic">Queue empty</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Consistency Validator ─────────────────────────────────────────────────────

function ConsistencyValidatorCard() {
  const [report, setReport] = React.useState<ConsistencyValidationReport | null>(() => getLastConsistencyReport());
  const [running, setRunning] = React.useState(false);

  async function handleValidate() {
    setRunning(true);
    try {
      const r = runConsistencyValidation();
      setReport(r);
    } finally {
      setRunning(false);
    }
  }

  const gradeColor =
    !report ? "text-muted-foreground" :
    report.grade === "excellent" ? "text-emerald-500" :
    report.grade === "good" ? "text-yellow-400" :
    report.grade === "degraded" ? "text-orange-400" : "text-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Consistency Validator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {!report ? (
          <p className="text-muted-foreground italic">No report yet</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-muted-foreground">Score</p>
                <p className={cn("font-mono text-lg font-bold", gradeColor)}>{report.score}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade</p>
                <p className={cn("font-semibold capitalize", gradeColor)}>{report.grade}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Violations</p>
                <p className="font-mono">{report.violations.length}</p>
              </div>
            </div>
            {report.violations.length > 0 && (
              <div className="space-y-1 border-t border-border/40 pt-1">
                {report.violations.map((v, i) => (
                  <div key={i} className={cn("rounded p-1.5", v.severity === "critical" ? "bg-red-500/8" : "bg-yellow-500/8")}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={cn("font-semibold text-[11px]", v.severity === "critical" ? "text-red-400" : "text-yellow-400")}>
                        {v.type.replace(/_/g, " ")}
                      </span>
                      <StatusBadge ok={v.severity === "info"} label={v.severity} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{v.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{v.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleValidate} disabled={running}>
          {running ? "Validating…" : "Run consistency validation"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Assistant Surface Simulator ────────────────────────────────────────────────

function AssistantSurfaceSimulatorCard() {
  const [selectedSurface, setSelectedSurface] = React.useState<AssistantSurface>("ai_chat");
  const [prompt, setPrompt] = React.useState("How am I doing overall?");
  const [result, setResult] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [stateSnap, setStateSnap] = React.useState(() => getAssistantStateReport());

  React.useEffect(() => {
    syncAssistantState();
    setStateSnap(getAssistantStateReport());
  }, [selectedSurface]);

  async function handleSimulate() {
    setRunning(true);
    setResult(null);
    try {
      const { assistantRequest } = await import("@/ai/assistant/unifiedAssistantOrchestrator");
      let accumulated = "";
      const response = await assistantRequest(prompt, {
        surface: selectedSurface,
        maxTokens: 120,
        onToken: (t) => { accumulated += t; setResult(accumulated); },
      });
      setResult(
        response.safetyVerdict === "blocked"
          ? "[Blocked by safety governor]"
          : accumulated || `[${response.tokensGenerated} tokens, no streaming]`,
      );
    } catch (e) {
      setResult(`Error: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Assistant Surface Simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-1">
          {SURFACES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={selectedSurface === s ? "default" : "outline"}
              className="text-[10px] h-6 px-2"
              onClick={() => setSelectedSurface(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <div>
            <p className="text-muted-foreground">Frame</p>
            <p className="font-mono">{stateSnap.state.activeCoachingFrame}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Burnout sensitivity</p>
            <p className="font-mono">{(stateSnap.state.burnoutSensitivity * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div className="border-t border-border/40 pt-1">
          <p className="text-muted-foreground mb-0.5">Prompt</p>
          <textarea
            className="w-full bg-muted/30 rounded p-1.5 font-mono text-[11px] resize-none"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        {result && (
          <div className="bg-muted/20 rounded p-1.5 text-[11px] whitespace-pre-wrap font-mono">
            {result}
          </div>
        )}
        <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleSimulate} disabled={running || !prompt.trim()}>
          {running ? "Simulating…" : `Run on ${selectedSurface}`}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Production Readiness Dashboard ────────────────────────────────────────────

function ProductionReadinessDashboardCard() {
  const [report, setReport] = React.useState<ProductionReadinessReport | null>(() => getLastProductionReport());
  const [running, setRunning] = React.useState(false);

  async function handleGenerate() {
    setRunning(true);
    try { setReport(generateProductionReadinessReport()); } finally { setRunning(false); }
  }

  const gradeColor = !report ? "text-muted-foreground" :
    report.deploymentGrade === "production_ready" ? "text-emerald-500" :
    report.deploymentGrade === "staging_only" ? "text-yellow-400" : "text-red-400";

  const subsystemColor = (grade: "ready" | "degraded" | "critical") =>
    grade === "ready" ? "text-emerald-500" : grade === "degraded" ? "text-yellow-400" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Production Readiness Dashboard
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleGenerate} disabled={running}>
            {running ? "Generating…" : "Generate report"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {!report ? <p className="text-muted-foreground italic">No report yet</p> : (
          <>
            <div className="flex gap-4 items-center">
              <div>
                <p className="text-muted-foreground">Overall score</p>
                <p className={cn("font-mono text-2xl font-bold", gradeColor)}>{report.overallScore}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade</p>
                <p className={cn("font-semibold text-sm capitalize", gradeColor)}>{report.deploymentGrade.replace(/_/g, " ")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 border-t border-border/40 pt-1">
              {report.subsystems.map((sub) => (
                <div key={sub.id} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{sub.id.replace(/_/g, " ")}</span>
                  <span className={cn("font-mono font-semibold", subsystemColor(sub.grade))}>{sub.score}</span>
                </div>
              ))}
            </div>
            {report.knownBlockers.length > 0 && (
              <div className="bg-red-500/6 rounded p-1.5 space-y-0.5">
                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Blockers</p>
                {report.knownBlockers.slice(0, 3).map((b, i) => <p key={i} className="text-[10px] text-red-300">{b}</p>)}
              </div>
            )}
            {report.stubbedSystems.length > 0 && (
              <div className="border-t border-border/40 pt-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Stubs</p>
                {report.stubbedSystems.slice(0, 3).map((s, i) => <p key={i} className="text-[10px] text-muted-foreground/70 italic">{s}</p>)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Unified AI Flow Inspector ──────────────────────────────────────────────────

function UnifiedAIFlowInspectorCard() {
  const [bridgeReport, setBridgeReport] = React.useState(() => getInferenceBridgeReport());
  const [contextReport, setContextReport] = React.useState(() => getUnifiedContextReport());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setBridgeReport(getInferenceBridgeReport());
      setContextReport(getUnifiedContextReport());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const bypass = bridgeReport.bypassAudit;
  const bypassColor = bypass.verdict === "clean" ? "text-emerald-500" :
    bypass.verdict === "suspected_bypass" ? "text-red-400" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Unified AI Flow Inspector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Guarded requests</p>
            <p className="font-mono">{bridgeReport.totalGuardedRequests}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Blocked (mobile)</p>
            <p className="font-mono">{bridgeReport.totalBlockedByMobile}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Blocked (safety)</p>
            <p className="font-mono">{bridgeReport.totalBlockedBySafety}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bypass audit</p>
            <p className={cn("font-mono font-semibold", bypassColor)}>{bypass.verdict}</p>
          </div>
        </div>
        {bypass.estimatedBypasses > 0 && (
          <div className="bg-red-500/8 rounded p-1.5">
            <p className="text-[10px] text-red-400">~{bypass.estimatedBypasses} direct inference calls ({(bypass.bypassRatio * 100).toFixed(0)}% bypass rate)</p>
          </div>
        )}
        <div className="border-t border-border/40 pt-1">
          <p className="text-muted-foreground mb-0.5">Unified context assembler</p>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <p className="text-muted-foreground">Assembly count</p>
              <p className="font-mono">{contextReport.assemblyCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg tokens</p>
              <p className="font-mono">{contextReport.averageTokensUsed}</p>
            </div>
          </div>
          {contextReport.lastContext && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Last: {contextReport.lastContext.sectionsIncluded} sections, {contextReport.lastContext.totalTokens}/{contextReport.lastContext.budgetTokens} tokens
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Semantic Memory Explorer ───────────────────────────────────────────────────

function SemanticMemoryExplorerCard() {
  const [adapterReport, setAdapterReport] = React.useState(() => getEmbeddingAdapterReport());
  const [clusters, setClusters] = React.useState<SemanticCluster[]>(() => getLastClusters());
  const [running, setRunning] = React.useState(false);

  async function handleCluster() {
    setRunning(true);
    try {
      const { retrieveMemory } = await import("@/ai/memory/memoryHierarchy");
      const entries = retrieveMemory({ maxTier: 4, limit: 40 });
      if (entries.length > 0) {
        const result = semanticCluster(entries, Math.min(5, Math.ceil(entries.length / 4)));
        setClusters(result);
      }
      setAdapterReport(getEmbeddingAdapterReport());
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Semantic Memory Explorer
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleCluster} disabled={running}>
            {running ? "Clustering…" : "Run clustering"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-1">
          <div>
            <p className="text-muted-foreground">Embedding mode</p>
            <p className="font-mono text-[11px]">{adapterReport.embeddingMode}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cached</p>
            <p className="font-mono">{adapterReport.cachedEmbeddings}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Clusters</p>
            <p className="font-mono">{adapterReport.clusterCount}</p>
          </div>
        </div>
        {clusters.length > 0 ? (
          <div className="space-y-1.5 border-t border-border/40 pt-1">
            {clusters.slice(0, 4).map((c) => (
              <div key={c.id} className="bg-muted/30 rounded p-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-[11px]">{c.dominantTags.slice(0, 3).join(", ")}</span>
                  <span className="text-muted-foreground text-[10px]">{c.memberIds.length} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/50 rounded-full h-1">
                    <div className="bg-emerald-500/60 h-1 rounded-full" style={{ width: `${c.coherenceScore * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{(c.coherenceScore * 100).toFixed(0)}% coherence</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic">No clusters yet — run clustering to explore semantic groups</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Long-Session Stability Monitor ────────────────────────────────────────────

function LongSessionStabilityMonitorCard() {
  const [report, setReport] = React.useState<SessionStabilityReport | null>(() => getLastSessionStabilityReport());
  const [running, setRunning] = React.useState(false);

  async function handleCheck() {
    setRunning(true);
    try { setReport(runLongSessionCheck()); } finally { setRunning(false); }
  }

  const gradeColor = !report ? "text-muted-foreground" :
    report.grade === "stable" ? "text-emerald-500" :
    report.grade === "degrading" ? "text-yellow-400" : "text-red-400";

  const durationMin = report ? Math.round(report.sessionDurationMs / 60000) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Long-Session Stability Monitor
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleCheck} disabled={running}>
            {running ? "Checking…" : "Run check"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {!report ? <p className="text-muted-foreground italic">No report yet</p> : (
          <>
            <div className="flex gap-4 items-center">
              <div>
                <p className="text-muted-foreground">Stability</p>
                <p className={cn("font-mono text-lg font-bold", gradeColor)}>{report.score}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade</p>
                <p className={cn("font-semibold capitalize", gradeColor)}>{report.grade}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Session</p>
                <p className="font-mono">{durationMin}m</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inferences</p>
                <p className="font-mono">{report.inferenceCount}</p>
              </div>
            </div>
            {report.violations.length > 0 ? (
              <div className="space-y-1 border-t border-border/40 pt-1">
                {report.violations.map((v, i) => (
                  <div key={i} className={cn("rounded p-1.5", v.severity === "critical" ? "bg-red-500/8" : "bg-yellow-500/8")}>
                    <p className={cn("text-[11px] font-semibold", v.severity === "critical" ? "text-red-400" : "text-yellow-400")}>
                      {v.checkId.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{v.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 italic">{v.mitigation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-emerald-500 text-[11px]">Session is stable — no drift, stale memory, or continuity issues detected.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Mobile Runtime Hardening Panel ────────────────────────────────────────────

function MobileRuntimeHardeningCard() {
  const [report, setReport] = React.useState<MobileHardenerReport>(() => getMobileHardenerReport());

  React.useEffect(() => {
    const interval = setInterval(() => setReport(getMobileHardenerReport()), 3000);
    return () => clearInterval(interval);
  }, []);

  const pressureColor = (p: string) => p === "normal" ? "text-emerald-500" : p === "moderate" ? "text-yellow-400" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Mobile Runtime Hardening
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => { initMobileHardener(); setReport(getMobileHardenerReport()); }}>
            Init
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Platform</p>
            <p className="font-mono text-[11px]">{report.state.platform}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hardened</p>
            <StatusBadge ok={report.isHardened} label={report.isHardened ? "active" : "off"} />
          </div>
          <div>
            <p className="text-muted-foreground">Memory pressure</p>
            <p className={cn("font-mono", pressureColor(report.state.memoryPressure))}>{report.state.memoryPressure}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Thermal</p>
            <p className="font-mono">{report.state.thermalState}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Deferred inferences</p>
            <p className="font-mono">{report.deferredInferenceCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Worker crashes</p>
            <p className={cn("font-mono", report.state.workerCrashCount > 0 ? "text-red-400" : "text-muted-foreground")}>{report.state.workerCrashCount}</p>
          </div>
        </div>
        {report.state.workerCrashCount > 0 && (
          <div className="bg-red-500/6 rounded p-1.5">
            <p className="text-[10px] text-red-400">Backoff: {report.state.backoffMs}ms. Recovery in progress.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 text-[11px] border-t border-border/40 pt-1">
          <div>
            <p className="text-muted-foreground">Page hidden</p>
            <p className="font-mono">{report.state.isPageHidden ? "yes" : "no"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Memory warnings</p>
            <p className="font-mono">{report.memoryWarnings}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Psychological Safety Runtime ───────────────────────────────────────────────

function PsychologicalSafetyRuntimeCard() {
  const [status, setStatus] = React.useState(() => getPsychologicalSafetyStatus());
  const [running, setRunning] = React.useState(false);

  async function handleAudit() {
    setRunning(true);
    try { setStatus(runFullSafetyAudit()); } finally { setRunning(false); }
  }

  const verdictColor = status.verdict === "safe" ? "text-emerald-500" :
    status.verdict === "degraded" ? "text-yellow-400" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Psychological Safety Runtime
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleAudit} disabled={running}>
            {running ? "Auditing…" : "Run audit"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex gap-4 items-center">
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className={cn("font-mono text-lg font-bold", verdictColor)}>{status.score}/100</p>
          </div>
          <div>
            <p className="text-muted-foreground">Verdict</p>
            <p className={cn("font-semibold capitalize", verdictColor)}>{status.verdict}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            ["Wellness safety", status.wellnessSafetyScore],
            ["Memory safety", status.memorySafetyScore],
            ["Consistency", status.consistencyScore],
          ].map(([label, score]) => (
            <div key={label as string}>
              <p className="text-muted-foreground text-[10px]">{label as string}</p>
              <p className={cn("font-mono font-semibold", (score as number) >= 70 ? "text-emerald-500" : (score as number) >= 45 ? "text-yellow-400" : "text-red-400")}>
                {score as number}
              </p>
            </div>
          ))}
        </div>
        {status.activeRisks.length > 0 && (
          <div className="space-y-0.5 border-t border-border/40 pt-1">
            {status.activeRisks.slice(0, 4).map((r, i) => (
              <p key={i} className="text-[10px] text-red-300">{r}</p>
            ))}
          </div>
        )}
        {status.blockedBy && (
          <div className="bg-red-500/8 rounded p-1.5">
            <p className="text-[10px] font-semibold text-red-400">Blocked by: {status.blockedBy}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── UI Cognition Integration Viewer ────────────────────────────────────────────

function UICognitionIntegrationViewerCard() {
  const [signals, setSignals] = React.useState<SurfaceCognitionSignal[]>(() => getAllSurfaceSignals());

  React.useEffect(() => {
    const interval = setInterval(() => setSignals(getAllSurfaceSignals()), 5000);
    return () => clearInterval(interval);
  }, []);

  const strengthColor = (s: string) =>
    s === "strong" ? "text-emerald-500" : s === "moderate" ? "text-yellow-400" : s === "weak" ? "text-orange-400" : "text-muted-foreground";

  const trendIcon = (t: string) => t === "improving" ? "↑" : t === "declining" ? "↓" : t === "stable" ? "→" : "?";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">UI Cognition Integration Viewer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs">
        {signals.map((sig) => (
          <div key={sig.surface} className="flex items-start gap-2 border-b border-border/20 pb-1.5 last:border-0 last:pb-0">
            <div className="w-16 shrink-0">
              <p className="font-semibold capitalize">{sig.surface.replace("_", " ")}</p>
              <p className={cn("text-[10px]", strengthColor(sig.signalStrength))}>{sig.signalStrength}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn("text-[11px]", sig.domainTrend === "improving" ? "text-emerald-500" : sig.domainTrend === "declining" ? "text-red-400" : "text-muted-foreground")}>
                  {trendIcon(sig.domainTrend)}
                </span>
                <StatusBadge ok={sig.proactiveAvailable} label={sig.proactiveAvailable ? "proactive" : "passive"} />
              </div>
              {sig.primaryInsight && (
                <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-2">{sig.primaryInsight}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Deployment Validation Console ──────────────────────────────────────────────

function DeploymentValidationConsoleCard() {
  const [report, setReport] = React.useState<DeploymentValidationReport | null>(() => getLastDeploymentReport());
  const [running, setRunning] = React.useState(false);

  async function handleValidate() {
    setRunning(true);
    try { setReport(runOfflineDeploymentValidation()); } finally { setRunning(false); }
  }

  const verdictColor = !report ? "text-muted-foreground" :
    report.verdict === "ready" ? "text-emerald-500" :
    report.verdict === "degraded" ? "text-yellow-400" : "text-red-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Deployment Validation Console
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={handleValidate} disabled={running}>
            {running ? "Validating…" : "Run validation"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {!report ? <p className="text-muted-foreground italic">No validation yet</p> : (
          <>
            <div className="flex gap-4 items-center">
              <div>
                <p className="text-muted-foreground">Score</p>
                <p className={cn("font-mono text-lg font-bold", verdictColor)}>{report.score}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verdict</p>
                <p className={cn("font-semibold capitalize", verdictColor)}>{report.verdict.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Checks</p>
                <p className="font-mono">{report.checks.filter((c) => c.passed).length}/{report.checks.length} passed</p>
              </div>
            </div>
            <div className="space-y-0.5 border-t border-border/40 pt-1">
              {report.checks.map((c) => (
                <div key={c.checkId} className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge ok={c.passed} label={c.passed ? "✓" : "✗"} />
                    <span className={c.critical ? "font-medium" : "text-muted-foreground"}>{c.checkId.replace(/_/g, " ")}</span>
                  </div>
                  {!c.passed && <p className="text-[10px] text-red-300 text-right max-w-[55%] line-clamp-1">{c.detail}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── ONNX Validation Panel ─────────────────────────────────────────────────────

function OnnxValidationPanel() {
  const [caps, setCaps] = React.useState<EmbeddingCapabilityReport | null>(null);
  const [diag, setDiag] = React.useState<EmbeddingDiagnosticResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const metrics = getEmbeddingMetrics();

  React.useEffect(() => {
    setCaps(validateEmbeddingCapabilities());
  }, []);

  async function runDiag() {
    setRunning(true);
    try {
      const result = await runEmbeddingDiagnostics();
      setDiag(result);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">ONNX Embedding Validation</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        {caps && (
          <div className="space-y-1">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">Capabilities</p>
            <p>WASM: <span className={caps.wasmSupported ? "text-green-500" : "text-red-500"}>{caps.wasmSupported ? "supported" : "unsupported"}</span></p>
            <p>OPFS: <span className={caps.opfsAvailable ? "text-green-500" : "text-yellow-500"}>{caps.opfsAvailable ? "available" : "unavailable"}</span></p>
            <p>Cross-origin isolated: {caps.crossOriginIsolated ? "yes" : "no"}</p>
            <p>Safari: {caps.safariDetected ? "yes" : "no"} · RAM: {caps.estimatedRamMb > 0 ? `${caps.estimatedRamMb}MB` : "unknown"}</p>
            {caps.warnings.map((w, i) => (
              <p key={i} className="text-yellow-500">⚠ {w}</p>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider">Metrics</p>
          <p>Embeddings generated: {metrics.embeddingCount}</p>
          <p>Avg latency: {metrics.embeddingCount > 0 ? `${Math.round(metrics.totalLatencyMs / metrics.embeddingCount)}ms` : "—"}</p>
          <p>Last latency: {metrics.lastLatencyMs > 0 ? `${metrics.lastLatencyMs}ms` : "—"}</p>
          <p>Load failures: {metrics.loadFailures}</p>
          {metrics.lastError && <p className="text-red-500">Last error: {metrics.lastError}</p>}
        </div>
        {diag && (
          <div className="space-y-1">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">Diagnostic Result</p>
            <p>Passed: <span className={diag.passed ? "text-green-500" : "text-red-500"}>{diag.passed ? "yes" : "no"}</span></p>
            <p>Load time: {diag.loadTimeMs !== null ? `${diag.loadTimeMs}ms` : "—"}</p>
            <p>Embed latency: {diag.embedLatencyMs !== null ? `${diag.embedLatencyMs}ms` : "—"}</p>
            <p>Vector dims: {diag.vectorDimensions}</p>
            <p>Paraphrase recall: <span className={diag.paraphraseRecallOk ? "text-green-500" : "text-red-500"}>{diag.paraphraseRecallOk ? "ok" : "failed"}</span></p>
            {diag.errors.map((e, i) => <p key={i} className="text-red-500">{e}</p>)}
          </div>
        )}
        <Button size="sm" onClick={runDiag} disabled={running}>
          {running ? "Running…" : "Run Diagnostics"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Surface Migration Auditor ─────────────────────────────────────────────────

function SurfaceMigrationAuditorCard() {
  const surfaces = [
    { name: "DailyReflectionCard", route: "reflectionEngine → assistantRequest", status: "unified" },
    { name: "JournalReflectionCard", route: "reflectionEngine → assistantRequest", status: "unified" },
    { name: "WellMateLauncher", route: "local: assistantRequest / cloud: wellmateChat fallback", status: "hybrid" },
    { name: "AiMentalCoach", route: "Convex aiMentalCoach action (cloud-only)", status: "cloud" },
    { name: "useInference hook", route: "assistantRequest (unified)", status: "unified" },
    { name: "useStreamingInference hook", route: "assistantRequest (unified)", status: "unified" },
    { name: "AIDevPanel tests", route: "submitInference (dev-only, intentional bypass)", status: "devonly" },
    { name: "benchmarkEngine", route: "submitInference (perf testing, dev-only)", status: "devonly" },
    { name: "stressSuite", route: "submitInference (stress testing, dev-only)", status: "devonly" },
  ] as const;

  const statusColor = {
    unified: "text-green-500",
    hybrid: "text-blue-400",
    cloud: "text-yellow-500",
    devonly: "text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Surface Migration Audit</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-xs">
        {surfaces.map((s) => (
          <div key={s.name} className="space-y-0.5">
            <p className={`font-medium ${statusColor[s.status]}`}>{s.name} [{s.status}]</p>
            <p className="text-muted-foreground pl-2">{s.route}</p>
          </div>
        ))}
        <p className="text-muted-foreground pt-1">
          AiMentalCoach remains cloud-only (Convex). Remaining submitInference calls are intentional dev tooling.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Psychological Calibration Inspector ────────────────────────────────────────

function PsychologicalCalibrationInspectorCard() {
  const [status, setStatus] = React.useState(() => getInterventionCalibrationStatus());

  React.useEffect(() => {
    const t = setInterval(() => setStatus(getInterventionCalibrationStatus()), 5000);
    return () => clearInterval(t);
  }, []);

  const overfitting = isEmotionalOverfittingActive();

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Psychological Calibration</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider">Cooldowns</p>
          <p>Active cooldown: {status.cooldownActiveMs > 0 ? `${Math.ceil(status.cooldownActiveMs / 60000)}m remaining` : <span className="text-green-500">clear</span>}</p>
          <p>Today&apos;s deliveries: {status.deliveriesToday}/2</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider">Weekly Pattern</p>
          <p>Deliveries this week: {status.deliveriesThisWeek}</p>
          <p>Days with delivery: {status.uniqueDaysThisWeek}/7</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider">Safety Guards</p>
          <p>Dependency risk: <span className={status.dependencyRisk ? "text-yellow-500" : "text-green-500"}>{status.dependencyRisk ? "active" : "none"}</span></p>
          <p>Recovery mode: <span className={status.recoveryModeActive ? "text-yellow-500" : "text-green-500"}>{status.recoveryModeActive ? "active — blocking goal pressure" : "off"}</span></p>
          <p>Escalation guard: <span className={status.escalationGuardActive ? "text-red-500" : "text-green-500"}>{status.escalationGuardActive ? "active — burnout increased after last delivery" : "clear"}</span></p>
          <p>Emotional overfitting: <span className={overfitting ? "text-yellow-500" : "text-green-500"}>{overfitting ? "active" : "none"}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Dependency Risk Monitor ────────────────────────────────────────────────────

function DependencyRiskMonitorCard() {
  const safetyReport = getWellnessSafetyReport();
  const calibration = getInterventionCalibrationStatus();
  const overfitting = isEmotionalOverfittingActive();

  const riskLevel = (() => {
    if (calibration.escalationGuardActive) return "high";
    if (calibration.dependencyRisk || overfitting) return "medium";
    if (calibration.recoveryModeActive) return "elevated";
    return "low";
  })();

  const riskColor = {
    high: "text-red-500",
    medium: "text-yellow-500",
    elevated: "text-orange-400",
    low: "text-green-500",
  }[riskLevel];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Dependency Risk Monitor</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p>Overall risk: <span className={riskColor + " font-semibold"}>{riskLevel.toUpperCase()}</span></p>
        <div className="space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wider">Signals</p>
          <p>Intervention frequency (7d): {safetyReport.interventionFrequency.toFixed(1)}/day</p>
          <p>Session blocks: {safetyReport.totalBlocksThisSession}</p>
          <p>Session warnings: {safetyReport.totalWarningsThisSession}</p>
          <p>Deliveries on unique days: {calibration.uniqueDaysThisWeek}/7</p>
        </div>
        {safetyReport.activeViolations.length > 0 && (
          <div className="space-y-1">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">Active Violations</p>
            {safetyReport.activeViolations.map((v) => (
              <p key={v} className="text-yellow-500">{v}</p>
            ))}
          </div>
        )}
        <p className="text-muted-foreground">
          Healthy range: &lt;0.5/day, &lt;3 unique days/week. Escalation guard blocks delivery
          when burnout increases after prior intervention.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Semantic Recall Tester ─────────────────────────────────────────────────────

function SemanticRecallTesterCard() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Array<{ content: string; score: number; tier: number }>>([]);
  const [ran, setRan] = React.useState(false);

  function runRecall() {
    if (!query.trim()) return;
    const entries = retrieveMemory({ limit: 100 });
    const recalls = conceptualRecall(query.trim(), entries, 5);
    setResults(recalls.map((r) => ({
      content: r.entry.content,
      score: r.relevanceScore,
      tier: r.entry.tier,
    })));
    setRan(true);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Semantic Recall Tester</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="Enter a query to test recall…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runRecall()}
          />
          <Button size="sm" onClick={runRecall}>Recall</Button>
        </div>
        {ran && results.length === 0 && (
          <p className="text-muted-foreground">No memory entries found. Add some wellness data first.</p>
        )}
        {results.map((r, i) => (
          <div key={i} className="space-y-0.5 border-b border-border/40 pb-2">
            <p className="text-muted-foreground">T{r.tier} · score {r.score.toFixed(3)}</p>
            <p className="line-clamp-2">{r.content}</p>
          </div>
        ))}
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
      <WorkerExecutionCard />
      <SabStreamingCard />
      <ThreadedExecutionMonitorCard />
      <InferenceSlotTopologyCard />
      <QuantizationRoutingCard />
      <KvCacheDiagnosticsCard />
      <NativeFilesystemInspectorCard />
      <DeploymentIsolationCard />
      <RuntimeValidationCard />
      <ExecutionReadinessCard />
      <WasmRuntimeCard />
      <ThreadScalerCard />
      <MemoryGovernorCard />
      <ThroughputProfilerCard />
      <HardwareCharacterizerCard />
      <NativePluginContractsCard />
      <PerformanceLabCard />
      <ThreadedRuntimeCard />
      <WorkerTopologyCard />
      <NativeLifecycleCard />
      <SecureStorageCard />
      <RuntimeTelemetryCard />
      <FleetDiagnosticsCard />
      <BackgroundExecutionCard />
      <DeploymentConvergenceCard />
      <WorkerBridgeCard />
      <StorageIntegrityCard />
      <StartupProfilerCard />
      <DeploymentDiagnosticsCard />
      <CognitiveStateCard />
      <WorkingMemoryTimelineCard />
      <MemoryHierarchyCard />
      <ContextBudgetCard />
      <UserModelCard />
      <ReflectionActivityCard />
      <ContinuityRecoveryCard />
      <MemorySafetyCard />
      <SalienceHeatmapCard />
      <CognitiveDriftCard />
      <LongitudinalMemoryCard />
      <IntelligenceObservabilityCard />
      <StructuredTestsCard />
      <InferenceTestCard />
      <RetrievalTestCard />
      <SessionMemoryCard />
      <CognitiveExecutionPipelineCard />
      <PromptSynthesisInspectorCard />
      <ResponseAnalysisViewerCard />
      <MemoryExtractionMonitorCard />
      <GoalThreadTrackerCard />
      <EmotionalContinuityGraphCard />
      <ContextInjectionAnalyzerCard />
      <CognitionFeedbackLoopCard />
      <SemanticMemoryGraphCard />
      <CognitiveCoherenceDashboardCard />
      <WellnessTrajectoryMonitorCard />
      <DisengagementRiskAnalyzerCard />
      <RecoveryOpportunityViewerCard />
      <AdaptiveCoachingDashboardCard />
      <InterventionTimingGraphCard />
      <ProactiveInsightExplorerCard />
      <WellnessSafetyGovernorCard />
      <LongitudinalPatternGraphCard />
      <ProactiveCognitionActivityCard />
      <PsychologicalSafetyAuditCard />
      <AssistantStateInspectorCard />
      <UnifiedBehaviorPipelineCard />
      <ContextualBehaviorViewerCard />
      <ProactiveDeliveryQueueCard />
      <ConsistencyValidatorCard />
      <AssistantSurfaceSimulatorCard />
      <ProductionReadinessDashboardCard />
      <UnifiedAIFlowInspectorCard />
      <SemanticMemoryExplorerCard />
      <LongSessionStabilityMonitorCard />
      <MobileRuntimeHardeningCard />
      <PsychologicalSafetyRuntimeCard />
      <UICognitionIntegrationViewerCard />
      <DeploymentValidationConsoleCard />
      <OnnxValidationPanel />
      <SurfaceMigrationAuditorCard />
      <PsychologicalCalibrationInspectorCard />
      <DependencyRiskMonitorCard />
      <SemanticRecallTesterCard />
    </div>
  );
}
