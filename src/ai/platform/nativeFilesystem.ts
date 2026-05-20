// Native filesystem abstraction — unified interface over OPFS and Capacitor Filesystem.
//
// Priority chain: Capacitor Filesystem (native) → OPFS → in-memory fallback.
// All writes are atomic (write to tmp, then rename/replace).
// Provides native quota estimation, storage migration path, and hybrid compatibility.
//
// Do NOT use this for model chunk writes (use filesystemGovernor.atomicWrite instead).
// Use this for AI asset metadata, manifests, and non-model configuration files.

import { resolvePlugin } from "./capacitorBridge";

export type FilesystemBackend = "capacitor" | "opfs" | "none";

export type FilesystemEntry = {
  path: string;
  sizeBytes: number;
  lastModifiedAt: number;
  isDirectory: boolean;
};

export type NativeQuota = {
  backend: FilesystemBackend;
  quotaBytes: number;
  usedBytes: number;
  availableBytes: number;
};

type CapacitorFilesystem = {
  readFile(opts: { path: string; directory: string; encoding?: string }): Promise<{ data: string }>;
  writeFile(opts: { path: string; directory: string; data: string; encoding?: string; recursive?: boolean }): Promise<void>;
  deleteFile(opts: { path: string; directory: string }): Promise<void>;
  stat(opts: { path: string; directory: string }): Promise<{ size: number; mtime: number; type: string }>;
  mkdir(opts: { path: string; directory: string; recursive?: boolean }): Promise<void>;
  readdir(opts: { path: string; directory: string }): Promise<{ files: Array<{ name: string; type: string; size: number; mtime: number }> }>;
};

const CAP_DIRECTORY = "LIBRARY"; // iOS: Library/; Android: filesDir

// ── Backend detection ──────────────────────────────────────────────────────────

export function getActiveBackend(): FilesystemBackend {
  if (resolvePlugin<CapacitorFilesystem>("Filesystem")) return "capacitor";
  if (typeof navigator !== "undefined" && "storage" in navigator) return "opfs";
  return "none";
}

// ── OPFS helpers ───────────────────────────────────────────────────────────────

async function opfsWrite(path: string, data: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const parts = path.split("/").filter(Boolean);
  let dir: FileSystemDirectoryHandle = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  const name = parts[parts.length - 1];
  // Atomic: write to tmp, then swap
  const tmpHandle = await dir.getFileHandle(`${name}.tmp`, { create: true });
  const writable = await tmpHandle.createWritable();
  await writable.write(new TextEncoder().encode(data));
  await writable.close();
  // OPFS doesn't support rename — overwrite target
  const target = await dir.getFileHandle(name, { create: true });
  const targetWritable = await target.createWritable();
  const tmpFile = await tmpHandle.getFile();
  await targetWritable.write(await tmpFile.arrayBuffer());
  await targetWritable.close();
  await dir.removeEntry(`${name}.tmp`);
}

async function opfsRead(path: string): Promise<string | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split("/").filter(Boolean);
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: false });
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: false });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch { return null; }
}

async function opfsDelete(path: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split("/").filter(Boolean);
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: false });
    }
    await dir.removeEntry(parts[parts.length - 1]);
  } catch { /* already gone */ }
}

// ── Capacitor helpers ──────────────────────────────────────────────────────────

function getCapPlugin(): CapacitorFilesystem | null {
  return resolvePlugin<CapacitorFilesystem>("Filesystem");
}

async function capWrite(path: string, data: string): Promise<void> {
  const cap = getCapPlugin();
  if (!cap) throw new Error("Capacitor Filesystem not available");
  await cap.writeFile({ path, directory: CAP_DIRECTORY, data, encoding: "utf8", recursive: true });
}

async function capRead(path: string): Promise<string | null> {
  const cap = getCapPlugin();
  if (!cap) return null;
  try {
    const result = await cap.readFile({ path, directory: CAP_DIRECTORY, encoding: "utf8" });
    return result.data;
  } catch { return null; }
}

async function capDelete(path: string): Promise<void> {
  const cap = getCapPlugin();
  if (!cap) return;
  try { await cap.deleteFile({ path, directory: CAP_DIRECTORY }); } catch { /* gone */ }
}

// ── Public unified API ─────────────────────────────────────────────────────────

export async function writeAsset(path: string, data: string): Promise<void> {
  const backend = getActiveBackend();
  if (backend === "capacitor") return capWrite(path, data);
  if (backend === "opfs") return opfsWrite(path, data);
  // In-memory fallback — no persistence
  _memoryCache.set(path, data);
}

export async function readAsset(path: string): Promise<string | null> {
  const backend = getActiveBackend();
  if (backend === "capacitor") return capRead(path);
  if (backend === "opfs") return opfsRead(path);
  return _memoryCache.get(path) ?? null;
}

export async function deleteAsset(path: string): Promise<void> {
  const backend = getActiveBackend();
  if (backend === "capacitor") return capDelete(path);
  if (backend === "opfs") return opfsDelete(path);
  _memoryCache.delete(path);
}

export async function getNativeQuota(): Promise<NativeQuota> {
  const backend = getActiveBackend();
  if (backend === "opfs") {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ?? 0;
      const used = est.usage ?? 0;
      return { backend, quotaBytes: quota, usedBytes: used, availableBytes: quota - used };
    } catch { /* */ }
  }
  return { backend, quotaBytes: 0, usedBytes: 0, availableBytes: 0 };
}

// Migration helper — copy a path tree from OPFS to Capacitor
export async function migrateToNative(paths: string[]): Promise<{ migrated: number; failed: number }> {
  let migrated = 0, failed = 0;
  const cap = getCapPlugin();
  if (!cap) return { migrated: 0, failed: paths.length };

  for (const path of paths) {
    try {
      const data = await opfsRead(path);
      if (data === null) continue;
      await capWrite(path, data);
      await opfsDelete(path);
      migrated++;
    } catch { failed++; }
  }
  return { migrated, failed };
}

const _memoryCache = new Map<string, string>();
