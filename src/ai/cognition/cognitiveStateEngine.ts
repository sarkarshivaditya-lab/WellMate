// Cognitive State Engine — the live mental working memory of the AI.
//
// This is NOT a database. It is volatile working cognition — "RAM for the AI mind."
// Contents decay, get evicted, get promoted. On app restart it must be restored
// from a checkpoint (continuityRecovery.ts) or rebuilt from memory hierarchy.
//
// Architecture:
//   AttentionSlots  — what the AI is currently attending to (max 5, decayed by time)
//   ActiveGoals     — what coaching objectives are live (max 3, priority-ordered)
//   EmotionalState  — current emotional continuity (EMA-tracked valence/arousal)
//   UnresolvedTopics — topics raised but not addressed (max 5, urgency-sorted)
//   InferenceTraces — last 10 inference summaries (recent thought history)
//   ConversationMomentum — 0-1 measure of conversation flow state
//
// Decay: every N seconds salience decays exponentially. Slots below threshold evicted.
// Checkpoint: serialized to sessionStorage for cross-reload recovery.

import { emitCognitionEvent, getCognitionSessionId } from "./cognitionEventBus";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AttentionSemanticType =
  | "wellness_goal" | "emotional_signal" | "behavioral_pattern"
  | "recent_event" | "user_preference" | "unresolved_question";

export type AttentionSlot = {
  id: string;
  content: string;
  semanticType: AttentionSemanticType;
  salience: number;          // 0-1; decays over time
  decayRatePerMin: number;   // 0.05 = loses 5% per minute
  lastReferenced: number;
  createdAt: number;
  referenceCount: number;
};

export type ActiveGoal = {
  id: string;
  description: string;
  priority: number;          // 0-1
  progress: number;          // 0-1
  createdAt: number;
  lastUpdatedAt: number;
  evidenceCount: number;
};

export type EmotionalState = {
  valence: number;           // -1 (distressed) to +1 (positive)
  arousal: number;           // 0 (calm) to 1 (activated)
  dominantEmotion: string;   // "calm" | "motivated" | "anxious" | "tired" | "uncertain"
  trend: "improving" | "stable" | "declining";
  lastShiftAt: number;
  shiftCount: number;
};

export type UnresolvedTopic = {
  id: string;
  topic: string;
  urgency: number;           // 0-1
  mentionedAt: number;
  mentionCount: number;
};

export type InferenceTrace = {
  requestId: string;
  topicSummary: string;
  emotionalTone: string;
  goalsMentioned: string[];
  responseQuality: "high" | "medium" | "low" | "unknown";
  tokenCount: number;
  timestamp: number;
};

export type CognitiveStateReport = {
  sessionId: string;
  attentionSlotCount: number;
  attentionSlots: Array<{ content: string; salience: number; semanticType: string }>;
  activeGoalCount: number;
  activeGoals: Array<{ description: string; priority: number; progress: number }>;
  emotionalValence: number;
  emotionalArousal: number;
  dominantEmotion: string;
  conversationMomentum: number;
  unresolvedTopicCount: number;
  recentTraceCount: number;
  isCheckpointed: boolean;
  lastCheckpointAgeMs: number | null;
  decayApplicationCount: number;
};

// ── Limits ─────────────────────────────────────────────────────────────────────

const MAX_ATTENTION_SLOTS = 5;
const MAX_ACTIVE_GOALS = 3;
const MAX_UNRESOLVED_TOPICS = 5;
const MAX_INFERENCE_TRACES = 10;
const SALIENCE_EVICTION_THRESHOLD = 0.08;
const DECAY_INTERVAL_MS = 30_000; // apply decay every 30s
const CHECKPOINT_KEY = "ai_cognitive_state_checkpoint_v1";
const EMOTIONAL_EMA_ALPHA = 0.3;

// ── Engine state ───────────────────────────────────────────────────────────────

