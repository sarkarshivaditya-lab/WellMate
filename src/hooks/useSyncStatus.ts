import { useState, useEffect } from "react";
import {
  getSyncStatus,
  getSyncSummary,
  subscribeToSyncStatus,
  type SyncStatus,
  type SyncSummary,
} from "@/sync/syncStatus";

export function useSyncStatus(): { status: SyncStatus; summary: SyncSummary } {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [summary, setSummary] = useState<SyncSummary>(getSyncSummary);

  useEffect(() => {
    return subscribeToSyncStatus(() => {
      setStatus(getSyncStatus());
      setSummary(getSyncSummary());
    });
  }, []);

  return { status, summary };
}
