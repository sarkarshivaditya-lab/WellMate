// SAB Token Stream — true shared-memory token delivery with postMessage fallback.
//
// Provides a unified streaming interface regardless of SAB availability:
//
//   SAB path  (COOP/COEP active):
//     Worker writes tokens to SharedArrayBuffer ring via Atomics.
//     Main thread drains ring at 16ms intervals (60fps) — zero IPC overhead.
//
//   Fallback path (isolation not active):
//     Worker posts { type: "token", token } messages.
//     SabTokenChannel wraps both paths behind the same interface.
//
// Each channel has a writer (used in worker/producer) and a reader (main thread).
// Channels are one-shot: created per inference request, released on completion.

import { allocateTokenRingBuffer, writeToken, readToken, type TokenRingBuffer } from "./sabMemoryManager";
import { isIsolationSufficient } from "../platform/coopCoepVerifier";

// ── Channel types ─────────────────────────────────────────────────────────────

export type TokenStreamMode = "sab_ring" | "postmessage";

export type SabTokenChannel = {
  channelId: string;
  mode: TokenStreamMode;
  ring: TokenRingBuffer | null;    // null when mode=postmessage
  allocatedAt: number;
  tokensWritten: number;
  tokensRead: number;
  fallbackCount: number;           // tokens that fell back to postMessage due to ring full
};

export type SabStreamStats = {
  totalChannels: number;
  activeChannels: number;
  sabModeChannels: number;
  postMessageModeChannels: number;
  totalTokensDelivered: number;
  totalFallbackTokens: number;
  averageDrainLatencyMs: number | null;
};

// ── Channel registry ──────────────────────────────────────────────────────────

const _channels = new Map<string, SabTokenChannel>();
let _channelIdCounter = 0;
let _totalTokensDelivered = 0;
let _totalFallbackTokens = 0;
const _drainLatencies: number[] = [];

function nextChannelId(): string { return `stc-${Date.now()}-${_channelIdCounter++}`; }

// ── Channel creation ──────────────────────────────────────────────────────────

export function createSabTokenChannel(): SabTokenChannel {
  const useSab = isIsolationSufficient();
  const ring = useSab ? allocateTokenRingBuffer() : null;

  const channel: SabTokenChannel = {
    channelId: nextChannelId(),
    mode: ring ? "sab_ring" : "postmessage",
    ring: ring ?? null,
    allocatedAt: Date.now(),
    tokensWritten: 0,
    tokensRead: 0,
    fallbackCount: 0,
  };
  _channels.set(channel.channelId, channel);
  return channel;
}

export function releaseChannel(channelId: string): void {
  const ch = _channels.get(channelId);
  if (ch) {
    _totalTokensDelivered += ch.tokensRead;
    _totalFallbackTokens += ch.fallbackCount;
  }
  _channels.delete(channelId);
}

// ── Write path (producer / worker side) ──────────────────────────────────────

export type WriteResult = "delivered" | "ring_full_use_postmessage" | "no_ring_use_postmessage";

export function writeTokenToChannel(channel: SabTokenChannel, token: string): WriteResult {
  if (!channel.ring) return "no_ring_use_postmessage";
  const delivered = writeToken(channel.ring, token);
  if (delivered) {
    channel.tokensWritten++;
    return "delivered";
  }
  channel.fallbackCount++;
  return "ring_full_use_postmessage";
}

// ── Read path (consumer / main thread) ────────────────────────────────────────

export type SabTokenReader = {
  start(onToken: (token: string) => void): void;
  stop(): void;
  drainOnce(onToken: (token: string) => void): number; // returns count drained
};

export function createTokenReader(channel: SabTokenChannel): SabTokenReader {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let running = false;

  return {
    start(onToken: (token: string) => void): void {
      if (running || !channel.ring) return;
      running = true;
      intervalId = setInterval(() => {
        const t0 = performance.now();
        let count = 0;
        let token: string | null;
        while (channel.ring && (token = readToken(channel.ring)) !== null) {
          onToken(token);
          channel.tokensRead++;
          count++;
        }
        if (count > 0) {
          _drainLatencies.push(performance.now() - t0);
          if (_drainLatencies.length > 200) _drainLatencies.shift();
        }
      }, 16);
    },

    stop(): void {
      running = false;
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    },

    drainOnce(onToken: (token: string) => void): number {
      if (!channel.ring) return 0;
      let count = 0;
      let token: string | null;
      while ((token = readToken(channel.ring)) !== null) {
        onToken(token);
        channel.tokensRead++;
        count++;
      }
      return count;
    },
  };
}

// ── Unified stream bridge ──────────────────────────────────────────────────────
// Wraps both SAB and postMessage paths behind one interface.
// The caller calls onPostMessageToken() for each postMessage-delivered token.

export type StreamBridgeHandle = {
  channel: SabTokenChannel;
  reader: SabTokenReader | null;
  onPostMessageToken(token: string): void;
  start(onToken: (token: string) => void): void;
  stop(): void;
};

export function createStreamBridge(): StreamBridgeHandle {
  const channel = createSabTokenChannel();
  const reader = channel.ring ? createTokenReader(channel) : null;
  let _onToken: ((token: string) => void) | null = null;

  return {
    channel,
    reader,
    onPostMessageToken(token: string): void {
      channel.tokensRead++;
      _onToken?.(token);
    },
    start(onToken: (token: string) => void): void {
      _onToken = onToken;
      reader?.start(onToken);
    },
    stop(): void {
      reader?.stop();
      _onToken = null;
      releaseChannel(channel.channelId);
    },
  };
}

// ── Observability ──────────────────────────────────────────────────────────────

export function getSabStreamStats(): SabStreamStats {
  const active = [..._channels.values()];
  const avgDrain = _drainLatencies.length > 0
    ? _drainLatencies.reduce((s, v) => s + v, 0) / _drainLatencies.length
    : null;

  return {
    totalChannels: _channelIdCounter,
    activeChannels: active.length,
    sabModeChannels: active.filter((c) => c.mode === "sab_ring").length,
    postMessageModeChannels: active.filter((c) => c.mode === "postmessage").length,
    totalTokensDelivered: _totalTokensDelivered + active.reduce((s, c) => s + c.tokensRead, 0),
    totalFallbackTokens: _totalFallbackTokens + active.reduce((s, c) => s + c.fallbackCount, 0),
    averageDrainLatencyMs: avgDrain,
  };
}