let _attentionSlots: AttentionSlot[] = [];
let _activeGoals: ActiveGoal[] = [];
let _unresolvedTopics: UnresolvedTopic[] = [];
let _inferenceTraces: InferenceTrace[] = [];
let _idCounter = 0;
let _decayApplicationCount = 0;
let _lastCheckpointAt: number | null = null;
let _conversationMomentum = 0;

let _emotionalState: EmotionalState = {
  valence: 0, arousal: 0.3, dominantEmotion: "calm",
  trend: "stable", lastShiftAt: Date.now(), shiftCount: 0,
};

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${_idCounter++}`;
}

// ── Attention slot management ─────────────────────────────────────────────────

export function addAttentionSlot(
  content: string,
  semanticType: AttentionSemanticType,
  initialSalience = 0.7,
  decayRatePerMin = 0.04,
): string {
  // Evict lowest-salience slot if full
  if (_attentionSlots.length >= MAX_ATTENTION_SLOTS) {
    const lowest = _attentionSlots.reduce((min, s) => s.salience < min.salience ? s : min);
    _attentionSlots = _attentionSlots.filter((s) => s.id !== lowest.id);
    emitCognitionEvent("memory_evicted", { tier: "attention", id: lowest.id, content: lowest.content });
  }

  const slot: AttentionSlot = {
    id: nextId("attn"),
    content, semanticType,
    salience: Math.min(1, initialSalience),
    decayRatePerMin,
    lastReferenced: Date.now(),
    createdAt: Date.now(),
    referenceCount: 1,
  };
  _attentionSlots.push(slot);
  emitCognitionEvent("salience_shift", { action: "slot_added", content, salience: initialSalience });
  return slot.id;
}

export function boostAttentionSlot(slotId: string, boost = 0.2): void {
  const slot = _attentionSlots.find((s) => s.id === slotId);
  if (!slot) return;
  slot.salience = Math.min(1, slot.salience + boost);
  slot.lastReferenced = Date.now();
  slot.referenceCount++;
  emitCognitionEvent("salience_shift", { action: "boosted", id: slotId, newSalience: slot.salience });
}

export function getTopAttentionSlots(n = 3): AttentionSlot[] {
  return [..._attentionSlots]
    .sort((a, b) => b.salience - a.salience)
    .slice(0, n);
}

// ── Decay engine ───────────────────────────────────────────────────────────────

export function applyAttentionDecay(): void {
  const now = Date.now();
  _decayApplicationCount++;

  _attentionSlots = _attentionSlots
    .map((slot) => {
      const elapsedMin = (now - slot.lastReferenced) / 60_000;
      const decayed = slot.salience * Math.pow(1 - slot.decayRatePerMin, elapsedMin);
      return { ...slot, salience: Math.max(0, decayed) };
    })
    .filter((slot) => {
      if (slot.salience < SALIENCE_EVICTION_THRESHOLD) {
        emitCognitionEvent("memory_evicted", { tier: "attention", id: slot.id });
        return false;
      }
      return true;
    });

  // Decay conversation momentum (halves every 10 minutes of inactivity)
  const lastTrace = _inferenceTraces[_inferenceTraces.length - 1];
  if (lastTrace) {
    const idleMin = (now - lastTrace.timestamp) / 60_000;
    _conversationMomentum = _conversationMomentum * Math.pow(0.5, idleMin / 10);
  }
}

// Auto-decay interval
let _decayInterval: ReturnType<typeof setInterval> | null = null;

export function startCognitiveDecay(): void {
  if (_decayInterval) return;
  _decayInterval = setInterval(applyAttentionDecay, DECAY_INTERVAL_MS);
}

export function stopCognitiveDecay(): void {
  if (_decayInterval) { clearInterval(_decayInterval); _decayInterval = null; }
}

// ── Goal management ────────────────────────────────────────────────────────────

export function addActiveGoal(description: string, priority = 0.5): string {
  if (_activeGoals.length >= MAX_ACTIVE_GOALS) {
    // Replace lowest priority goal
    const lowest = _activeGoals.reduce((min, g) => g.priority < min.priority ? g : min);
    _activeGoals = _activeGoals.filter((g) => g.id !== lowest.id);
  }
  const goal: ActiveGoal = {
    id: nextId("goal"), description, priority,
    progress: 0, createdAt: Date.now(), lastUpdatedAt: Date.now(), evidenceCount: 0,
  };
  _activeGoals.push(goal);
  _activeGoals.sort((a, b) => b.priority - a.priority);
  emitCognitionEvent("goal_added", { id: goal.id, description, priority });
  return goal.id;
}

export function updateGoalProgress(goalId: string, progress: number, evidenceDelta = 1): void {
  const goal = _activeGoals.find((g) => g.id === goalId);
  if (!goal) return;
  goal.progress = Math.max(0, Math.min(1, progress));
  goal.evidenceCount += evidenceDelta;
  goal.lastUpdatedAt = Date.now();
}

export function resolveGoal(goalId: string): void {
  _activeGoals = _activeGoals.filter((g) => g.id !== goalId);
  emitCognitionEvent("goal_resolved", { id: goalId });
}

export function getActiveGoals(): ActiveGoal[] {
  return [..._activeGoals];
}

// ── Emotional continuity ───────────────────────────────────────────────────────

export function updateEmotionalContinuity(valence: number, arousal: number, dominantEmotion?: string): void {
  const prevValence = _emotionalState.valence;
  _emotionalState.valence = _emotionalState.valence * (1 - EMOTIONAL_EMA_ALPHA) + valence * EMOTIONAL_EMA_ALPHA;
  _emotionalState.arousal = _emotionalState.arousal * (1 - EMOTIONAL_EMA_ALPHA) + arousal * EMOTIONAL_EMA_ALPHA;
  if (dominantEmotion) _emotionalState.dominantEmotion = dominantEmotion;

  const delta = _emotionalState.valence - prevValence;
  _emotionalState.trend = Math.abs(delta) < 0.05 ? "stable" : delta > 0 ? "improving" : "declining";

  if (Math.abs(delta) > 0.2) {
    _emotionalState.lastShiftAt = Date.now();
    _emotionalState.shiftCount++;
    emitCognitionEvent("emotional_shift", { valence: _emotionalState.valence, trend: _emotionalState.trend });
  }
}

export function getEmotionalState(): EmotionalState {
  return { ..._emotionalState };
}

// ── Unresolved topics ─────────────────────────────────────────────────────────

export function addUnresolvedTopic(topic: string, urgency = 0.5): string {
  if (_unresolvedTopics.length >= MAX_UNRESOLVED_TOPICS) {
    // Evict least urgent
    const leastUrgent = _unresolvedTopics.reduce((min, t) => t.urgency < min.urgency ? t : min);
    _unresolvedTopics = _unresolvedTopics.filter((t) => t.id !== leastUrgent.id);
  }
  const existing = _unresolvedTopics.find((t) => t.topic.toLowerCase() === topic.toLowerCase());
  if (existing) { existing.urgency = Math.min(1, existing.urgency + 0.1); existing.mentionCount++; return existing.id; }

  const t: UnresolvedTopic = { id: nextId("unres"), topic, urgency, mentionedAt: Date.now(), mentionCount: 1 };
  _unresolvedTopics.push(t);
  _unresolvedTopics.sort((a, b) => b.urgency - a.urgency);
  return t.id;
}

export function resolveTopics(topicIds: string[]): void {
  _unresolvedTopics = _unresolvedTopics.filter((t) => !topicIds.includes(t.id));
}

export function getUnresolvedTopics(): UnresolvedTopic[] { return [..._unresolvedTopics]; }

// ── Inference trace recording ──────────────────────────────────────────────────

export function recordInferenceTrace(trace: InferenceTrace): void {
  _inferenceTraces.push(trace);
  if (_inferenceTraces.length > MAX_INFERENCE_TRACES) _inferenceTraces.shift();

  // Boost conversation momentum on each inference
  _conversationMomentum = Math.min(1, _conversationMomentum + 0.15);
}

export function getRecentTraces(n = 5): InferenceTrace[] {
  return _inferenceTraces.slice(-n);
}

// ── Checkpoint / restore ───────────────────────────────────────────────────────

type SerializedState = {
  sessionId: string;
  attentionSlots: AttentionSlot[];
  activeGoals: ActiveGoal[];
  unresolvedTopics: UnresolvedTopic[];
  inferenceTraces: InferenceTrace[];
  emotionalState: EmotionalState;
  conversationMomentum: number;
  checkpointAt: number;
};

export function checkpointCognitiveState(): void {
  const snapshot: SerializedState = {
    sessionId: getCognitionSessionId(),
    attentionSlots: _attentionSlots,
    activeGoals: _activeGoals,
    unresolvedTopics: _unresolvedTopics,
    inferenceTraces: _inferenceTraces,
    emotionalState: _emotionalState,
    conversationMomentum: _conversationMomentum,
    checkpointAt: Date.now(),
  };
  try {
    sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(snapshot));
    _lastCheckpointAt = snapshot.checkpointAt;
    emitCognitionEvent("cognition_checkpoint_created", { checkpointAt: snapshot.checkpointAt });
  } catch { /* storage unavailable */ }
}

export function restoreCognitiveStateFromCheckpoint(): boolean {
  try {
    const raw = sessionStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as SerializedState;
    _attentionSlots = snap.attentionSlots ?? [];
    _activeGoals = snap.activeGoals ?? [];
    _unresolvedTopics = snap.unresolvedTopics ?? [];
    _inferenceTraces = snap.inferenceTraces ?? [];
    _emotionalState = snap.emotionalState ?? _emotionalState;
    _conversationMomentum = snap.conversationMomentum ?? 0;
    _lastCheckpointAt = snap.checkpointAt;
    emitCognitionEvent("continuity_restored", { fromCheckpoint: snap.checkpointAt, sessionId: snap.sessionId });
    return true;
  } catch { return false; }
}

export function getCognitiveStateCheckpointAge(): number | null {
  if (!_lastCheckpointAt) return null;
  return Date.now() - _lastCheckpointAt;
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getCognitiveStateReport(): CognitiveStateReport {
  return {
    sessionId: getCognitionSessionId(),
    attentionSlotCount: _attentionSlots.length,
    attentionSlots: _attentionSlots.map((s) => ({ content: s.content, salience: s.salience, semanticType: s.semanticType })),
    activeGoalCount: _activeGoals.length,
    activeGoals: _activeGoals.map((g) => ({ description: g.description, priority: g.priority, progress: g.progress })),
    emotionalValence: _emotionalState.valence,
    emotionalArousal: _emotionalState.arousal,
    dominantEmotion: _emotionalState.dominantEmotion,
    conversationMomentum: _conversationMomentum,
    unresolvedTopicCount: _unresolvedTopics.length,
    recentTraceCount: _inferenceTraces.length,
    isCheckpointed: _lastCheckpointAt !== null,
    lastCheckpointAgeMs: getCognitiveStateCheckpointAge(),
    decayApplicationCount: _decayApplicationCount,
  };
}

export function resetCognitiveState(): void {
  _attentionSlots = [];
  _activeGoals = [];
  _unresolvedTopics = [];
  _inferenceTraces = [];
  _conversationMomentum = 0;
  _emotionalState = { valence: 0, arousal: 0.3, dominantEmotion: "calm", trend: "stable", lastShiftAt: Date.now(), shiftCount: 0 };
  try { sessionStorage.removeItem(CHECKPOINT_KEY); } catch { /* */ }
}

// Start decay on module load
startCognitiveDecay();
