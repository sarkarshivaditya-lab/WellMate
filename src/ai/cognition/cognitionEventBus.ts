// Cognition Event Bus — typed lifecycle events for the persistent cognition architecture.
//
// All cognition systems emit events through this bus. Downstream systems
// (observability, orchestration, safety governor) subscribe to react.
//
// This is a LOCAL, synchronous pub/sub — no network, no async, no promises.
// Event handlers must be fast (<1ms). Slow work belongs in subscribers.

export type CognitionEventType =
  | "memory_promoted"
  | "memory_evicted"
  | "reflection_generated"
  | "contradiction_detected"
  | "continuity_restored"
  | "salience_shift"
  | "working_memory_overflow"
  | "user_model_updated"
  | "cognition_checkpoint_created"
  | "context_budget_exceeded"
  | "goal_added"
  | "goal_resolved"
  | "emotional_shift"
  | "safety_violation";

export type CognitionEvent = {
  eventType: CognitionEventType;
  data: Record<string, unknown>;
  emittedAt: number;
  sessionId: string;
};

type EventHandler = (event: CognitionEvent) => void;

// ── Bus state ──────────────────────────────────────────────────────────────────

const _handlers = new Map<CognitionEventType, Set<EventHandler>>();
const _log: CognitionEvent[] = [];
const MAX_LOG = 200;

let _sessionId = `cog-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

export function setCognitionSessionId(id: string): void { _sessionId = id; }
export function getCognitionSessionId(): string { return _sessionId; }

// ── Pub/sub ────────────────────────────────────────────────────────────────────

export function onCognitionEvent(type: CognitionEventType, handler: EventHandler): () => void {
  if (!_handlers.has(type)) _handlers.set(type, new Set());
  _handlers.get(type)!.add(handler);
  return () => _handlers.get(type)?.delete(handler);
}

export function offCognitionEvent(type: CognitionEventType, handler: EventHandler): void {
  _handlers.get(type)?.delete(handler);
}

export function emitCognitionEvent(type: CognitionEventType, data: Record<string, unknown> = {}): void {
  const event: CognitionEvent = { eventType: type, data, emittedAt: Date.now(), sessionId: _sessionId };

  // Log first (handlers may fail without affecting log)
  _log.push(event);
  if (_log.length > MAX_LOG) _log.shift();

  // Dispatch synchronously — handlers must be fast
  for (const handler of (_handlers.get(type) ?? [])) {
    try { handler(event); } catch { /* isolate handler failures */ }
  }
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getRecentCognitionEvents(n = 50): CognitionEvent[] {
  return _log.slice(-n);
}

export function getCognitionEventsByType(type: CognitionEventType, n = 20): CognitionEvent[] {
  return _log.filter((e) => e.eventType === type).slice(-n);
}

export function getCognitionEventBusStats(): {
  totalEvents: number;
  logSize: number;
  subscriberCount: Record<string, number>;
  recentEventTypes: string[];
} {
  const subscriberCount: Record<string, number> = {};
  for (const [type, handlers] of _handlers) subscriberCount[type] = handlers.size;
  const recentEventTypes = _log.slice(-10).map((e) => e.eventType);
  return { totalEvents: _log.length, logSize: _log.length, subscriberCount, recentEventTypes };
}
