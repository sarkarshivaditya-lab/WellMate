import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import {
  getAllLocalSleep,
  subscribeToSleep,
  type LocalSleepLog,
} from "@/data/local/sleepStore";

/**
 * Reactive hook that returns sleep logs from the local store.
 * Automatically re-renders when a new log is added.
 */
export function useAllSleepLogs(): LocalSleepLog[] {
  return useSyncExternalStore(
    subscribeToSleep,
    getAllLocalSleep,
    getAllLocalSleep,
  );
}

/**
 * Returns sleep logs from the past N days, sorted newest first.
 * Reactive — re-renders when any log is added.
 */
export function useRecentSleepLogs(days = 7): LocalSleepLog[] {
  const all = useAllSleepLogs();

  return useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    return all
      .filter((s) => s.startIso >= cutoffIso)
      .sort((a, b) => b.startIso.localeCompare(a.startIso));
  }, [all, days]);
}
