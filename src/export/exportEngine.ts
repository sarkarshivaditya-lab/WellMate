// src/export/exportEngine.ts
// Orchestrates data export — builds payload, triggers browser download.
// All data is read from localStorage. Zero network required.

import { buildExportPayload } from "./exportSerializer";
import { generatePortableSummary } from "./portableSummaryGenerator";

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportFilename(ext: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `wellmate-export-${date}.${ext}`;
}

export function exportAsJSON(): void {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  triggerDownload(json, exportFilename("json"), "application/json");
}

export function exportAsText(): void {
  const payload = buildExportPayload();
  const text = generatePortableSummary(payload);
  triggerDownload(text, exportFilename("txt"), "text/plain");
}

export type ExportStatus = "idle" | "exporting" | "done" | "error";
