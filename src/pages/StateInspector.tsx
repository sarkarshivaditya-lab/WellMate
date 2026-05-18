// src/pages/StateInspector.tsx
// DEVELOPMENT ONLY — never routed in production builds (import.meta.env.DEV gate in App.tsx)

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// Reliability imports
import {
  getReplayLog,
  subscribeToReplayLog,
  clearReplayLog,
  getReplayEntitySummaries,
  type ReplayEntry,
  type ReplayEventType,
} from "@/reliability/replayLog";
import {
  getOperationQueue,
  getDeadLetterQueue,
  getPendingOperations,
  getQueueSummary,
  subscribeToOperationQueue,
  restoreFromDeadLetter,
  discardDeadLetter,
  cancelOperation,
  resetStrandedSyncingOps,
  type QueuedOperation,
} from "@/reliability/operationQueue";
import {
  getConflictLog,
  subscribeToConflictLog,
  clearConflictLog,
  type ConflictRecord,
} from "@/reliability/conflictResolver";
import {
  getDiagnosticsSnapshot,
  subscribeToDiagnostics,
  resetDiagnostics,
  type DiagnosticEvent,
} from "@/reliability/diagnostics";
import {
  getHydrationState,
  subscribeToHydration,
  type HydrationState,
} from "@/reliability/hydration";
import {
  getConnectivity,
  subscribeToConnectivity,
  type ConnectivityState,
} from "@/reliability/connectivity";
import {
  getStorageHealth,
  getQuarantineEntries,
  clearQuarantine,
  type StorageHealthReport,
} from "@/reliability/persistence";
import { requestSync } from "@/reliability/lifecycleCoordinator";

/* --------------------------------------------------
   COLOUR HELPERS
   -------------------------------------------------- */

function eventColor(event: ReplayEventType): string {
  switch (event) {
    case "committed":    return "text-blue-400";
    case "synced":       return "text-green-400";
    case "failed":       return "text-orange-400";
    case "dead_lettered": return "text-red-400";
    case "conflict":     return "text-yellow-400";
    case "restored":     return "text-purple-400";
    case "cancelled":    return "text-muted-foreground";
  }
}

function statusColor(status: QueuedOperation["status"]): string {
  switch (status) {
    case "pending":          return "text-yellow-400";
    case "syncing":          return "text-blue-400";
    case "synced":           return "text-green-400";
    case "failed":           return "text-orange-400";
    case "retry_scheduled":  return "text-yellow-300";
    case "conflict":         return "text-yellow-500";
    case "dead_letter":      return "text-red-400";
    case "cancelled":        return "text-muted-foreground";
    case "tombstoned":       return "text-muted-foreground";
  }
}

function hydrationColor(status: HydrationState["status"]): string {
  switch (status) {
    case "ready":         return "text-green-400";
    case "degraded":      return "text-yellow-400";
    case "hydrating":     return "text-blue-400";
    case "stale":         return "text-orange-400";
    case "recovering":    return "text-yellow-300";
    case "restoring":     return "text-blue-300";
    case "corrupted":     return "text-red-400";
    case "failed":        return "text-red-500";
    case "uninitialized": return "text-muted-foreground";
  }
}

function lifecycleEventColor(type: string): string {
  if (type.includes("error") || type.includes("failure") || type.includes("corruption")) return "text-red-400";
  if (type.includes("conflict")) return "text-yellow-400";
  if (type.includes("auth_abort")) return "text-orange-400";
  if (type.includes("success") || type.includes("complete") || type.includes("online") || type.includes("acquired")) return "text-green-400";
  if (type.includes("offline") || type.includes("lost") || type.includes("pressure")) return "text-orange-400";
  return "text-muted-foreground";
}

/* --------------------------------------------------
   TIMESTAMP FORMATTER
   -------------------------------------------------- */

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function formatAgeMs(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3600_000)}h ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

/* --------------------------------------------------
   SECTION WRAPPER
   -------------------------------------------------- */

