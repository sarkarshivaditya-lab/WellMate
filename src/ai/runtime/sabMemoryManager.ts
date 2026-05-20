// SharedArrayBuffer inference memory manager.
//
// Manages a pool of SAB allocations for:
//   - Cancel flags: Int32Array[1] — 0=running, 1=cancel
//   - Token ring buffers: shared between inference worker and streaming consumer
//   - Inference state regions: progress, token count, status flags
//
// When SAB is unavailable (no COOP/COEP), all allocations gracefully return null.
// Callers must handle null and fall back to postMessage-based coordination.
//
// Memory pressure awareness: if navigator.deviceMemory < 4GB or heap estimate
// is high, shrinks ring buffer sizes. All SABs are cleaned up on model eviction.

export type SabAllocation = {
  id: string;
  purpose: "cancel_flag" | "token_ring_buffer" | "inference_state";
  sizeBytes: number;
  buffer: SharedArrayBuffer;
  allocatedAt: number;
};

export type TokenRingBuffer = {
  allocation: SabAllocation;
  // Layout: [writeHead: Int32, readHead: Int32, length: Int32, data: Uint8Array...]
  writeHead: Int32Array;
  readHead: Int32Array;
  length: Int32Array;
  data: Uint8Array;
  capacity: number;
};

export type SabMemoryReport = {
  available: boolean;
  totalAllocations: number;
  totalBytes: number;
  allocationsByPurpose: Record<SabAllocation["purpose"], number>;
  memoryPressure: "low" | "moderate" | "high";
};

const _allocations = new Map<string, SabAllocation>();
let _idCounter = 0;

function nextId(purpose: string): string {
  return `sab-${purpose.slice(0, 4)}-${Date.now()}-${_idCounter++}`;
}

// ── SAB availability ───────────────────────────────────────────────────────────

export function isSabAvailable(): boolean {
  try {
    new SharedArrayBuffer(4);
    return true;
  } catch {
    return false;
  }
}

// ── Memory pressure estimation ─────────────────────────────────────────────────

function estimateMemoryPressure(): "low" | "moderate" | "high" {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const gb = nav.deviceMemory ?? null;
  if (gb === null) return "moderate";
  if (gb >= 6) return "low";
  if (gb >= 3) return "moderate";
  return "high";
}

function tokenRingBufferSize(): number {
  const pressure = estimateMemoryPressure();
  // Token ring buffer: stores UTF-8 encoded tokens
  if (pressure === "low") return 64 * 1024; // 64KB — enough for ~16k tokens
  if (pressure === "moderate") return 16 * 1024; // 16KB — enough for ~4k tokens
  return 4 * 1024; // 4KB — minimal for constrained devices
}

// ── Allocators ─────────────────────────────────────────────────────────────────

export function allocateCancelFlag(): SabAllocation | null {
  if (!isSabAvailable()) return null;
  try {
    const buffer = new SharedArrayBuffer(4);
    const id = nextId("cancel_flag");
    const alloc: SabAllocation = { id, purpose: "cancel_flag", sizeBytes: 4, buffer, allocatedAt: Date.now() };
    _allocations.set(id, alloc);
    // Initialize to 0 (running)
    new Int32Array(buffer)[0] = 0;
    return alloc;
  } catch { return null; }
}

export function allocateTokenRingBuffer(): TokenRingBuffer | null {
  if (!isSabAvailable()) return null;
  const capacity = tokenRingBufferSize();
  // Layout: Int32[0] = writeHead, Int32[1] = readHead, Int32[2] = length, rest = data
  const headerBytes = 12; // 3 × Int32
  const totalBytes = headerBytes + capacity;

  try {
    const buffer = new SharedArrayBuffer(totalBytes);
    const id = nextId("token_ring_buffer");
    const alloc: SabAllocation = {
      id, purpose: "token_ring_buffer", sizeBytes: totalBytes, buffer, allocatedAt: Date.now(),
    };
    _allocations.set(id, alloc);

    return {
      allocation: alloc,
      writeHead: new Int32Array(buffer, 0, 1),
      readHead: new Int32Array(buffer, 4, 1),
      length: new Int32Array(buffer, 8, 1),
      data: new Uint8Array(buffer, headerBytes),
      capacity,
    };
  } catch { return null; }
}

export function allocateInferenceState(): SabAllocation | null {
  if (!isSabAvailable()) return null;
  // State region: 64 bytes — status flags, token count, progress %, error code
  try {
    const buffer = new SharedArrayBuffer(64);
    const id = nextId("inference_state");
    const alloc: SabAllocation = { id, purpose: "inference_state", sizeBytes: 64, buffer, allocatedAt: Date.now() };
    _allocations.set(id, alloc);
    new Int32Array(buffer).fill(0);
    return alloc;
  } catch { return null; }
}

// ── Token ring buffer operations ───────────────────────────────────────────────

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

// Write a token to the ring buffer (called from inference thread/context)
export function writeToken(ring: TokenRingBuffer, token: string): boolean {
  const encoded = _encoder.encode(token);
  const needed = encoded.length + 4; // 4-byte length prefix
  if (needed > ring.capacity) return false; // token too large

  const write = Atomics.load(ring.writeHead, 0);
  const read = Atomics.load(ring.readHead, 0);
  const used = (write - read + ring.capacity) % ring.capacity;
  if (used + needed > ring.capacity - 1) return false; // buffer full

  // Write length prefix
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, encoded.length, true);
  for (let i = 0; i < 4; i++) {
    ring.data[(write + i) % ring.capacity] = lenBytes[i];
  }
  // Write data
  for (let i = 0; i < encoded.length; i++) {
    ring.data[(write + 4 + i) % ring.capacity] = encoded[i];
  }

  Atomics.store(ring.writeHead, 0, (write + needed) % ring.capacity);
  Atomics.add(ring.length, 0, 1);
  return true;
}

// Read next token from ring buffer (called from consumer thread)
export function readToken(ring: TokenRingBuffer): string | null {
  const write = Atomics.load(ring.writeHead, 0);
  const read = Atomics.load(ring.readHead, 0);
  if (read === write) return null; // empty

  const lenBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) lenBytes[i] = ring.data[(read + i) % ring.capacity];
  const len = new DataView(lenBytes.buffer).getUint32(0, true);

  const data = new Uint8Array(len);
  for (let i = 0; i < len; i++) data[i] = ring.data[(read + 4 + i) % ring.capacity];

  Atomics.store(ring.readHead, 0, (read + 4 + len) % ring.capacity);
  return _decoder.decode(data);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

export function freeAllocation(id: string): void {
  _allocations.delete(id);
  // SABs are GC'd when no references remain — we just drop our Map entry
}

export function freeAllAllocations(): void {
  _allocations.clear();
}

// ── Report ─────────────────────────────────────────────────────────────────────

export function getSabMemoryReport(): SabMemoryReport {
  const allocs = [..._allocations.values()];
  const byPurpose: Record<SabAllocation["purpose"], number> = {
    cancel_flag: 0, token_ring_buffer: 0, inference_state: 0,
  };
  let totalBytes = 0;
  for (const a of allocs) {
    byPurpose[a.purpose]++;
    totalBytes += a.sizeBytes;
  }
  return {
    available: isSabAvailable(),
    totalAllocations: allocs.length,
    totalBytes,
    allocationsByPurpose: byPurpose,
    memoryPressure: estimateMemoryPressure(),
  };
}
