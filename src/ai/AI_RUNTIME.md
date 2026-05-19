# WellMate AI Runtime — Architecture Reference

## Philosophy

WellMate AI is a **wellness cognition layer**, not a chatbot. Intelligence quality
comes primarily from context — longitudinal memory, behavioral patterns, and wellness
history — rather than from model size alone. The architecture is designed to support
this from day one.

---

## Layer Map

```
src/ai/
│
├── runtime/           Core lifecycle and safety
│   ├── types.ts       Runtime type contracts (separate from context types)
│   ├── runtimeState.ts  Observable state store (pub/sub, no React dependency)
│   ├── aiRuntime.ts   Lifecycle coordinator — initAIRuntime() / disposeAIRuntime()
│   ├── thermalGuard.ts  Inference frequency tracking + mandatory cooldowns
│   └── inferenceQueue.ts  Priority queue with cancellation (serial execution)
│
├── providers/         Backend abstraction
│   ├── types.ts       AIProvider interface (all backends implement this)
│   ├── registry.ts    Provider registration + active-provider management
│   ├── StubProvider.ts  Deterministic no-op fallback — always registered
│   └── local/
│       ├── modelMetadata.ts  ModelManifest types + PHI3_MINI_MANIFEST
│       ├── llamaBridge.ts    llama.cpp integration seam (WASM / native paths)
│       ├── modelLoader.ts    IndexedDB-backed model download + storage lifecycle
│       └── LocalProvider.ts  AIProvider impl for on-device inference
│
├── orchestration/     Request routing and context preparation
│   ├── tokenBudget.ts    Token estimation + overflow prevention
│   ├── contextAssembler.ts  Wraps contextBridge output for inference injection
│   └── orchestrator.ts   Provider selection + fallback chain + queue wiring
│
├── memory/            Session-scoped inference memory
│   └── runtimeMemory.ts  Rolling conversation window (separate from longitudinal)
│
├── retrieval/         Future RAG layer interfaces
│   ├── types.ts          RetrievalAdapter interface + query/chunk types
│   └── retrievalBridge.ts  Stub adapter (isReady() = false until wired)
│
├── hooks/             React surface
│   ├── useAIRuntime.ts  Reactive runtime state for components
│   └── useInference.ts  Submit inference requests + track status
│
│   [existing files — do not modify]
├── types.ts            Context/citation type contracts
├── contextBridge.ts    Token-budgeted wellness context assembly
├── contextCards.ts     Context card generation from intelligence layer
├── conversationalPrimitives.ts  Grounded follow-up prompt generation
├── wellMateEvents.ts   Event bus for opening the AI launcher
└── citationEngine.ts   Citation generation from wellness signals
```

---

## Inference Lifecycle

```
Component calls useInference().run(prompt)
  └─ submitInference() → enqueue(request)
       └─ InferenceQueue (priority-sorted, serial)
            └─ awaitThermalClearance() — blocks if device is hot
            └─ isAppVisible() — defers if app is backgrounded
            └─ provider.generate(request)
                 ├─ LocalProvider → llamaBridge → llama.cpp (WASM or native)
                 └─ StubProvider → deterministic stub (fallback)
            └─ recordInference() — updates thermal state
```

---

## Provider Fallback Chain

```
1. LocalProvider (Phi-3 Mini) — preferred; requires llama.cpp bridge + downloaded model
2. [Future] CloudProvider (OpenAI, Claude) — escalation when local is unavailable
3. StubProvider — always registered; safe fallback; returns labelled stub text
```

Provider selection is the orchestrator's sole responsibility. No component touches
the registry directly.

---

## Thermal Safety

`thermalGuard.ts` tracks inference frequency over a rolling 60-second window:

| State    | Threshold       | Action                            |
|----------|-----------------|-----------------------------------|
| nominal  | < 5/min         | No restriction                    |
| warm     | 5–9/min         | State surfaced to UI only         |
| hot      | 10–17/min       | State surfaced to UI only         |
| critical | ≥ 18/min        | 3-second mandatory cooldown       |

Inference also pauses when the app is backgrounded (visibilitychange listener).

---

## llama.cpp Integration Points

`llamaBridge.ts` is the only file that changes when native inference is activated.

**WASM path**: uncomment the `wasmBridge` branch and install the llama-wasm package.
**Native path**: uncomment the `nativeBridge` branch and register the Capacitor plugin.

The bridge returns `null` until one of these paths is active. `LocalProvider.initialize()`
catches this and throws, causing the orchestrator to keep the stub provider active.

---

## Model Storage

Models are stored in **IndexedDB** (`wellmate_models_v1` / `model_files` store).
LocalStorage is not viable for multi-GB model weights.

`modelLoader.ts` manages the full lifecycle:
`download → stream progress → assemble buffer → store → retrieve → delete`

---

## Context Assembly

Context flows through two layers:

1. **`contextBridge.ts`** (existing) — assembles the 1200-token wellness context
   payload from intelligence, memory, and recommendation layers.

2. **`contextAssembler.ts`** (new) — wraps that payload for direct injection into
   an inference request, applying the system prompt and per-model token constraints.

---

## Session Memory vs Longitudinal Memory

| Layer | Location | Scope | Purpose |
|-------|----------|-------|---------|
| Session memory | `memory/runtimeMemory.ts` | Current session only | Multi-turn conversation context |
| Longitudinal memory | `intelligence/memory/` | Persistent, 90d+ | Behavioral patterns, milestones, correlations |

These are completely independent. Session memory is cleared on `disposeAIRuntime()`.

---

## Retrieval (Future RAG)

`retrieval/types.ts` defines the `RetrievalAdapter` interface. `retrievalBridge.ts`
exports a stub that always returns `isReady() = false` and empty results.

When a vector store is integrated, only `retrievalBridge.ts` changes — the interface
and the rest of the system remain stable.

---

## Startup

`initAIRuntime()` is called once at app startup (from lifecycle coordinator or App.tsx).
It registers the stub provider, wires the inference queue executor, and returns.
It does **not** block rendering, load models, or require network access.
All failures are non-fatal — the stub provider remains active as safe fallback.