function Section({
  title,
  description,
  badge,
  badgeVariant = "secondary",
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  badge?: number | string;
  badgeVariant?: "secondary" | "destructive" | "outline";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-semibold tracking-wide">{title}</CardTitle>
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="text-xs h-5 px-1.5 font-mono">
              {badge}
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
        </div>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      {open && <CardContent className="pt-0 space-y-3">{children}</CardContent>}
    </Card>
  );
}

/* --------------------------------------------------
   EXPANDABLE ROW
   -------------------------------------------------- */

function ExpandableRow({
  summary,
  detail,
  summaryClass = "",
}: {
  summary: React.ReactNode;
  detail: React.ReactNode;
  summaryClass?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className={`flex w-full items-start gap-2 text-left text-xs font-mono py-1 px-2 rounded hover:bg-secondary/40 transition-colors ${summaryClass}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0 text-muted-foreground mt-0.5">{open ? "▾" : "▸"}</span>
        <span className="flex-1 min-w-0">{summary}</span>
      </button>
      {open && (
        <div className="ml-5 mt-1 px-2 py-2 bg-secondary/20 rounded text-xs font-mono space-y-1">
          {detail}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------
   FILTER BAR
   -------------------------------------------------- */

function FilterBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 pb-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------
   1. REPLAY EVENT INSPECTOR
   -------------------------------------------------- */

const REPLAY_FILTER_OPTIONS = [
  { value: "all" as const, label: "all" },
  { value: "committed" as const, label: "committed" },
  { value: "synced" as const, label: "synced" },
  { value: "failed" as const, label: "failed" },
  { value: "conflict" as const, label: "conflict" },
  { value: "dead_lettered" as const, label: "dead" },
  { value: "restored" as const, label: "restored" },
];

type ReplayFilter = ReplayEventType | "all";

function ReplayEventInspector() {
  const [entries, setEntries] = useState<readonly ReplayEntry[]>(() => getReplayLog());
  const [filter, setFilter] = useState<ReplayFilter>("all");

  useEffect(() => subscribeToReplayLog(() => setEntries(getReplayLog())), []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.event === filter);
  const reversed = [...filtered].reverse().slice(0, 100);
  const summaries = getReplayEntitySummaries();

  const handleClear = () => {
    clearReplayLog();
    setEntries([]);
    toast.info("Replay log cleared");
  };

  return (
    <Section
      title="Replay Events"
      description="Immutable audit trail of all local mutations and sync outcomes"
      badge={entries.length}
    >
      {/* Entity summaries */}
      {summaries.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono pb-1 border-b border-border/40">
          {summaries.map((s) => (
            <span key={s.entityType} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{s.entityType}</span>
              <span className="text-blue-400">+{s.committedCount}</span>
              {s.syncedCount > 0 && <span className="text-green-400">✓{s.syncedCount}</span>}
              {s.deadLetteredCount > 0 && <span className="text-red-400">✗{s.deadLetteredCount}</span>}
            </span>
          ))}
        </div>
      )}

      <FilterBar options={REPLAY_FILTER_OPTIONS} value={filter} onChange={setFilter} />

      {reversed.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No entries{filter !== "all" ? ` matching "${filter}"` : ""}</p>
      ) : (
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {reversed.map((entry) => (
            <ExpandableRow
              key={entry.id}
              summary={
                <span className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold w-20 shrink-0 ${eventColor(entry.event)}`}>{entry.event}</span>
                  <span className="text-foreground">{entry.entityType}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{entry.operationType}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{formatAgeMs(entry.ts)}</span>
                </span>
              }
              detail={
                <>
                  <div><span className="text-muted-foreground">id: </span>{entry.entityId}</div>
                  <div><span className="text-muted-foreground">op_id: </span>{entry.operationId ?? "—"}</div>
                  <div><span className="text-muted-foreground">ts: </span>{new Date(entry.ts).toISOString()}</div>
                  {entry.note && <div><span className="text-muted-foreground">note: </span>{entry.note}</div>}
                  <div><span className="text-muted-foreground">replay_id: </span>{entry.id}</div>
                </>
              }
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/30">
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleClear}>
          Clear Replay Log
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => {
            navigator.clipboard?.writeText(JSON.stringify(getReplayLog(), null, 2));
            toast.success("Replay log copied");
          }}
        >
          Copy JSON
        </Button>
      </div>
    </Section>
  );
}

