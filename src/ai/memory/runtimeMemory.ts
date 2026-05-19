// Short-term in-session inference memory.
// Maintains a rolling conversation window for multi-turn context.
// Entirely separate from WellMate's longitudinal memory layer —
// this only lives for the duration of the current app session.

export type MemoryRole = "user" | "assistant" | "system";

export type MemoryTurn = {
  id: string;
  role: MemoryRole;
  content: string;
  timestamp: number;
  tokenEstimate: number;
};

const MAX_TURNS = 20;
const TOKEN_BUDGET = 2048; // rolling budget across all retained turns

let _turns: MemoryTurn[] = [];

function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

function prune(): void {
  while (_turns.length > MAX_TURNS) {
    _turns.shift();
  }
  let total = _turns.reduce((s, t) => s + t.tokenEstimate, 0);
  while (total > TOKEN_BUDGET && _turns.length > 0) {
    const removed = _turns.shift()!;
    total -= removed.tokenEstimate;
  }
}

export function appendTurn(role: MemoryRole, content: string): MemoryTurn {
  const turn: MemoryTurn = {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    tokenEstimate: estimate(content),
  };
  _turns.push(turn);
  prune();
  return turn;
}

export function getRecentTurns(maxTurns?: number): MemoryTurn[] {
  const turns = [..._turns];
  return maxTurns !== undefined ? turns.slice(-maxTurns) : turns;
}

export function serializeTurnsForPrompt(maxTurns = 6): string {
  return getRecentTurns(maxTurns)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");
}

export function clearSessionMemory(): void {
  _turns = [];
}

export function getMemoryStats(): { turns: number; tokens: number } {
  return {
    turns: _turns.length,
    tokens: _turns.reduce((s, t) => s + t.tokenEstimate, 0),
  };
}