/* --------------------------------------------------
   2. OPERATION QUEUE INSPECTOR
   -------------------------------------------------- */

function OpRow({
  op,
  showActions,
}: {
  op: QueuedOperation;
  showActions?: boolean;
}) {
  const retryIn = op.nextRetryAt ? Math.max(0, Math.round((op.nextRetryAt - Date.now()) / 1000)) : null;

  return (
    <ExpandableRow
      summary={
        <span className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold w-28 shrink-0 ${statusColor(op.status)}`}>{op.status}</span>
          <span className="text-foreground">{op.entityType}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{op.operationType}</span>
          {op.priority < 10 && (
            <span className="text-purple-400 text-[10px]">p{op.priority}</span>
          )}
          {retryIn !== null && (
            <span className="text-yellow-400 text-[10px]">retry in {retryIn}s</span>
          )}
          <span className="ml-auto text-muted-foreground shrink-0">{formatAgeMs(op.createdAt)}</span>
        </span>
      }
      detail={
        <>
          <div><span className="text-muted-foreground">entity_id: </span>{op.entityId}</div>
          <div><span className="text-muted-foreground">op_id: </span>{op.operationId}</div>
          <div><span className="text-muted-foreground">retries: </span>{op.retryCount} / 5</div>
          <div><span className="text-muted-foreground">priority: </span>{op.priority}</div>
          <div><span className="text-muted-foreground">conflict_v: </span>{op.conflictVersion}</div>
          <div><span className="text-muted-foreground">created: </span>{new Date(op.createdAt).toISOString()}</div>
          {op.errorReason && <div><span className="text-muted-foreground">error: </span><span className="text-red-400">{op.errorReason}</span></div>}
          {op.remoteId && <div><span className="text-muted-foreground">remote_id: </span>{op.remoteId}</div>}
          {showActions && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2"
                onClick={() => { restoreFromDeadLetter(op.operationId); toast.info("Restored to queue"); }}
              >
                Restore
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 text-xs px-2"
                onClick={() => { discardDeadLetter(op.operationId); toast.info("Discarded"); }}
              >
                Discard
              </Button>
            </div>
          )}
        </>
      }
    />
  );
}

function OperationQueueInspector() {
  const summary = useSyncExternalStore(subscribeToOperationQueue, getQueueSummary, getQueueSummary);
  const [allOps, setAllOps] = useState<readonly QueuedOperation[]>(() => getOperationQueue());
  const [deadLetter, setDeadLetter] = useState<readonly QueuedOperation[]>(() => getDeadLetterQueue());

  useEffect(() =>
    subscribeToOperationQueue(() => {
      setAllOps(getOperationQueue());
      setDeadLetter(getDeadLetterQueue());
    }),
  []);

  const pending = getPendingOperations(); // already priority-sorted
  const syncing = allOps.filter((o) => o.status === "syncing");
  const failed = allOps.filter((o) => o.status === "failed");
  const retrying = allOps.filter((o) => o.status === "retry_scheduled");
  const conflicts = allOps.filter((o) => o.status === "conflict");

  const hasAny = summary.total > 0 || deadLetter.length > 0;

  return (
    <Section
      title="Operation Queue"
      description="Unified persistent mutation queue — priority sorted"
      badge={summary.pending + summary.failed + summary.retryScheduled}
      badgeVariant={summary.deadLetter > 0 ? "destructive" : "secondary"}
    >
      {/* Summary row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono pb-2 border-b border-border/40">
        <span>pending: <span className="text-yellow-400">{summary.pending}</span></span>
        <span>syncing: <span className="text-blue-400">{summary.syncing}</span></span>
        <span>synced: <span className="text-green-400">{summary.synced}</span></span>
        <span>failed: <span className="text-orange-400">{summary.failed}</span></span>
        <span>retry: <span className="text-yellow-300">{summary.retryScheduled}</span></span>
        <span>conflict: <span className="text-yellow-500">{summary.conflict}</span></span>
        <span>dead: <span className="text-red-400">{summary.deadLetter}</span></span>
        <span>cancelled: <span className="text-muted-foreground">{summary.cancelled}</span></span>
      </div>

      {!hasAny && (
        <p className="text-xs text-muted-foreground italic">Queue is empty</p>
      )}

      {/* Pending — priority ordered */}
      {pending.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-mono">Pending (priority order)</div>
          <div className="space-y-0.5">
            {pending.map((op) => <OpRow key={op.operationId} op={op} />)}
          </div>
        </div>
      )}

      {/* Syncing */}
      {syncing.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-mono">Syncing</div>
          <div className="space-y-0.5">
            {syncing.map((op) => <OpRow key={op.operationId} op={op} />)}
          </div>
        </div>
      )}

      {/* Retry scheduled */}
      {retrying.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-mono">Retry Scheduled</div>
          <div className="space-y-0.5">
            {retrying.map((op) => <OpRow key={op.operationId} op={op} />)}
          </div>
        </div>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <div>
          <div className="text-xs text-orange-400 mb-1 font-mono">Failed</div>
          <div className="space-y-0.5">
            {failed.map((op) => <OpRow key={op.operationId} op={op} />)}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div>
          <div className="text-xs text-yellow-400 mb-1 font-mono">Conflicts</div>
          <div className="space-y-0.5">
            {conflicts.map((op) => <OpRow key={op.operationId} op={op} />)}
          </div>
        </div>
      )}

      {/* Dead letter */}
      {deadLetter.length > 0 && (
        <div>
          <div className="text-xs text-red-400 mb-1 font-mono">Dead Letter ({deadLetter.length})</div>
          <div className="space-y-0.5">
            {[...deadLetter].map((op) => <OpRow key={op.operationId} op={op} showActions />)}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/30">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => { resetStrandedSyncingOps(); toast.info("Stranded ops reset to pending"); }}
        >
          Reset Stranded
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => {
            navigator.clipboard?.writeText(JSON.stringify({ summary, ops: getOperationQueue(), deadLetter: getDeadLetterQueue() }, null, 2));
            toast.success("Queue snapshot copied");
          }}
        >
          Copy Snapshot
        </Button>
      </div>
    </Section>
  );
}

/* --------------------------------------------------
   3. CONFLICT HISTORY VIEWER
   -------------------------------------------------- */

const CONFLICT_TYPE_OPTIONS = [
  { value: "all" as const, label: "all" },
  { value: "stale_local" as const, label: "stale_local" },
  { value: "stale_remote" as const, label: "stale_remote" },
  { value: "concurrent" as const, label: "concurrent" },
  { value: "deleted_remote" as const, label: "deleted" },
  { value: "schema_mismatch" as const, label: "schema" },
];

type ConflictFilter = ConflictRecord["conflictType"] | "all";

function ConflictRow({ c }: { c: ConflictRecord }) {
  const localDate = new Date(c.localUpdatedAt).toISOString();
  const remoteDate = c.remoteUpdatedAt ? new Date(c.remoteUpdatedAt).toISOString() : "—";
  const resolutionColor =
    c.resolution === "local_kept"
      ? "text-blue-400"
      : c.resolution === "remote_accepted"
      ? "text-green-400"
      : "text-muted-foreground";

  return (
    <ExpandableRow
      summary={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-yellow-400 font-semibold w-24 shrink-0">{c.conflictType}</span>
          <span className="text-foreground">{c.entityType}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`${resolutionColor}`}>{c.resolution}</span>
          <span className="ml-auto text-muted-foreground shrink-0">{formatAgeMs(c.resolvedAt)}</span>
        </span>
      }
      detail={
        <>
          <div><span className="text-muted-foreground">entity: </span>{c.entityId}</div>
          <div><span className="text-muted-foreground">policy: </span>{c.policy}</div>
          <div><span className="text-muted-foreground">local_ts: </span>{localDate}</div>
          <div><span className="text-muted-foreground">remote_ts: </span>{remoteDate}</div>
          <div><span className="text-muted-foreground">resolved: </span>{new Date(c.resolvedAt).toISOString()}</div>
        </>
      }
    />
  );
}

function ConflictHistoryViewer() {
  const [conflicts, setConflicts] = useState<readonly ConflictRecord[]>(() => getConflictLog());
  const [filter, setFilter] = useState<ConflictFilter>("all");

  useEffect(() => subscribeToConflictLog(() => setConflicts(getConflictLog())), []);

  const filtered = filter === "all" ? conflicts : conflicts.filter((c) => c.conflictType === filter);
  const reversed = [...filtered].reverse().slice(0, 50);

  return (
    <Section
      title="Conflict History"
      description="Persisted LWW conflict resolution log — survives reloads"
      badge={conflicts.length}
      badgeVariant={conflicts.length > 0 ? "outline" : "secondary"}
    >
      <FilterBar options={CONFLICT_TYPE_OPTIONS} value={filter} onChange={setFilter} />

      {reversed.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No conflicts recorded</p>
      ) : (
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {reversed.map((c) => <ConflictRow key={c.id} c={c} />)}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="flex gap-2 pt-1 border-t border-border/30">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => { clearConflictLog(); setConflicts([]); toast.info("Conflict log cleared"); }}
          >
            Clear History
          </Button>
        </div>
      )}
    </Section>
  );
}

/* --------------------------------------------------
   4. HYDRATION + LIFECYCLE TIMELINE
   -------------------------------------------------- */

const LIFECYCLE_FILTER_OPTIONS = [
  { value: "all" as const, label: "all" },
  { value: "sync" as const, label: "sync" },
  { value: "hydration" as const, label: "hydration" },
  { value: "connectivity" as const, label: "connectivity" },
  { value: "auth" as const, label: "auth" },
  { value: "lifecycle" as const, label: "lifecycle" },
];

type LifecycleFilter = "all" | "sync" | "hydration" | "connectivity" | "auth" | "lifecycle";

function matchesFilter(event: DiagnosticEvent, filter: LifecycleFilter): boolean {
  if (filter === "all") return true;
  const t = event.type;
  if (filter === "sync") return t.includes("sync") || t.includes("dead_letter");
  if (filter === "hydration") return t.includes("hydration") || t.includes("corruption") || t.includes("storage");
  if (filter === "connectivity") return t.includes("connectivity");
  if (filter === "auth") return t.includes("auth");
  if (filter === "lifecycle") return t.includes("lifecycle") || t.includes("foregrounded") || t.includes("backgrounded") || t.includes("memory") || t.includes("cross_tab");
  return true;
}

function HydrationLifecycleTimeline() {
  const hydration = useSyncExternalStore(subscribeToHydration, getHydrationState, getHydrationState);
  const [events, setEvents] = useState(() => getDiagnosticsSnapshot().recentEvents);
  const [filter, setFilter] = useState<LifecycleFilter>("all");

  useEffect(() =>
    subscribeToDiagnostics(() => setEvents(getDiagnosticsSnapshot().recentEvents)),
  []);

  const filtered = events.filter((e) => matchesFilter(e, filter));
  const reversed = [...filtered].reverse().slice(0, 80);

  return (
    <Section
      title="Hydration & Lifecycle"
      description="App state transitions, connectivity changes, and sync triggers"
    >
      {/* Hydration state */}
      <div className="flex items-center gap-3 text-xs font-mono pb-2 border-b border-border/40">
        <span className="text-muted-foreground">hydration:</span>
        <span className={`font-semibold ${hydrationColor(hydration.status)}`}>{hydration.status}</span>
        {hydration.startedAt && hydration.completedAt && (
          <span className="text-muted-foreground">
            ({formatDuration(hydration.completedAt - hydration.startedAt)})
          </span>
        )}
        {hydration.attemptCount > 1 && (
          <span className="text-orange-400">attempt #{hydration.attemptCount}</span>
        )}
        {hydration.degradedReason && (
          <span className="text-yellow-400 truncate">degraded: {hydration.degradedReason}</span>
        )}
        {hydration.staleAgeMs && (
          <span className="text-orange-400">stale {formatDuration(hydration.staleAgeMs)}</span>
        )}
      </div>

      <FilterBar options={LIFECYCLE_FILTER_OPTIONS} value={filter} onChange={setFilter} />

      {reversed.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No events yet</p>
      ) : (
        <div className="space-y-0 max-h-72 overflow-y-auto font-mono text-xs">
          {reversed.map((e, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 border-b border-border/20">
              <span className="shrink-0 text-muted-foreground w-[88px]">{formatTs(e.ts)}</span>
              <span className={`shrink-0 ${lifecycleEventColor(e.type)}`}>{e.type}</span>
              {e.data && (
                <span className="text-muted-foreground truncate text-[10px]">
                  {Object.entries(e.data)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}=${typeof v === "number" ? formatDuration(v as number) : v}`)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* --------------------------------------------------
   5. STORAGE HEALTH PANEL
   -------------------------------------------------- */

function StorageHealthPanel() {
  const [health, setHealth] = useState<StorageHealthReport>(() => getStorageHealth());
  const [quarantine, setQuarantine] = useState(() => getQuarantineEntries());
  const [showQuarantine, setShowQuarantine] = useState(false);
  const queueSize = getQueueSummary();
  const replaySize = getReplayLog().length;

  const refresh = useCallback(() => {
    setHealth(getStorageHealth());
    setQuarantine(getQuarantineEntries());
  }, []);

  return (
    <Section
      title="Storage Health"
      description="localStorage usage, quota status, and persistence integrity"
      badgeVariant={health.isNearCapacity ? "destructive" : "secondary"}
      badge={health.isNearCapacity ? "⚠ near capacity" : `${health.estimatedUsedKb} KB`}
    >
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono">
        <div>
          <span className="text-muted-foreground">used (estimate): </span>
          <span className={health.isNearCapacity ? "text-orange-400 font-semibold" : "text-foreground"}>
            {health.estimatedUsedKb} KB
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">wellmate keys: </span>
          <span className="text-foreground">{health.wellmateKeyCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">op queue: </span>
          <span className="text-foreground">{queueSize.total} ops</span>
        </div>
        <div>
          <span className="text-muted-foreground">replay log: </span>
          <span className="text-foreground">{replaySize} entries</span>
        </div>
        <div>
          <span className="text-muted-foreground">dead-letter: </span>
          <span className={queueSize.deadLetter > 0 ? "text-red-400" : "text-foreground"}>{queueSize.deadLetter}</span>
        </div>
        <div>
          <span className="text-muted-foreground">quarantined: </span>
          <span className={quarantine.length > 0 ? "text-orange-400" : "text-foreground"}>{quarantine.length}</span>
        </div>
      </div>

      {health.warning && (
        <div className="text-xs text-orange-400 bg-orange-400/10 rounded px-3 py-2">
          {health.warning}
        </div>
      )}

      {quarantine.length > 0 && (
        <div>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowQuarantine((v) => !v)}
          >
            {showQuarantine ? "Hide" : "Show"} quarantined entries ({quarantine.length})
          </button>
          {showQuarantine && (
            <div className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto">
              {quarantine.map((q, i) => (
                <div key={i} className="p-2 bg-secondary/30 rounded">
                  <div className="flex gap-3">
                    <span className="text-orange-400">{q.reason}</span>
                    <span className="text-muted-foreground">{formatAgeMs(q.at)}</span>
                  </div>
                  <div className="text-muted-foreground truncate">{q.key}</div>
                  <div className="text-muted-foreground text-[10px] truncate opacity-60">{q.blob.slice(0, 120)}</div>
                </div>
              ))}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 mt-2"
            onClick={() => { clearQuarantine(); setQuarantine([]); toast.info("Quarantine cleared"); }}
          >
            Clear Quarantine
          </Button>
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-border/30">
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={refresh}>
          Refresh
        </Button>
      </div>
    </Section>
  );
}

/* --------------------------------------------------
   6. DEBUG ACTIONS
   -------------------------------------------------- */

function DebugActionsPanel() {
  const [connectivity, setConnectivity] = useState<ConnectivityState>(() => getConnectivity());

  useEffect(() => subscribeToConnectivity((s) => setConnectivity(s)), []);

  const diag = getDiagnosticsSnapshot();
  const connectivityColor = connectivity === "online" ? "text-green-400" : "text-red-400";

  return (
    <Section
      title="Debug Actions"
      description="Safe internal-only actions — all require explicit interaction"
      defaultOpen={false}
    >
      <div className="text-xs font-mono pb-2 border-b border-border/40">
        <span className="text-muted-foreground">network: </span>
        <span className={connectivityColor}>{connectivity}</span>
        <span className="mx-3 text-border">|</span>
        <span className="text-muted-foreground">sync OK: </span>
        <span className="text-green-400">{diag.syncSuccess}</span>
        <span className="mx-3 text-border">|</span>
        <span className="text-muted-foreground">sync err: </span>
        <span className="text-red-400">{diag.syncError}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => {
            requestSync();
            toast.info("Sync requested via lifecycle coordinator");
          }}
        >
          Request Sync
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => {
            resetStrandedSyncingOps();
            toast.info("Stranded syncing ops reset to pending");
          }}
        >
          Reset Stranded Ops
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => { resetDiagnostics(); toast.info("Diagnostics counters reset"); }}
        >
          Reset Diagnostics
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => {
            clearReplayLog();
            toast.info("Replay log cleared");
          }}
        >
          Clear Replay Log
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => {
            clearConflictLog();
            toast.info("Conflict history cleared");
          }}
        >
          Clear Conflicts
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 justify-start"
          onClick={() => {
            const snapshot = {
              replayLog: getReplayLog(),
              operationQueue: getOperationQueue(),
              deadLetter: getDeadLetterQueue(),
              conflictLog: getConflictLog(),
              hydration: getHydrationState(),
              storage: getStorageHealth(),
              diagnostics: getDiagnosticsSnapshot(),
            };
            navigator.clipboard?.writeText(JSON.stringify(snapshot, null, 2))
              .then(() => toast.success("Full state snapshot copied to clipboard"))
              .catch(() => toast.error("Clipboard access denied"));
          }}
        >
          Copy Full Snapshot
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground pt-1">
        These actions only affect in-memory and localStorage state. No Convex mutations are triggered.
        User data is never silently modified.
      </p>
    </Section>
  );
}

/* --------------------------------------------------
   PAGE HEADER
   -------------------------------------------------- */

function InspectorHeader() {
  const [connectivity, setConnectivity] = useState<ConnectivityState>(() => getConnectivity());
  const hydration = useSyncExternalStore(subscribeToHydration, getHydrationState, getHydrationState);
  const navigate = useNavigate();

  useEffect(() => subscribeToConnectivity((s) => setConnectivity(s)), []);

  return (
    <div className="flex items-start justify-between gap-4 pb-2">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-wide">State Inspector</h1>
          <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-mono">DEV</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Internal observability — replay, queue, conflicts, hydration, storage
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono shrink-0">
        <span className={connectivity === "online" ? "text-green-400" : "text-red-400"}>
          ● {connectivity}
        </span>
        <span className={hydrationColor(hydration.status)}>
          {hydration.status}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 text-muted-foreground"
          onClick={() => navigate("/dev")}
        >
          ← Dev
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------
   PAGE ROOT
   -------------------------------------------------- */

export default function StateInspector() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <InspectorHeader />
        <ReplayEventInspector />
        <OperationQueueInspector />
        <ConflictHistoryViewer />
        <HydrationLifecycleTimeline />
        <StorageHealthPanel />
        <DebugActionsPanel />
        <p className="text-[10px] text-muted-foreground text-center pb-4">
          Internal-only · not visible in production · no user data is sent anywhere
        </p>
      </div>
    </div>
  );
}
